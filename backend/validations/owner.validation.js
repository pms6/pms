'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const createOwner = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email').optional(),
    userId: objectId.optional(),
    bankDetails: z.record(z.any()).optional(),
  }),
});

const listOwners = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    search: z.string().optional(),
  }),
});

const getOwner = z.object({ params: z.object({ id: objectId }) });

const updateOwner = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      userId: objectId.optional(),
      bankDetails: z.record(z.any()).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteOwner = z.object({ params: z.object({ id: objectId }) });

module.exports = { createOwner, listOwners, getOwner, updateOwner, deleteOwner };
