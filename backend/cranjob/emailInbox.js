import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import crypto from "crypto";
import EmailRecord, { DONE_STATUSES } from "../models/EmailRecord.js";
import EmailMailbox from "../models/EmailMailbox.js";
import InboxSyncState from "../models/InboxSyncState.js";
import Tenancy from "../models/Tenancy.js";
import Organization from "../models/Organization.js";
import Notification from "../models/Notification.js";
import { mailboxForOrganization } from "../utils/emailMailbox.js";
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

// A brand-new folder sync starts at midnight in the user's Pakistan timezone,
// independent of the timezone configured on the server hosting PMS.
const pakistanTodayStart = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  // IMAP SINCE compares calendar dates. Pass the Pakistan date without a
  // timezone offset so converting it to UTC cannot shift it to yesterday.
  return `${part("year")}-${part("month")}-${part("day")}`;
};

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

const importKeyFor = ({ parsed, organizationId }) => {
  const messageId = String(parsed.messageId || "").trim().toLowerCase();
  const from = (parsed.from?.value || []).map((a) => lower(a.address)).sort().join(",");
  const to = (parsed.to?.value || []).map((a) => lower(a.address)).sort().join(",");
  const date = parsed.date && !Number.isNaN(parsed.date.getTime())
    ? parsed.date.toISOString()
    : "";
  const stableContent = messageId || [from, to, date, baseSubject(parsed.subject).toLowerCase(), String(parsed.text || "").replace(/\s+/g, " ").trim()].join("\n");
  return crypto.createHash("sha256").update(`${organizationId}\n${stableContent}`).digest("hex");
};

const alreadyFiled = async (messageId, importKey, organizationId) => {
  const ids = messageId ? idVariants([messageId]) : [];
  const matches = [];
  if (ids.length) matches.push({ emailMessageId: { $in: ids } }, { "history.emailMessageId": { $in: ids } });
  if (importKey) matches.push({ emailImportKey: importKey }, { "history.emailImportKey": importKey });
  if (!matches.length) return false;
  return Boolean(
    await EmailRecord.exists({
      organizationId,
      $or: matches,
    })
  );
};

// The record this message answers, or null.
const findRecordFor = async ({ organizationId, fromAddr, parsed }) => {
  const refs = [parsed.inReplyTo, ...(Array.isArray(parsed.references) ? parsed.references : [parsed.references])];
  const ids = idVariants(refs.filter(Boolean));
  if (ids.length) {
    const byHeader = await EmailRecord.findOne({
      organizationId,
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
    organizationId,
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

const addReply = async (row, { parsed, fromAddr, messageId, importKey, date }) => {
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
    emailImportKey: importKey,
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
      summary: `Status changed from ${row.status} to Action Required — reply received by email.`,
      auto: true,
      createdByEmail: "Inbox",
    });
    row.status = "Action Required";
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

const createFromTenant = async (tenancy, { parsed, fromAddr, messageId, importKey, date }) => {
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
    direction: "Incoming",
    emailFrom: fromAddr,
    emailTo: (parsed.to?.value || []).map((a) => a.address).filter(Boolean).join(", "),
    subject,
    issue: body || subject || "(no text)",
    category: "Tenant Issue",
    status: "Action Required",
    files,
    emailMessageId: messageId,
    emailImportKey: importKey,
  });

  const org = await Organization.findById(tenancy.organizationId).select("userId").lean();
  await notifyUsers(row.organizationId, [org?.userId, tenancy.createdBy], {
    title: `New email from ${tenancy.tenant || fromAddr}`,
    message: (subject || body).slice(0, 200),
    relatedId: row._id,
  });
};

const createGeneralEmail = async (organizationId, { parsed, messageId, importKey, date, direction, mailboxEmail }) => {
  const from = (parsed.from?.value || []).map((a) => a.address).filter(Boolean).join(", ");
  const to = (parsed.to?.value || []).map((a) => a.address).filter(Boolean).join(", ");
  const subject = String(parsed.subject || "").trim();
  const body = stripQuoted(parsed.text || "") || subject || "(no text)";
  const files = await keepAttachments(parsed);
  await EmailRecord.create({
    organizationId,
    property: "General correspondence",
    date,
    channel: "Email",
    direction,
    emailFrom: from,
    emailTo: to,
    subject,
    issue: body,
    category: "General",
    status: direction === "Outgoing" ? "Awaiting Reply" : "Action Required",
    files,
    emailMessageId: messageId,
    emailImportKey: importKey,
    emailStatus: direction === "Outgoing" ? "Sent" : "",
    emailSentAt: direction === "Outgoing" ? date : null,
  });
};

const addOutgoingMessage = async (row, { parsed, messageId, importKey, date }) => {
  const summary = stripQuoted(parsed.text || "") || baseSubject(parsed.subject) || "(no text)";
  const files = await keepAttachments(parsed);
  row.history.push({
    channel: "Email",
    direction: "Outgoing",
    date,
    from: (parsed.from?.value || []).map((a) => a.address).filter(Boolean).join(", "),
    to: (parsed.to?.value || []).map((a) => a.address).filter(Boolean).join(", "),
    summary,
    files,
    emailStatus: "Sent",
    emailSentAt: date,
    emailMessageId: messageId,
    emailImportKey: importKey,
    createdByEmail: "Gmail",
  });
  await row.save();
};

// Files one parsed message. Returns "reply", "new", "sent" or "ignored".
const fileMessage = async (parsed, { organizationId, mailboxEmail, direction }) => {
  const fromAddr = lower(parsed.from?.value?.[0]?.address);
  if (!fromAddr) return "ignored";
  if (direction === "Incoming" && fromAddr === lower(mailboxEmail)) return "ignored";
  if (/^(mailer-daemon|postmaster|no-?reply)@/i.test(fromAddr)) return "ignored";

  const messageId = String(parsed.messageId || "").trim();
  const importKey = importKeyFor({ parsed, organizationId });
  if (await alreadyFiled(messageId, importKey, organizationId)) return "ignored";

  const date = parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date();

  const matchAddress = direction === "Outgoing"
    ? lower(parsed.to?.value?.[0]?.address)
    : fromAddr;
  const row = await findRecordFor({ organizationId, fromAddr: matchAddress, parsed });
  if (row) {
    if (direction === "Incoming") {
      await addReply(row, { parsed, fromAddr, messageId, importKey, date });
      return "reply";
    }
    await addOutgoingMessage(row, { parsed, messageId, importKey, date });
    return "sent";
  }

  if (direction === "Incoming") {
    const tenancy = await Tenancy.findOne({ organizationId, tenantEmail: fromAddr, isDeleted: false })
      .sort({ startDate: -1, createdAt: -1 })
      .lean();
    if (tenancy) {
      await createFromTenant(tenancy, { parsed, fromAddr, messageId, importKey, date });
      return "new";
    }
  }

  await createGeneralEmail(organizationId, { parsed, messageId, importKey, date, direction, mailboxEmail });
  return direction === "Incoming" ? "new" : "sent";
};

const stateKey = (organizationId, email, folder) => String(organizationId) + ":" + lower(email) + "@imap.gmail.com/" + folder;
const emptyResult = () => ({ replies: 0, newConversations: 0, sent: 0, ignored: 0, errors: [], skipped: "" });

const syncFolder = async (client, account, organizationId, folder, result) => {
  const lock = await client.getMailboxLock(folder, { readOnly: true });
  const key = stateKey(organizationId, account.email, folder);
  const state = (await InboxSyncState.findOne({ key })) || new InboxSyncState({ key });
  state.lastRunAt = new Date();
  try {
    const uidValidity = String(client.mailbox.uidValidity);
    const fresh = state.uidValidity !== uidValidity;
    const sinceToday = pakistanTodayStart();
    const uids = fresh
      ? ((await client.search({ since: sinceToday }, { uid: true })) || [])
      : ((await client.search({ since: sinceToday, uid: String(state.lastUid + 1) + ":*" }, { uid: true })) || []).filter((uid) => uid > state.lastUid);
    uids.sort((a, b) => a - b);
    state.uidValidity = uidValidity;
    if (!uids.length && fresh) state.lastUid = Math.max(0, Number(client.mailbox.uidNext || 1) - 1);

    for (const uid of uids.slice(0, MAX_PER_RUN)) {
      try {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg?.source) throw new Error("Message source was empty.");
        const parsed = await simpleParser(msg.source);
        const outcome = await fileMessage(parsed, {
          organizationId,
          mailboxEmail: account.email,
          direction: folder === "INBOX" ? "Incoming" : "Outgoing",
        });
        if (outcome === "reply") result.replies++;
        else if (outcome === "new") result.newConversations++;
        else if (outcome === "sent") result.sent++;
        else result.ignored++;
        state.lastUid = Math.max(state.lastUid, uid);
        await state.save();
      } catch (err) {
        result.errors.push({ uid, folder, error: err.message });
        console.error("Email folder message failed:", folder, uid, err.message);
        break;
      }
    }
    state.lastSuccessAt = new Date();
    state.lastError = "";
  } catch (err) {
    state.lastError = err.responseText || err.message || "Could not read " + folder + ".";
    result.errors.push({ folder, error: state.lastError });
    console.error("Email folder sync failed:", folder, state.lastError);
  } finally {
    state.lastResult = {
      replies: result.replies,
      newConversations: result.newConversations,
      sent: result.sent,
      ignored: result.ignored,
    };
    await state.save().catch((err) => console.error("Email sync state save failed:", err.message));
    lock.release();
  }
};

/** Sync all existing and new Inbox/Sent messages for one organization's Gmail account. */
export const syncInbox = async ({ organizationId } = {}) => {
  const result = emptyResult();
  if (!organizationId) return { ...result, skipped: "Organization mailbox is required." };
  const account = await mailboxForOrganization(organizationId);
  if (!account) return { ...result, skipped: "Connect this organization's Gmail account in Settings first." };
  if (running) return { ...result, skipped: "Already checking a mailbox. Try again shortly." };
  running = true;
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: account.email, pass: account.password },
    logger: false,
  });
  try {
    await client.connect();
    const folders = await client.list();
    const sentFolder = folders.find((folder) => String(folder.specialUse || "").toLowerCase() === "\\sent")?.path
      || folders.find((folder) => String(folder.path || "").toLowerCase().includes("gmail") && String(folder.path || "").toLowerCase().includes("sent"))?.path;
    if (!sentFolder) throw new Error("Could not find Gmail's Sent folder.");
    await syncFolder(client, account, organizationId, "INBOX", result);
    await syncFolder(client, account, organizationId, sentFolder, result);
    await client.logout();
    if (!result.errors.length) {
      await EmailMailbox.updateOne({ organizationId }, { $set: { initialSyncComplete: true } });
    }
  } catch (err) {
    result.errors.push({ error: err.responseText || err.message || "Could not read Gmail." });
    console.error("Organization email sync failed:", err.responseText || err.message);
    try { client.close(); } catch {}
  } finally {
    running = false;
  }
  return result;
};

export const syncAllConfiguredInboxes = async () => {
  const accounts = await EmailMailbox.find().select("organizationId").lean();
  const result = { organizations: accounts.length, replies: 0, newConversations: 0, sent: 0, ignored: 0, errors: [] };
  for (const account of accounts) {
    const current = await syncInbox({ organizationId: account.organizationId });
    result.replies += current.replies;
    result.newConversations += current.newConversations;
    result.sent += current.sent;
    result.ignored += current.ignored;
    result.errors.push(...current.errors);
  }
  return result;
};

// Status for one organization's inbox button.
export const inboxStatus = async (organizationId) => {
  if (!organizationId) return { configured: false, mailbox: "" };
  const mailbox = await EmailMailbox.findOne({ organizationId }).select("email initialSyncComplete").lean();
  if (!mailbox) return { configured: false, mailbox: "" };
  const prefix = String(organizationId) + ":" + lower(mailbox.email) + "@imap.gmail.com/";
  const states = await InboxSyncState.find({ key: new RegExp("^" + escapeRegex(prefix)) })
    .select("lastRunAt lastSuccessAt lastError lastResult lastUid")
    .lean();
  const newest = states.sort((a, b) => new Date(b.lastRunAt || 0) - new Date(a.lastRunAt || 0))[0];
  const lastSuccess = states.map((state) => state.lastSuccessAt).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
  return {
    configured: true,
    mailbox: mailbox.email,
    initialSyncComplete: mailbox.initialSyncComplete,
    lastRunAt: newest?.lastRunAt || null,
    lastSuccessAt: lastSuccess,
    lastError: states.find((state) => state.lastError)?.lastError || "",
    lastResult: newest?.lastResult || null,
  };
};
