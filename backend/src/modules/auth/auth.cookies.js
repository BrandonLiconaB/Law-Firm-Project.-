import { env } from '../../config/env.js'
import { TOKEN_PATTERN } from './auth.constants.js'

const cookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
})

export function readSessionToken(req) {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME]
  return typeof token === 'string' && TOKEN_PATTERN.test(token) ? token : null
}

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(env.SESSION_COOKIE_NAME, token, { ...cookieOptions, expires: expiresAt })
}

export function clearSessionCookie(res) {
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions)
}
