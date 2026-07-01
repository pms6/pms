'use strict';

const {
  generateSecret,
  hashSecret,
  buildToken,
  parseToken,
  safeEqual,
} = require('../utils/refreshToken');

describe('refreshToken helpers', () => {
  test('generateSecret produces 256 bits of hex entropy, unique each call', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).toMatch(/^[a-f\d]{64}$/);
    expect(a).not.toBe(b);
  });

  test('hashSecret is deterministic and not the plaintext', () => {
    const secret = generateSecret();
    expect(hashSecret(secret)).toBe(hashSecret(secret));
    expect(hashSecret(secret)).not.toBe(secret);
    expect(hashSecret(secret)).toMatch(/^[a-f\d]{64}$/);
  });

  test('buildToken / parseToken round-trip', () => {
    const token = buildToken('64b7f0c2e1a2b3c4d5e6f7a8', 'deadbeef');
    const parsed = parseToken(token);
    expect(parsed).toEqual({ sessionId: '64b7f0c2e1a2b3c4d5e6f7a8', secret: 'deadbeef' });
  });

  test('parseToken keeps the full secret even if it contains dots', () => {
    const parsed = parseToken('abc.def.ghi');
    expect(parsed).toEqual({ sessionId: 'abc', secret: 'def.ghi' });
  });

  test('parseToken rejects malformed tokens', () => {
    expect(parseToken('nodot')).toBeNull();
    expect(parseToken('.leading')).toBeNull();
    expect(parseToken('trailing.')).toBeNull();
    expect(parseToken('')).toBeNull();
    expect(parseToken(null)).toBeNull();
  });

  test('safeEqual matches equal hashes and rejects different / malformed', () => {
    const h = hashSecret('x');
    expect(safeEqual(h, h)).toBe(true);
    expect(safeEqual(h, hashSecret('y'))).toBe(false);
    expect(safeEqual(h, '')).toBe(false);
    expect(safeEqual(h, 'short')).toBe(false);
  });
});
