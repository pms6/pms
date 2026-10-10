import crypto from "crypto";
import EmailMailbox from "../models/EmailMailbox.js";
import env from "../config/env.js";

const encryptionKey = () => {
  const raw = env.mail.credentialEncryptionKey;
  if (!raw) throw new Error("MAIL_CREDENTIAL_ENCRYPTION_KEY is not configured on the server.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("MAIL_CREDENTIAL_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  return key;
};

export const encryptMailboxPassword = (password) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(password), "utf8"), cipher.final()]);
  return { encryptedPassword: encrypted.toString("base64"), passwordIv: iv.toString("base64"), passwordTag: cipher.getAuthTag().toString("base64") };
};

export const decryptMailboxPassword = (mailbox) => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(mailbox.passwordIv, "base64"));
  decipher.setAuthTag(Buffer.from(mailbox.passwordTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(mailbox.encryptedPassword, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

export const mailboxForOrganization = async (organizationId) => {
  const mailbox = await EmailMailbox.findOne({ organizationId }).lean();
  return mailbox ? { ...mailbox, password: decryptMailboxPassword(mailbox) } : null;
};

export const safeMailbox = (mailbox) => mailbox
  ? { configured: true, email: mailbox.email, initialSyncComplete: mailbox.initialSyncComplete }
  : { configured: false, email: "", initialSyncComplete: false };
