import { z } from 'zod'

export const templateNameSchema = z.string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Name is required.').max(120, 'Name cannot exceed 120 characters.')
    .refine((value) => !value.includes('\0'), 'Name cannot contain null characters.'))

const descriptionSchema = z.string().trim().max(1000, 'Description cannot exceed 1000 characters.')
  .refine((value) => !value.includes('\0'), 'Description cannot contain null characters.')
const quantitySchema = z.number().int().min(1).max(2_147_483_647).nullable()
const sectionIdSchema = z.uuid().nullable()

export const sectionSchema = z.strictObject({ name: templateNameSchema })
export const createTemplateDocumentSchema = z.strictObject({
  name: templateNameSchema,
  description: descriptionSchema.default(''),
  isKey: z.boolean().default(false),
  expectedQuantity: quantitySchema.default(null),
  sectionId: sectionIdSchema.default(null),
})
export const updateTemplateDocumentSchema = z.strictObject({
  name: templateNameSchema.optional(),
  description: descriptionSchema.optional(),
  isKey: z.boolean().optional(),
  expectedQuantity: quantitySchema.optional(),
  sectionId: sectionIdSchema.optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'Provide at least one document field to update.',
})
export const moveTemplateItemSchema = z.strictObject({ direction: z.enum(['up', 'down']) })
export const templateParamsSchema = z.strictObject({ matterTypeId: z.uuid() })
export const sectionParamsSchema = templateParamsSchema.extend({ sectionId: z.uuid() })
export const documentParamsSchema = templateParamsSchema.extend({ documentId: z.uuid() })
