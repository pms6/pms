'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const STATUS = ['draft', 'published', 'let'];
const money = z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,2})?$/)]);

const createListing = z.object({
  body: z.object({
    roomId: objectId,
    title: z.string().trim().optional(),
    rentAdvertised: money.optional(),
    availableFrom: z.coerce.date().optional(),
    status: z.enum(STATUS).optional(),
    platforms: z.array(z.string()).optional(),
  }),
});

const listListings = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    status: z.enum(STATUS).optional(),
  }),
});

const getListing = z.object({ params: z.object({ id: objectId }) });

const updateListing = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      title: z.string().trim().optional(),
      rentAdvertised: money.optional(),
      availableFrom: z.coerce.date().optional(),
      status: z.enum(STATUS).optional(),
      platforms: z.array(z.string()).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteListing = z.object({ params: z.object({ id: objectId }) });

module.exports = { createListing, listListings, getListing, updateListing, deleteListing };
