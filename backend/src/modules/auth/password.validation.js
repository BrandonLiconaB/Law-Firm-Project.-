import { z } from 'zod'
import { passwordSchema, usernameSchema } from '../users/user.validation.js'

const existingPasswordSchema = z.string().min(1).max(128)

export const changePasswordSchema = z.strictObject({
  currentPassword: existingPasswordSchema,
  newPassword: passwordSchema,
})

export const resetPasswordSchema = z.strictObject({
  administratorPassword: existingPasswordSchema,
  newPassword: passwordSchema,
})

export const recoverAdministratorSchema = z.strictObject({
  username: usernameSchema,
  newPassword: passwordSchema,
})
