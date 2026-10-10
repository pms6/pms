import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import EmailMailbox from "../models/EmailMailbox.js";
import { encryptMailboxPassword, mailboxForOrganization, safeMailbox } from "../utils/emailMailbox.js";
import { inboxStatus, syncInbox } from "../cranjob/emailInbox.js";

const isAdmin = (req) => req.user?.role === "Organization" && ["OWNER", "ADMIN"].includes(req.user?.organizationRole);
const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const gmailHost = "imap.gmail.com";
const smtpHost = "smtp.gmail.com";

const verifyConnection = async (email, password) => {
  const imap = new ImapFlow({ host: gmailHost, port: 993, secure: true, auth: { user: email, pass: password }, logger: false });
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX", { readOnly: true });
    lock.release();
    const smtp = nodemailer.createTransport({ host: smtpHost, port: 587, secure: false, auth: { user: email, pass: password }, connectionTimeout: 10000, greetingTimeout: 10000 });
    await smtp.verify();
  } finally {
    try { await imap.logout(); } catch { try { imap.close(); } catch {} }
  }
};

export const getEmailMailbox = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Only an owner or admin can manage the organization mailbox." });
    const mailbox = await EmailMailbox.findOne({ organizationId: req.user.organizationId }).lean();
    return res.status(200).json({ success: true, data: { ...safeMailbox(mailbox), status: await inboxStatus(req.user.organizationId) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to load mailbox settings." });
  }
};

export const testEmailMailbox = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Only an owner or admin can manage the organization mailbox." });
    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.appPassword || "").replace(/\s+/g, "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return res.status(400).json({ success: false, message: "Enter the Gmail address and its app password." });
    await verifyConnection(email, password);
    return res.status(200).json({ success: true, message: "Gmail IMAP and SMTP connections are working." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.response || error.message || "Could not connect to Gmail." });
  }
};

export const saveEmailMailbox = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Only an owner or admin can manage the organization mailbox." });
    const organizationId = req.user.organizationId;
    const email = cleanEmail(req.body?.email);
    const previous = await EmailMailbox.findOne({ organizationId });
    const password = String(req.body?.appPassword || "").replace(/\s+/g, "") || (previous ? (await mailboxForOrganization(organizationId)).password : "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return res.status(400).json({ success: false, message: "Enter the Gmail address and its app password." });
    await verifyConnection(email, password);
    const encrypted = encryptMailboxPassword(password);
    const mailbox = await EmailMailbox.findOneAndUpdate(
      { organizationId },
      { $set: { email, ...encrypted } },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    return res.status(200).json({ success: true, message: "Organization mailbox connected.", data: safeMailbox(mailbox) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to save mailbox settings." });
  }
};

export const disconnectEmailMailbox = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Only an owner or admin can manage the organization mailbox." });
    await EmailMailbox.deleteOne({ organizationId: req.user.organizationId });
    return res.status(200).json({ success: true, message: "Organization mailbox disconnected." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to disconnect mailbox." });
  }
};

export const checkOrganizationInbox = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Only an owner or admin can check the inbox." });
    const result = await syncInbox({ organizationId: req.user.organizationId });
    const status = await inboxStatus(req.user.organizationId);
    return res.status(200).json({ success: true, data: { ...result, status } });
  } catch (error) {
    console.error("Organization Inbox Sync Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to check the organization inbox." });
  }
};
