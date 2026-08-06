import nodemailer from "nodemailer";
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

// Verify SMTP connection when the server starts
transporter.verify((err) => {
  if (err) {
    console.error("SMTP Error:", err);
  } else {
    console.log("✅ SMTP connected");
  }
});

export const sendEmail = async ({ email, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"PMS" <${env.mail.user}>`,
      to: email.trim().toLowerCase(),
      subject,
      html,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email Error:", error);
    throw error;
  }
};