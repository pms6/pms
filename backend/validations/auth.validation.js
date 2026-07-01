'use strict';

const { z } = require('zod');

const register = z.object({
  body: z.object({
    accountName: z.string().trim().min(1, 'Account name is required'),
    accountType: z.enum(['landlord', 'agency']).optional(),
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['admin', 'manager', 'agent', 'finance', 'tenant']).optional(),
  }),
});

const login = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const refresh = z.object({
  // Optional: web clients send the refresh token via the httpOnly cookie,
  // API/mobile clients may send it in the body instead.
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }),
});

const revokeSession = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid session id'),
  }),
});

module.exports = { register, login, refresh, revokeSession };
