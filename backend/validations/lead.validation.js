'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const STATUS = ['new', 'qualified', 'converted', 'lost'];

const createLead = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email').optional(),
    phone: z.string().trim().optional(),
    source: z.string().trim().optional(),
    status: z.enum(STATUS).optional(),
    roomId: objectId.optional(),
    assignedTo: objectId.optional(),
  }),
});

const listLeads = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    status: z.enum(STATUS).optional(),
    source: z.string().optional(),
    assignedTo: objectId.optional(),
    search: z.string().optional(),
  }),
});

const getLead = z.object({ params: z.object({ id: objectId }) });

const updateLead = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      phone: z.string().trim().optional(),
      source: z.string().trim().optional(),
      status: z.enum(STATUS).optional(),
      roomId: objectId.optional(),
      assignedTo: objectId.optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteLead = z.object({ params: z.object({ id: objectId }) });

module.exports = { createLead, listLeads, getLead, updateLead, deleteLead };
