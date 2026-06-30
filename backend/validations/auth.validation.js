'use strict';

const { z } = require('zod');

const register = z.object({
  body: z.object({
    accountName: z.string().trim().min(1, 'Account name is required'),
    accountType: z.enum(['landlord', 'agency']).optional(),
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

const login = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const refresh = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  }),
});

module.exports = { register, login, refresh };
