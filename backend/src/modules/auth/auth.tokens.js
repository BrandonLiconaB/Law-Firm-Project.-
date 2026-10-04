import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { TOKEN_PATTERN } from './auth.constants.js'

export function createToken() {
  return randomBytes(32).toString('hex')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function tokensMatch(expected, received) {
  if (
    typeof expected !== 'string' ||
    typeof received !== 'string' ||
    !TOKEN_PATTERN.test(expected) ||
    !TOKEN_PATTERN.test(received)
  ) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex'),
  )
}

export function loginLimitKeys(ip, username) {
  return {
    ip: hashToken(JSON.stringify(['login-ip', ip])),
    accountIp: hashToken(JSON.stringify(['login-account-ip', ip, username])),
  }
}

export function passwordLimitKey(action, userId) {
  return hashToken(JSON.stringify(['password-operation', action, userId]))
}
