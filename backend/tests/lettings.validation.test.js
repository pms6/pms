'use strict';

const lead = require('../validations/lead.validation');
const viewing = require('../validations/viewing.validation');
const applicant = require('../validations/applicant.validation');
const listing = require('../validations/roomListing.validation');

const OID = '64b7f0c2e1a2b3c4d5e6f7a8';

describe('lead.validation', () => {
  test('accepts a valid lead and lowercases email', () => {
    const r = lead.createLead.safeParse({ body: { name: 'Sarah', email: 'S@X.COM', status: 'new' } });
    expect(r.success).toBe(true);
    expect(r.data.body.email).toBe('s@x.com');
  });
  test('requires name and rejects bad status', () => {
    expect(lead.createLead.safeParse({ body: { email: 's@x.com' } }).success).toBe(false);
    expect(lead.createLead.safeParse({ body: { name: 'x', status: 'hot' } }).success).toBe(false);
  });
});

describe('viewing.validation', () => {
  test('requires scheduledAt and coerces it to a Date', () => {
    const r = viewing.createViewing.safeParse({ body: { scheduledAt: '2026-07-10T10:00:00Z', leadId: OID } });
    expect(r.success).toBe(true);
    expect(r.data.body.scheduledAt instanceof Date).toBe(true);
    expect(viewing.createViewing.safeParse({ body: { leadId: OID } }).success).toBe(false);
  });
});

describe('applicant.validation', () => {
  test('accepts a valid applicant with money string', () => {
    const r = applicant.createApplicant.safeParse({ body: { name: 'Tom', holdingDeposit: '250.00' } });
    expect(r.success).toBe(true);
  });
  test('rejects bad referenceStatus and malformed deposit', () => {
    expect(applicant.createApplicant.safeParse({ body: { name: 'x', referenceStatus: 'maybe' } }).success).toBe(false);
    expect(applicant.createApplicant.safeParse({ body: { name: 'x', holdingDeposit: '1.999' } }).success).toBe(false);
  });
});

describe('roomListing.validation', () => {
  test('requires roomId and accepts platforms array', () => {
    const r = listing.createListing.safeParse({ body: { roomId: OID, platforms: ['SpareRoom'], status: 'published' } });
    expect(r.success).toBe(true);
    expect(listing.createListing.safeParse({ body: { title: 'no room' } }).success).toBe(false);
  });
});
