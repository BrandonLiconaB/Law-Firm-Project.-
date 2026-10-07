import { Router } from 'express'
import { validateRequest } from '../../middleware/validateRequest.js'
import { createRequireAuth, noStore, requireAdmin, requireCsrf } from '../auth/auth.middleware.js'
import { createTemplatesController } from './templates.controller.js'
import {
  createTemplateDocumentSchema, documentParamsSchema, moveTemplateItemSchema,
  sectionParamsSchema, sectionSchema, templateParamsSchema, updateTemplateDocumentSchema,
} from './template.validation.js'

export function createTemplatesRouter({ database }) {
  const router = Router({ mergeParams: true })
  const controller = createTemplatesController(database)
  router.use(noStore, createRequireAuth(database))
  router.get('/', validateRequest(templateParamsSchema, 'params'), controller.get)
  router.post('/sections', requireAdmin, requireCsrf,
    validateRequest(templateParamsSchema, 'params'), validateRequest(sectionSchema), controller.createSection)
  router.patch('/sections/:sectionId', requireAdmin, requireCsrf,
    validateRequest(sectionParamsSchema, 'params'), validateRequest(sectionSchema), controller.updateSection)
  router.delete('/sections/:sectionId', requireAdmin, requireCsrf,
    validateRequest(sectionParamsSchema, 'params'), controller.deleteSection)
  router.post('/sections/:sectionId/move', requireAdmin, requireCsrf,
    validateRequest(sectionParamsSchema, 'params'), validateRequest(moveTemplateItemSchema), controller.moveSection)
  router.post('/documents', requireAdmin, requireCsrf,
    validateRequest(templateParamsSchema, 'params'), validateRequest(createTemplateDocumentSchema), controller.createDocument)
  router.patch('/documents/:documentId', requireAdmin, requireCsrf,
    validateRequest(documentParamsSchema, 'params'), validateRequest(updateTemplateDocumentSchema), controller.updateDocument)
  router.delete('/documents/:documentId', requireAdmin, requireCsrf,
    validateRequest(documentParamsSchema, 'params'), controller.deleteDocument)
  router.post('/documents/:documentId/move', requireAdmin, requireCsrf,
    validateRequest(documentParamsSchema, 'params'), validateRequest(moveTemplateItemSchema), controller.moveDocument)
  return router
}
