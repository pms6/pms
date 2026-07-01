'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const PRIORITY = ['low', 'med', 'high', 'urgent'];
const STATUS = ['open', 'assigned', 'in_progress', 'closed'];
const money = z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,2})?$/)]);

const createMaintenance = z.object({
  body: z.object({
    propertyId: objectId.optional(),
    roomId: objectId.optional(),
    supplierId: objectId.optional(),
    category: z.string().trim().optional(),
    title: z.string().trim().min(1, 'Title is required'),
    priority: z.enum(PRIORITY).optional(),
    status: z.enum(STATUS).optional(),
    cost: money.optional(),
  }),
});

const listMaintenance = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    status: z.enum(STATUS).optional(),
    priority: z.enum(PRIORITY).optional(),
    propertyId: objectId.optional(),
  }),
});

const getMaintenance = z.object({ params: z.object({ id: objectId }) });

const updateMaintenance = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      propertyId: objectId.optional(),
      roomId: objectId.optional(),
      supplierId: objectId.optional(),
      category: z.string().trim().optional(),
      title: z.string().trim().min(1).optional(),
      priority: z.enum(PRIORITY).optional(),
      status: z.enum(STATUS).optional(),
      cost: money.optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteMaintenance = z.object({ params: z.object({ id: objectId }) });

module.exports = {
  createMaintenance,
  listMaintenance,
  getMaintenance,
  updateMaintenance,
  deleteMaintenance,
};
