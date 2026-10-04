import { env } from '../../config/env.js'
import { withTransaction } from '../../db/transaction.js'
import { AppError } from '../../shared/AppError.js'
import { hashPassword, verifyPassword } from './password.js'
import { createToken, hashToken } from './auth.tokens.js'
import {
  deleteSessionByToken,
  findLoginUser,
  findSession,
  insertSession,
} from './auth.repository.js'

let dummyPasswordHash

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword(createToken())
  return dummyPasswordHash
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    systemRole: user.systemRole,
  }
}

export async function login(database, credentials, previousToken) {
  const user = await findLoginUser(database, credentials.username)
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash())
  const passwordIsValid = await verifyPassword(passwordHash, credentials.password)

  if (!user || !passwordIsValid) {
    throw new AppError({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
      statusCode: 401,
    })
  }

  const token = createToken()
  const csrfToken = createToken()
  const session = await withTransaction(async (client) => {
    const createdSession = await insertSession(client, {
      userId: user.id,
      tokenHash: hashToken(token),
      csrfToken,
      ttlHours: env.SESSION_TTL_HOURS,
    })

    if (previousToken) {
      await deleteSessionByToken(client, hashToken(previousToken))
    }

    return createdSession
  }, database)

  return { token, user: publicUser(user), csrfToken, expiresAt: session.expiresAt }
}

export async function resolveSession(database, token) {
  const session = await findSession(database, hashToken(token))
  if (!session) return null

  return {
    sessionId: session.sessionId,
    user: publicUser(session),
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  }
}
