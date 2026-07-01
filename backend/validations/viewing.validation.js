'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const STATUS = ['scheduled', 'done', 'cancelled'];

const createViewing = z.object({
  body: z.object({
    leadId: objectId.optional(),
    roomId: objectId.optional(),
    agentId: objectId.optional(),
    scheduledAt: z.coerce.date(),
    status: z.enum(STATUS).optional(),
    feedback: z.string().trim().optional(),
  }),
});

const listViewings = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    status: z.enum(STATUS).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});

const getViewing = z.object({ params: z.object({ id: objectId }) });

const updateViewing = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      leadId: objectId.optional(),
      roomId: objectId.optional(),
      agentId: objectId.optional(),
      scheduledAt: z.coerce.date().optional(),
      status: z.enum(STATUS).optional(),
      feedback: z.string().trim().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteViewing = z.object({ params: z.object({ id: objectId }) });

module.exports = { createViewing, listViewings, getViewing, updateViewing, deleteViewing };
