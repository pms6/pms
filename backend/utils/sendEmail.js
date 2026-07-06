import nodemailer from "nodemailer";
import env from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.mail.host,
  port: env.mail.port,
  secure: false,
  auth: {
    user: env.mail.user,
    pass: env.mail.password,
  },
});

export const sendEmail = async ({ email, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: env.mail.from,
      to: email,
      subject,
      html,
    });

    console.log("Email sent:", info.messageId);

    return info;
  } catch (error) {
    console.error("Email Error:", error);
    throw error;
  }
};