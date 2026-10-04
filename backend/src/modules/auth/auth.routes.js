import { Router } from 'express'
import { validateRequest } from '../../middleware/validateRequest.js'
import { createAuthController } from './auth.controller.js'
import {
  createLoginLimiter,
  createPasswordLimiter,
  createRequireAuth,
  noStore,
  requireCsrf,
  requireTrustedOrigin,
  validateLogin,
} from './auth.middleware.js'
import { PASSWORD_CHANGE_LIMIT } from './auth.constants.js'
import { changePasswordSchema } from './password.validation.js'

export function createAuthRouter({ database }) {
  const router = Router()
  const controller = createAuthController(database)
  const requireAuth = createRequireAuth(database, { allowPasswordChange: true })

  router.use(noStore)
  router.post(
    '/login',
    requireTrustedOrigin,
    validateLogin,
    createLoginLimiter(database),
    controller.login,
  )
  router.get('/me', requireAuth, controller.me)
  router.post(
    '/change-password',
    requireAuth,
    requireCsrf,
    validateRequest(changePasswordSchema),
    createPasswordLimiter(database, {
      action: 'change',
      limit: PASSWORD_CHANGE_LIMIT,
    }),
    controller.changePassword,
  )
  router.post(
    '/logout',
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    controller.logout,
  )

  return router
}
