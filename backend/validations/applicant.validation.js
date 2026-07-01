'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const REF_STATUS = ['pending', 'passed', 'failed'];
const ONBOARDING = ['in_progress', 'complete'];
const money = z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,2})?$/)]);

const createApplicant = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    leadId: objectId.optional(),
    referenceStatus: z.enum(REF_STATUS).optional(),
    onboardingStatus: z.enum(ONBOARDING).optional(),
    holdingDeposit: money.optional(),
  }),
});

const listApplicants = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    referenceStatus: z.enum(REF_STATUS).optional(),
    onboardingStatus: z.enum(ONBOARDING).optional(),
  }),
});

const getApplicant = z.object({ params: z.object({ id: objectId }) });

const updateApplicant = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      leadId: objectId.optional(),
      referenceStatus: z.enum(REF_STATUS).optional(),
      onboardingStatus: z.enum(ONBOARDING).optional(),
      holdingDeposit: money.optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteApplicant = z.object({ params: z.object({ id: objectId }) });

module.exports = {
  createApplicant,
  listApplicants,
  getApplicant,
  updateApplicant,
  deleteApplicant,
};
