import { Router } from 'express'
import { validateRequest } from '../../middleware/validateRequest.js'
import {
  createRequireAuth,
  createPasswordLimiter,
  noStore,
  requireAdmin,
  requireCsrf,
} from '../auth/auth.middleware.js'
import { PASSWORD_RESET_LIMIT } from '../auth/auth.constants.js'
import { resetPasswordSchema } from '../auth/password.validation.js'
import {
  createUserSchema,
  listUsersQuerySchema,
  userIdParamsSchema,
} from './user.validation.js'
import { createUsersController } from './users.controller.js'

export function createUsersRouter({ database }) {
  const router = Router()
  const controller = createUsersController(database)

  router.use(noStore, createRequireAuth(database), requireAdmin)
  router.post('/', requireCsrf, validateRequest(createUserSchema), controller.create)
  router.get('/', validateRequest(listUsersQuerySchema, 'query'), controller.list)
  router.get('/:id', validateRequest(userIdParamsSchema, 'params'), controller.getById)
  router.post(
    '/:id/reset-password',
    requireCsrf,
    validateRequest(userIdParamsSchema, 'params'),
    validateRequest(resetPasswordSchema),
    createPasswordLimiter(database, {
      action: 'reset',
      limit: PASSWORD_RESET_LIMIT,
    }),
    controller.resetPassword,
  )

  return router
}
