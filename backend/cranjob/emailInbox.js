import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import EmailRecord, { DONE_STATUSES } from "../models/EmailRecord.js";
import InboxSyncState from "../models/InboxSyncState.js";
import Tenancy from "../models/Tenancy.js";
import Organization from "../models/Organization.js";
import Notification from "../models/Notification.js";
import env from "../config/env.js";

/**
 * Reads the company inbox and files tenant mail into Email Records:
 *
 *  - A reply to an email sent from Email Records is found by its
 *    In-Reply-To / References headers (the Message-ID stored when it was
 *    sent) — or, failing that, by the same sender and subject — and added to
 *    that record's thread as an incoming reply, attachments included.
 *
 *  - A new email from a tenant's address that answers nothing becomes a new
 *    "Tenant Issue" record linked to their tenancy.
 *
 *  - Anything else (newsletters, other senders) is left alone.
 *
 * The mailbox is opened read-only: nothing is marked read, moved or deleted.
 * Progress is kept by UID in InboxSyncState, and each message's Message-ID is
 * stored on what it created, so a message is never filed twice.
 */

const MAX_PER_RUN = 200;
// Cloudinary's unsigned upload limit for most accounts.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_BODY_CHARS = 10000;

const CLOUD_NAME = env.cloudinary.cloudName || "et693ldf";
const UPLOAD_PRESET = env.cloudinary.uploadPreset || "pms123";

let running = false;

const lower = (v) => String(v || "").trim().toLowerCase();
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "<abc@x>" and "abc@x" are the same Message-ID; stored ids keep the brackets
// nodemailer gives them, so both spellings are looked up.
const idVariants = (ids) => {
  const out = new Set();
  for (const raw of ids) {
    const bare = String(raw || "").trim().replace(/^<|>$/g, "");
    if (!bare) continue;
    out.add(bare);
    out.add(`<${bare}>`);
  }
  return [...out];
};

const baseSubject = (subject) =>
  String(subject || "")
    .replace(/^(\s*(re|fw|fwd|aw|sv)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .trim();

// The new part of a reply, without the quoted conversation under it.
export const stripQuoted = (text) => {
  const body = String(text || "").replace(/\r\n/g, "\n");
  const cutPatterns = [
    /^\s*On .{0,300}?wrote:\s*$/ims, // Gmail / Apple Mail, may wrap over 2 lines
    /^-{2,}\s*Original Message\s*-{2,}/im, // Outlook
    /^_{10,}\s*$/m, // Outlook web divider
    /^From:\s.+\n(Sent|Date):\s/im, // Outlook header block
  ];
  let end = body.length;
  for (const re of cutPatterns) {
    const m = re.exec(body);
    if (m && m.index < end) end = m.index;
  }
  const fresh = body
    .slice(0, end)
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return (fresh || body.trim()).slice(0, MAX_BODY_CHARS);
};

// One attachment into Cloudinary, in the same shape the frontend uploader
// stores. Returns null when it cannot be kept.
const uploadAttachment = async (att) => {
  if (!att?.content || att.size > MAX_ATTACHMENT_BYTES) return null;
  try {
    const form = new FormData();
    form.append("file", new Blob([att.content], { type: att.contentType || "application/octet-stream" }), att.filename || "attachment");
    form.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.secure_url) {
      console.error(`Inbox attachment upload failed (${att.filename}): ${data?.error?.message || res.status}`);
      return null;
    }
    const format = data.format || String(att.filename || "").split(".").pop() || "";
    const type =
      format.toLowerCase() === "pdf"
        ? "pdf"
        : data.resource_type === "image"
          ? "image"
          : data.resource_type === "video"
            ? "video"
            : "file";
    return {
      name: att.filename || "attachment",
      url: data.secure_url,
      publicId: data.public_id || "",
      type,
      format,
      bytes: data.bytes || att.size || 0,
      uploadedAt: new Date(),
    };
  } catch (err) {
    console.error(`Inbox attachment upload failed (${att.filename}): ${err.message}`);
    return null;
  }
};

// Real attachments only — not the logos and signature images embedded in the
// email's HTML.
const keepAttachments = async (parsed) => {
  const list = (parsed.attachments || []).filter(
    (a) => !(a.contentDisposition === "inline" && a.related) && !/^text\/calendar/i.test(a.contentType || "")
  );
  const out = [];
  for (const a of list) {
    const f = await uploadAttachment(a);
    if (f) out.push(f);
  }
  return out;
};

const alreadyFiled = async (messageId) => {
  if (!messageId) return false;
  const ids = idVariants([messageId]);
  return Boolean(
    await EmailRecord.exists({
      $or: [{ emailMessageId: { $in: ids } }, { "history.emailMessageId": { $in: ids } }],
    })
  );
};

// The record this message answers, or null.
const findRecordFor = async ({ fromAddr, parsed }) => {
  const refs = [parsed.inReplyTo, ...(Array.isArray(parsed.references) ? parsed.references : [parsed.references])];
  const ids = idVariants(refs.filter(Boolean));
  if (ids.length) {
    const byHeader = await EmailRecord.findOne({
      isDeleted: false,
      $or: [{ emailMessageId: { $in: ids } }, { "history.emailMessageId": { $in: ids } }],
    });
    if (byHeader) return byHeader;
  }

  // Mail clients that drop the headers still keep "Re: <subject>". Only
  // records already in conversation with this address are considered — ones
  // we wrote to, or ones they wrote in to start — so the whole back-and-forth
  // stays on the one record.
  const subject = baseSubject(parsed.subject);
  if (!subject || !fromAddr) return null;
  const addr = new RegExp(`(^|[\\s,;<])${escapeRegex(fromAddr)}($|[\\s,;>])`, "i");
  return EmailRecord.findOne({
    isDeleted: false,
    subject: new RegExp(`^((re|fw|fwd)\\s*:\\s*)*${escapeRegex(subject)}$`, "i"),
    $or: [
      { emailTo: addr },
      { emailFrom: addr },
      { tenantEmail: fromAddr },
      { "history.to": addr },
      { "history.from": addr },
    ],
  }).sort({ updatedAt: -1 });
};

const notifyUsers = async (organizationId, userIds, { title, message, relatedId }) => {
  const docs = [...new Set(userIds.filter(Boolean).map(String))].map((userId) => ({
    organizationId,
    userId,
    type: "email_reply",
    title,
    message,
    relatedType: "EmailRecord",
    relatedId,
    actorEmail: "",
  }));
  if (!docs.length) return;
  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("Inbox notification write failed:", err.message);
  }
};

const addReply = async (row, { parsed, fromAddr, messageId, date }) => {
  const summary = stripQuoted(parsed.text || "") || baseSubject(parsed.subject) || "(no text)";
  const files = await keepAttachments(parsed);
  const toLine = (parsed.to?.value || []).map((a) => a.address).filter(Boolean).join(", ");

  row.history.push({
    channel: "Email",
    direction: "Incoming",
    date,
    from: fromAddr,
    to: toLine,
    summary,
    files,
    isReply: true,
    auto: true,
    emailMessageId: messageId,
    createdByEmail: "Inbox",
  });
  row.replyReceived = true;
  row.replyDate = date;
  row.replySummary = summary.slice(0, 500);
  // A reply puts a finished conversation back in play.
  if (row.status === "Awaiting Reply" || DONE_STATUSES.includes(row.status)) {
    row.history.push({
      channel: "Note",
      direction: "Internal",
      date: new Date(),
      summary: `Status changed from ${row.status} to Open — reply received by email.`,
      auto: true,
      createdByEmail: "Inbox",
    });
    row.status = "Open";
    row.resolvedAt = null;
    row.closedAt = null;
  }
  await row.save();

  await notifyUsers(row.organizationId, [row.assignedTo || row.createdBy], {
    title: `Reply received — ${row.property}`,
    message: `${fromAddr}: ${summary.slice(0, 180)}`,
    relatedId: row._id,
  });
};

const createFromTenant = async (tenancy, { parsed, fromAddr, messageId, date }) => {
  const body = stripQuoted(parsed.text || "");
  const subject = String(parsed.subject || "").trim();
  const files = await keepAttachments(parsed);

  const row = await EmailRecord.create({
    organizationId: tenancy.organizationId,
    propertyId: tenancy.propertyId || null,
    property: tenancy.property || "—",
    tenancyId: tenancy._id,
    tenantName: tenancy.tenant || "",
    tenantEmail: tenancy.tenantEmail || fromAddr,
    date,
    channel: "Email",
    emailFrom: fromAddr,
    emailTo: (parsed.to?.value || []).map((a) => a.address).filter(Boolean).join(", "),
    subject,
    issue: body || subject || "(no text)",
    category: "Tenant Issue",
    status: "Open",
    files,
    emailMessageId: messageId,
  });

  const org = await Organization.findById(tenancy.organizationId).select("userId").lean();
  await notifyUsers(row.organizationId, [org?.userId, tenancy.createdBy], {
    title: `New email from ${tenancy.tenant || fromAddr}`,
    message: (subject || body).slice(0, 200),
    relatedId: row._id,
  });
};

// Files one parsed message. Returns "reply", "new" or "ignored".
const fileMessage = async (parsed) => {
  const fromAddr = lower(parsed.from?.value?.[0]?.address);
  if (!fromAddr) return "ignored";
  // Our own mail (copies, bounces of our own sends) is never a tenant reply.
  if (fromAddr === lower(env.mail.user) || fromAddr === lower(env.imap.user)) return "ignored";
  if (/^(mailer-daemon|postmaster|no-?reply)@/i.test(fromAddr)) return "ignored";

  const messageId = String(parsed.messageId || "").trim();
  if (await alreadyFiled(messageId)) return "ignored";

  const date = parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date();

  const row = await findRecordFor({ fromAddr, parsed });
  if (row) {
    await addReply(row, { parsed, fromAddr, messageId, date });
    return "reply";
  }

  const tenancy = await Tenancy.findOne({ tenantEmail: fromAddr, isDeleted: false })
    .sort({ startDate: -1, createdAt: -1 })
    .lean();
  if (tenancy) {
    await createFromTenant(tenancy, { parsed, fromAddr, messageId, date });
    return "new";
  }

  return "ignored";
};

/**
 * One pass over the inbox. Safe to call from the cron and from the "Check
 * inbox" button at once — a second call while one is running returns straight
 * away.
 */
export const syncInbox = async () => {
  const cfg = env.imap;
  const result = { replies: 0, newConversations: 0, ignored: 0, errors: [], skipped: "" };

  if (!cfg.enabled) return { ...result, skipped: "Inbox reading is switched off (IMAP_ENABLED=false)." };
  if (!cfg.host || !cfg.user || !cfg.password) {
    return { ...result, skipped: "No inbox configured — set IMAP_HOST, IMAP_USER and IMAP_PASSWORD." };
  }
  if (running) return { ...result, skipped: "Already checking the inbox." };
  running = true;

  const key = `${lower(cfg.user)}@${cfg.host}/${cfg.mailbox}`;
  const state = (await InboxSyncState.findOne({ key })) || new InboxSyncState({ key });
  state.lastRunAt = new Date();

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 993,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(cfg.mailbox, { readOnly: true });
    try {
      const uidValidity = String(client.mailbox.uidValidity);
      const fresh = state.uidValidity !== uidValidity || !state.lastUid;

      let uids;
      if (fresh) {
        const since = new Date(Date.now() - cfg.initialDays * 24 * 60 * 60 * 1000);
        uids = (await client.search({ since }, { uid: true })) || [];
        state.uidValidity = uidValidity;
        // Nothing to read yet — start from the top of the mailbox so the
        // next check only looks at new mail.
        if (!uids.length) state.lastUid = Math.max(0, Number(client.mailbox.uidNext || 1) - 1);
      } else {
        // "N:*" always includes the newest message even below N, hence the filter.
        uids = ((await client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true })) || []).filter(
          (u) => u > state.lastUid
        );
      }

      uids.sort((a, b) => a - b);
      for (const uid of uids.slice(0, MAX_PER_RUN)) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (msg?.source) {
            const parsed = await simpleParser(msg.source);
            const outcome = await fileMessage(parsed);
            if (outcome === "reply") result.replies++;
            else if (outcome === "new") result.newConversations++;
            else result.ignored++;
          }
        } catch (err) {
          result.errors.push({ uid, error: err.message });
          console.error(`Inbox message ${uid} failed:`, err.message);
        }
        state.lastUid = Math.max(state.lastUid, uid);
      }
    } finally {
      lock.release();
    }
    await client.logout();

    state.lastSuccessAt = new Date();
    state.lastError = "";
  } catch (err) {
    state.lastError = err.responseText || err.message || "Could not read the inbox.";
    result.errors.push({ error: state.lastError });
    console.error("Inbox sync failed:", state.lastError);
    try {
      client.close();
    } catch {
      // already closed
    }
  } finally {
    state.lastResult = {
      replies: result.replies,
      newConversations: result.newConversations,
      ignored: result.ignored,
    };
    await state.save().catch((e) => console.error("Inbox state save failed:", e.message));
    running = false;
  }

  return result;
};

// What the board shows next to its "Check inbox" button.
export const inboxStatus = async () => {
  const cfg = env.imap;
  const configured = Boolean(cfg.enabled && cfg.host && cfg.user && cfg.password);
  if (!configured) return { configured, mailbox: cfg.user || "" };
  const state = await InboxSyncState.findOne({ key: `${lower(cfg.user)}@${cfg.host}/${cfg.mailbox}` }).lean();
  return {
    configured,
    mailbox: cfg.user,
    lastRunAt: state?.lastRunAt || null,
    lastSuccessAt: state?.lastSuccessAt || null,
    lastError: state?.lastError || "",
  };
};
