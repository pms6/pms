'use strict';

const { updateAccount } = require('../validations/account.validation');

describe('account.validation — updateAccount', () => {
  test('accepts a valid partial update', () => {
    const result = updateAccount.safeParse({
      body: { name: 'New Lettings Ltd', type: 'agency' },
    });
    expect(result.success).toBe(true);
    expect(result.data.body.name).toBe('New Lettings Ltd');
  });

  test('lowercases and trims contactEmail', () => {
    const result = updateAccount.safeParse({
      body: { contactEmail: '  Owner@Example.COM ' },
    });
    expect(result.success).toBe(true);
    expect(result.data.body.contactEmail).toBe('owner@example.com');
  });

  test('rejects an empty body (nothing to update)', () => {
    const result = updateAccount.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });

  test('rejects an invalid account type', () => {
    const result = updateAccount.safeParse({ body: { type: 'broker' } });
    expect(result.success).toBe(false);
  });

  test('rejects a malformed email', () => {
    const result = updateAccount.safeParse({ body: { contactEmail: 'not-an-email' } });
    expect(result.success).toBe(false);
  });
});
