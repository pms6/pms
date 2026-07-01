'use strict';

const { z } = require('zod');

/**
 * Update the caller's own account. All fields optional, but at least one must
 * be present. `settings` is a free-form object (mirrors Account.settings Mixed).
 */
const updateAccount = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Account name is required').optional(),
      type: z.enum(['landlord', 'agency']).optional(),
      contactEmail: z.string().trim().toLowerCase().email('Invalid email').optional(),
      settings: z.record(z.any()).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

module.exports = { updateAccount };
