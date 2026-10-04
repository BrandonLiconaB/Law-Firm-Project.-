import { Router } from 'express'
import { validateRequest } from '../../middleware/validateRequest.js'
import {
  createRequireAuth,
  noStore,
  requireAdmin,
  requireCsrf,
} from '../auth/auth.middleware.js'
import {
  createMatterTypeSchema,
  listMatterTypesQuerySchema,
  matterTypeIdParamsSchema,
  updateMatterTypeSchema,
} from './matterType.validation.js'
import { createMatterTypesController } from './matterTypes.controller.js'

export function createMatterTypesRouter({ database }) {
  const router = Router()
  const controller = createMatterTypesController(database)

  router.use(noStore, createRequireAuth(database))
  router.get('/', validateRequest(listMatterTypesQuerySchema, 'query'), controller.list)
  router.get('/:id', validateRequest(matterTypeIdParamsSchema, 'params'), controller.getById)
  router.post(
    '/',
    requireAdmin,
    requireCsrf,
    validateRequest(createMatterTypeSchema),
    controller.create,
  )
  router.patch(
    '/:id',
    requireAdmin,
    requireCsrf,
    validateRequest(matterTypeIdParamsSchema, 'params'),
    validateRequest(updateMatterTypeSchema),
    controller.update,
  )

  return router
}
