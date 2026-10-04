import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.x-csrf-token',
      'res.headers.set-cookie',
      'err.detail',
      'err.parameters',
      '*.password',
      '*.passwordHash',
      '*.csrfToken',
      '*.token',
    ],
    censor: '[Redacted]',
  },
})
