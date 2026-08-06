// utils/otp.js
// Shared helpers for the 6-digit email codes used by account verification and
// password reset. Both flows want the same lifetime, the same resend cooldown
// and the same brute-force ceiling, so they live here rather than being
// re-derived in the controller.
import crypto from "crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // a code is good for 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // at most one code a minute
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses before the code is dead

// crypto.randomInt rather than Math.random — these codes are a credential.
export const generateOtp = () => String(crypto.randomInt(100000, 1000000));

export const otpExpiry = () => new Date(Date.now() + OTP_TTL_MS);

// Whole seconds left on the resend cooldown; 0 means clear to send.
export const cooldownRemaining = (sentAt) => {
  if (!sentAt) return 0;
  const elapsed = Date.now() - new Date(sentAt).getTime();
  if (Number.isNaN(elapsed) || elapsed >= OTP_RESEND_COOLDOWN_MS) return 0;
  return Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
};

// True when the stored code is missing or past its expiry.
export const isOtpExpired = (code, expiresAt) =>
  !code || !expiresAt || Date.now() > new Date(expiresAt).getTime();

export const otpEmail = ({ heading, intro, code, footer }) => `
  <div style="font-family: sans-serif; padding: 20px; max-width: 500px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #333;">${heading}</h2>
    <p>${intro}</p>
    <h1 style="color: #4A90E2; letter-spacing: 4px; background: #f4f6f8; padding: 10px; text-align: center; border-radius: 4px;">${code}</h1>
    <p style="font-size: 12px; color: #666;">This code will expire in 10 minutes.</p>
    ${footer ? `<p style="font-size: 12px; color: #666;">${footer}</p>` : ""}
  </div>
`;
