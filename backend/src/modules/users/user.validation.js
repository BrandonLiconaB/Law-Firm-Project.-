import { z } from 'zod'

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must contain at least 3 characters.')
  .max(50, 'Username cannot contain more than 50 characters.')
  .regex(
    /^[a-z0-9._-]+$/,
    'Username can only contain letters, numbers, periods, hyphens, and underscores.',
  )

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Full name must contain at least 2 characters.')
  .max(120, 'Full name cannot contain more than 120 characters.')

export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(128, 'Password cannot contain more than 128 characters.')

export const createUserSchema = z.strictObject({
  username: usernameSchema,
  fullName: fullNameSchema,
  password: passwordSchema,
})

export const initialAdminSchema = createUserSchema

export const listUsersQuerySchema = z.strictObject({
  page: z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .pipe(z.number().int().max(100_000))
    .default(1),
  limit: z
    .string()
    .regex(/^[1-9]\d{0,2}$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .default(20),
})

export const userIdParamsSchema = z.strictObject({
  id: z.uuid(),
})
