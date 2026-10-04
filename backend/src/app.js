import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { pool } from './db/pool.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { createHealthRouter } from './modules/health/health.routes.js'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import { createUsersRouter } from './modules/users/users.routes.js'
import { AppError } from './shared/AppError.js'

function validateOrigin(origin, callback) {
  if (!origin || origin === env.FRONTEND_ORIGIN) {
    callback(null, true)
    return
  }

  callback(
    new AppError({
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'This origin is not allowed to access the API.',
      statusCode: 403,
    }),
  )
}

export function createApp({ database = pool } = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false)

  app.use(pinoHttp({ logger }))
  app.use(helmet())
  app.use(
    cors({
      origin: validateOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  app.use(express.json({ limit: '50kb' }))
  app.use(cookieParser())

  app.use('/api/health', createHealthRouter({ database }))
  app.use('/api/auth', createAuthRouter({ database }))
  app.use('/api/users', createUsersRouter({ database }))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
