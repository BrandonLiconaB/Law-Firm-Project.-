import { z } from 'zod'

const nameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string()
    .min(1, 'Matter type name is required.')
    .max(120, 'Matter type name cannot contain more than 120 characters.')
    .refine((value) => !value.includes('\0'), 'Name cannot contain null characters.'))

const descriptionSchema = z
  .string()
  .trim()
  .max(1000, 'Description cannot contain more than 1000 characters.')
  .refine((value) => !value.includes('\0'), 'Description cannot contain null characters.')

export const createMatterTypeSchema = z.strictObject({
  name: nameSchema,
  description: descriptionSchema.default(''),
})

export const updateMatterTypeSchema = z.strictObject({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
}).refine(
  (value) => value.name !== undefined || value.description !== undefined,
  { message: 'Provide a name or description to update.' },
)

export const listMatterTypesQuerySchema = z.strictObject({
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

export const matterTypeIdParamsSchema = z.strictObject({
  id: z.uuid(),
})
