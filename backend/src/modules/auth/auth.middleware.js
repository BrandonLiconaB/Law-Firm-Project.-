import { env } from '../../config/env.js'
import { AppError } from '../../shared/AppError.js'
import { USER_ROLES } from '../users/user.constants.js'
import {
  LOGIN_ACCOUNT_IP_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_WINDOW_SECONDS,
} from './auth.constants.js'
import { clearSessionCookie, readSessionToken } from './auth.cookies.js'
import { consumeLoginAttempt } from './auth.repository.js'
import { resolveSession } from './auth.service.js'
import { loginLimitKeys, passwordLimitKey, tokensMatch } from './auth.tokens.js'
import { loginSchema } from './auth.validation.js'

export function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}

export function requireTrustedOrigin(req, res, next) {
  if (req.get('Origin') !== env.FRONTEND_ORIGIN) {
    throw new AppError({
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'This origin is not allowed to access the API.',
      statusCode: 403,
    })
  }
  next()
}

export function validateLogin(req, res, next) {
  if (!req.is('application/json')) {
    throw new AppError({
      code: 'JSON_REQUIRED',
      message: 'Content-Type must be application/json.',
      statusCode: 415,
    })
  }

  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError({
      code: 'INVALID_INPUT',
      message: 'Provide a valid username and password.',
      statusCode: 400,
    })
  }
  req.loginCredentials = result.data
  next()
}

export function createLoginLimiter(database) {
  return async (req, res, next) => {
    const keys = loginLimitKeys(req.ip, req.loginCredentials.username)
    for (const [key, limit] of [
      [keys.ip, LOGIN_IP_LIMIT],
      [keys.accountIp, LOGIN_ACCOUNT_IP_LIMIT],
    ]) {
      const result = await consumeLoginAttempt(
        database,
        key,
        limit,
        LOGIN_WINDOW_SECONDS,
      )
      if (result.attempts > limit) {
        res.set('Retry-After', String(result.retryAfter))
        throw new AppError({
          code: 'LOGIN_RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
          statusCode: 429,
        })
      }
    }
    next()
  }
}

export function createPasswordLimiter(database, { action, limit }) {
  return async (req, res, next) => {
    const result = await consumeLoginAttempt(
      database,
      passwordLimitKey(action, req.auth.user.id),
      limit,
      LOGIN_WINDOW_SECONDS,
    )
    if (result.attempts > limit) {
      res.set('Retry-After', String(result.retryAfter))
      throw new AppError({
        code: 'PASSWORD_RATE_LIMITED',
        message: 'Too many password attempts. Please try again later.',
        statusCode: 429,
      })
    }
    next()
  }
}

export function createRequireAuth(database, { allowPasswordChange = false } = {}) {
  return async (req, res, next) => {
    const token = readSessionToken(req)
    req.auth = token ? await resolveSession(database, token) : null
    if (!req.auth) {
      clearSessionCookie(res)
      throw new AppError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Please sign in to continue.',
        statusCode: 401,
      })
    }
    if (req.auth.user.mustChangePassword && !allowPasswordChange) {
      throw new AppError({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Please change your temporary password to continue.',
        statusCode: 403,
      })
    }
    next()
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.user.systemRole !== USER_ROLES.ADMIN) {
    throw new AppError({
      code: 'ADMIN_REQUIRED',
      message: 'Administrator permission is required.',
      statusCode: 403,
    })
  }
  next()
}

export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next()
    return
  }
  requireTrustedOrigin(req, res, () => {
    if (!tokensMatch(req.auth?.csrfToken, req.get('X-CSRF-Token'))) {
      throw new AppError({
        code: 'INVALID_CSRF_TOKEN',
        message: 'The request could not be verified.',
        statusCode: 403,
      })
    }
    next()
  })
}
