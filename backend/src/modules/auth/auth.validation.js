import { z } from 'zod'
import { usernameSchema } from '../users/user.validation.js'

// Existing credentials are checked without applying new-password rules.
export const loginSchema = z.strictObject({
  username: usernameSchema,
  password: z.string().min(1).max(128),
})
