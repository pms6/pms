'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const ROOM_TYPES = ['single', 'double', 'ensuite'];
const ROOM_STATUS = ['vacant', 'occupied', 'maint'];

// Money arrives as a number or numeric string; Mongoose casts it to Decimal128.
const money = z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,2})?$/)]);

const createRoom = z.object({
  params: z.object({ propertyId: objectId }),
  body: z.object({
    roomNumber: z.string().trim().min(1, 'Room number is required'),
    floorId: objectId.optional(),
    roomType: z.enum(ROOM_TYPES).optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    rentAmount: money.optional(),
    status: z.enum(ROOM_STATUS).optional(),
    availableFrom: z.coerce.date().optional(),
    amenities: z.array(z.string()).optional(),
  }),
});

const listRooms = z.object({
  params: z.object({ propertyId: objectId }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    status: z.enum(ROOM_STATUS).optional(),
  }),
});

const getRoom = z.object({
  params: z.object({ propertyId: objectId, id: objectId }),
});

const updateRoom = z.object({
  params: z.object({ propertyId: objectId, id: objectId }),
  body: z
    .object({
      roomNumber: z.string().trim().min(1).optional(),
      floorId: objectId.optional(),
      roomType: z.enum(ROOM_TYPES).optional(),
      capacity: z.coerce.number().int().min(1).optional(),
      rentAmount: money.optional(),
      status: z.enum(ROOM_STATUS).optional(),
      availableFrom: z.coerce.date().optional(),
      amenities: z.array(z.string()).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteRoom = z.object({
  params: z.object({ propertyId: objectId, id: objectId }),
});

module.exports = { createRoom, listRooms, getRoom, updateRoom, deleteRoom };
