import { Router } from 'express'
import { createAuthController } from './auth.controller.js'
import {
  createLoginLimiter,
  createRequireAuth,
  noStore,
  requireCsrf,
  requireTrustedOrigin,
  validateLogin,
} from './auth.middleware.js'

export function createAuthRouter({ database }) {
  const router = Router()
  const controller = createAuthController(database)
  const requireAuth = createRequireAuth(database)

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
    '/logout',
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    controller.logout,
  )

  return router
}
