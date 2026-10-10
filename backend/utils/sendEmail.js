import nodemailer from "nodemailer";
import crypto from "crypto";
import { mailboxForOrganization } from "./emailMailbox.js";
import env from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.mail.host, // smtp.gmail.com
  port: Number(env.mail.port), // 465 or 587
  secure: Number(env.mail.port) === 465,

  auth: {
    user: env.mail.user, // pms6@gmail.com
    pass: env.mail.password, // Gmail App Password
  },

  pool: true,
  maxConnections: 5,
  maxMessages: 100,

  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});
const organizationTransporters = new Map();

const transporterForOrganization = async (organizationId) => {
  const mailbox = await mailboxForOrganization(organizationId);
  if (!mailbox) throw new Error("Connect a Gmail mailbox in organization settings before sending email.");
  const fingerprint = crypto.createHash("sha256").update(`${mailbox.email}:${mailbox.password}`).digest("hex");
  const cached = organizationTransporters.get(String(organizationId));
  if (cached?.fingerprint === fingerprint) return cached.transporter;
  const accountTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: mailbox.email, pass: mailbox.password },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  organizationTransporters.set(String(organizationId), { fingerprint, transporter: accountTransporter });
  return accountTransporter;
};

// Verify SMTP connection when the server starts
transporter.verify((err) => {
  if (err) {
    console.error("SMTP Error:", err);
  } else {
    console.log("✅ SMTP connected");
  }
});

// Accepts one address or several. `email` stays a plain string for the OTP and
// invite callers; `cc` lets the reminder jobs copy in the rest of the team
// without sending a separate message to each of them.
const addressList = (value) =>
  (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((address) => String(address).trim().toLowerCase())
    .filter(Boolean)
    .join(", ");

// `attachments` takes nodemailer's own shape — { filename, path } with `path`
// a URL is fetched and attached at send time. `replyTo` sends the recipient's
// answer to a different mailbox than the SMTP account the mail goes out from.
// `inReplyTo` / `references` are the Message-IDs of the earlier mail in a
// conversation, so the recipient's mail client files this one in the same
// thread instead of starting a new one.
export const sendEmail = async ({
  organizationId,
  email,
  cc,
  subject,
  html,
  text,
  attachments,
  replyTo,
  inReplyTo,
  references,
}) => {
  try {
    const to = addressList(email);
    if (!to) throw new Error("No recipient address");

    const ccList = addressList(cc);

    const sender = organizationId ? await mailboxForOrganization(organizationId) : null;
    const activeTransporter = organizationId ? await transporterForOrganization(organizationId) : transporter;
    const info = await activeTransporter.sendMail({
      from: `"PMS" <${sender?.email || env.mail.user}>`,
      to,
      ...(ccList ? { cc: ccList } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(inReplyTo ? { inReplyTo } : {}),
      ...(references?.length ? { references } : {}),
      subject,
      html,
      ...(text ? { text } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email Error:", error);
    throw error;
  }
};
