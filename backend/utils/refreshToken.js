'use strict';

const crypto = require('crypto');

/**
 * Opaque refresh-token helpers.
 *
 * A refresh token is `${sessionId}.${secret}` where `secret` is 256 bits of
 * entropy. Only the SHA-256 hash of the secret is stored (in the Session
 * collection), so a database leak never exposes a usable token. SHA-256 — not
 * bcrypt — is the right choice here: the secret is already high-entropy, so we
 * want a fast, deterministic, indexable digest, not a slow password hash.
 */

/** 256-bit url-safe-ish secret. */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/** Deterministic hash of a secret, stored in the DB. */
function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Build the token string handed to the client. */
function buildToken(sessionId, secret) {
  return `${sessionId}.${secret}`;
}

/** Split a presented token into its parts. Returns null if malformed. */
function parseToken(token) {
  if (typeof token !== 'string') return null;
  const idx = token.indexOf('.');
  if (idx <= 0 || idx === token.length - 1) return null;
  return { sessionId: token.slice(0, idx), secret: token.slice(idx + 1) };
}

/** Constant-time comparison of two hex digests (guards against timing attacks). */
function safeEqual(hexA, hexB) {
  if (typeof hexA !== 'string' || typeof hexB !== 'string') return false;
  const a = Buffer.from(hexA, 'hex');
  const b = Buffer.from(hexB, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { generateSecret, hashSecret, buildToken, parseToken, safeEqual };
