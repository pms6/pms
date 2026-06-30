'use strict';

const { z } = require('zod');

const ROLES = ['admin', 'manager', 'agent', 'finance', 'tenant'];
const STATUSES = ['active', 'invited', 'disabled'];

// Reusable Mongo ObjectId check (24 hex chars).
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const createUser = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(ROLES).optional(),
    status: z.enum(STATUSES).optional(),
  }),
});

const listUsers = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(STATUSES).optional(),
    search: z.string().optional(),
  }),
});

const getUser = z.object({
  params: z.object({ id: objectId }),
});

const updateUser = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      password: z.string().min(8).optional(),
      role: z.enum(ROLES).optional(),
      status: z.enum(STATUSES).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' }),
});

const deleteUser = z.object({
  params: z.object({ id: objectId }),
});

module.exports = { createUser, listUsers, getUser, updateUser, deleteUser };
