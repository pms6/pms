'use strict';

const propertySchema = require('../validations/property.validation');
const roomSchema = require('../validations/room.validation');

const OID = '64b7f0c2e1a2b3c4d5e6f7a8';

describe('property.validation — createProperty', () => {
  test('accepts a valid property', () => {
    const r = propertySchema.createProperty.safeParse({
      body: { name: 'Maple House', ownerId: OID, city: 'Leeds' },
    });
    expect(r.success).toBe(true);
  });

  test('requires name and ownerId', () => {
    expect(propertySchema.createProperty.safeParse({ body: { name: 'X' } }).success).toBe(false);
    expect(propertySchema.createProperty.safeParse({ body: { ownerId: OID } }).success).toBe(false);
  });

  test('rejects a bad ownerId and bad status', () => {
    expect(propertySchema.createProperty.safeParse({ body: { name: 'X', ownerId: 'nope' } }).success).toBe(false);
    expect(
      propertySchema.createProperty.safeParse({ body: { name: 'X', ownerId: OID, status: 'sold' } }).success
    ).toBe(false);
  });

  test('update rejects an empty body', () => {
    const r = propertySchema.updateProperty.safeParse({ params: { id: OID }, body: {} });
    expect(r.success).toBe(false);
  });
});

describe('room.validation — createRoom', () => {
  test('accepts a valid room and coerces numeric fields', () => {
    const r = roomSchema.createRoom.safeParse({
      params: { propertyId: OID },
      body: { roomNumber: 'R1', roomType: 'ensuite', capacity: '2', rentAmount: '650.00' },
    });
    expect(r.success).toBe(true);
    expect(r.data.body.capacity).toBe(2);
  });

  test('requires roomNumber and a valid propertyId param', () => {
    expect(roomSchema.createRoom.safeParse({ params: { propertyId: OID }, body: {} }).success).toBe(false);
    expect(
      roomSchema.createRoom.safeParse({ params: { propertyId: 'bad' }, body: { roomNumber: 'R1' } }).success
    ).toBe(false);
  });

  test('rejects an invalid roomType / status and malformed money', () => {
    expect(
      roomSchema.createRoom.safeParse({ params: { propertyId: OID }, body: { roomNumber: 'R1', roomType: 'suite' } }).success
    ).toBe(false);
    expect(
      roomSchema.createRoom.safeParse({ params: { propertyId: OID }, body: { roomNumber: 'R1', rentAmount: '12.999' } }).success
    ).toBe(false);
  });
});
