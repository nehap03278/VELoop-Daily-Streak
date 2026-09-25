const { z } = require('zod');

const email = z.string({ required_error: 'Email is required.' }).trim().toLowerCase().email('Enter a valid email address.').max(254);

const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required.' }).trim().min(2, 'Name must be at least 2 characters.').max(60),
  email,
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter.')
    .regex(/[0-9]/, 'Password must contain a number.'),
});

const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.').max(128),
});

module.exports = { registerSchema, loginSchema };
