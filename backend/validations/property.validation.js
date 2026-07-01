'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const STATUSES = ['active', 'archived'];

const createProperty = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    ownerId: objectId,
    addressLine1: z.string().trim().optional(),
    city: z.string().trim().optional(),
    postcode: z.string().trim().optional(),
    status: z.enum(STATUSES).optional(),
  }),
});

const listProperties = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    status: z.enum(STATUSES).optional(),
    ownerId: objectId.optional(),
    search: z.string().optional(),
  }),
});

const getProperty = z.object({ params: z.object({ id: objectId }) });

const updateProperty = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      ownerId: objectId.optional(),
      addressLine1: z.string().trim().optional(),
      city: z.string().trim().optional(),
      postcode: z.string().trim().optional(),
      status: z.enum(STATUSES).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteProperty = z.object({ params: z.object({ id: objectId }) });

module.exports = { createProperty, listProperties, getProperty, updateProperty, deleteProperty };
