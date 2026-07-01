'use strict';

const m = require('../validations/maintenance.validation');
const c = require('../validations/compliance.validation');

const OID = '64b7f0c2e1a2b3c4d5e6f7a8';

describe('maintenance.validation', () => {
  test('accepts a valid request and coerces nothing it should not', () => {
    const r = m.createMaintenance.safeParse({
      body: { title: 'Boiler fault', priority: 'urgent', propertyId: OID, cost: '120.50' },
    });
    expect(r.success).toBe(true);
  });

  test('requires a title', () => {
    expect(m.createMaintenance.safeParse({ body: { priority: 'low' } }).success).toBe(false);
  });

  test('rejects bad priority/status and malformed cost', () => {
    expect(m.createMaintenance.safeParse({ body: { title: 'x', priority: 'now' } }).success).toBe(false);
    expect(m.createMaintenance.safeParse({ body: { title: 'x', status: 'done' } }).success).toBe(false);
    expect(m.createMaintenance.safeParse({ body: { title: 'x', cost: '1.999' } }).success).toBe(false);
  });
});

describe('compliance.validation', () => {
  test('accepts a valid certificate', () => {
    const r = c.createCompliance.safeParse({
      body: { propertyId: OID, certType: 'Gas', expiryDate: '2027-01-01' },
    });
    expect(r.success).toBe(true);
    expect(r.data.body.expiryDate instanceof Date).toBe(true);
  });

  test('requires propertyId and a valid certType', () => {
    expect(c.createCompliance.safeParse({ body: { certType: 'Gas' } }).success).toBe(false);
    expect(c.createCompliance.safeParse({ body: { propertyId: OID, certType: 'MOT' } }).success).toBe(false);
  });

  test('list accepts the due filter', () => {
    expect(c.listCompliance.safeParse({ query: { due: 'soon' } }).success).toBe(true);
    expect(c.listCompliance.safeParse({ query: { due: 'never' } }).success).toBe(false);
  });
});
