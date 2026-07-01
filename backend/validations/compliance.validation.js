'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const CERT_TYPES = ['EPC', 'Gas', 'EICR', 'FRA', 'PAT', 'Legionella', 'FireDoor', 'Alarm'];

const createCompliance = z.object({
  body: z.object({
    propertyId: objectId,
    roomId: objectId.optional(),
    certType: z.enum(CERT_TYPES),
    issueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    documentId: objectId.optional(),
  }),
});

const listCompliance = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    propertyId: objectId.optional(),
    certType: z.enum(CERT_TYPES).optional(),
    status: z.enum(['valid', 'expiring', 'expired']).optional(),
    due: z.enum(['soon', 'expired']).optional(),
  }),
});

const getCompliance = z.object({ params: z.object({ id: objectId }) });

const updateCompliance = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      certType: z.enum(CERT_TYPES).optional(),
      issueDate: z.coerce.date().optional(),
      expiryDate: z.coerce.date().optional(),
      documentId: objectId.optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteCompliance = z.object({ params: z.object({ id: objectId }) });

module.exports = {
  createCompliance,
  listCompliance,
  getCompliance,
  updateCompliance,
  deleteCompliance,
};
