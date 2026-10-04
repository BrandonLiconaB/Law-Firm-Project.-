import { pool } from '../../db/pool.js'
import { withTransaction } from '../../db/transaction.js'
import { AppError } from '../../shared/AppError.js'
import { USER_ROLES } from '../users/user.constants.js'
import { hashPassword, verifyPassword } from './password.js'
import {
  lockAdministratorForRecovery,
  lockUserCredentials,
  sessionIsActive,
  updatePasswordAndRevokeSessions,
} from './password.repository.js'
import {
  changePasswordSchema,
  recoverAdministratorSchema,
  resetPasswordSchema,
} from './password.validation.js'

function passwordUnchangedError() {
  return new AppError({
    code: 'PASSWORD_UNCHANGED',
    message: 'Choose a password different from the current password.',
    statusCode: 400,
  })
}

async function assertActiveSession(client, user, auth) {
  if (!user || !(await sessionIsActive(client, auth.sessionId, user.id))) {
    throw new AppError({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Please sign in to continue.',
      statusCode: 401,
    })
  }
}

export async function changeOwnPassword(auth, input, database = pool) {
  const credentials = changePasswordSchema.parse(input)
  await withTransaction(async (client) => {
    const user = await lockUserCredentials(client, auth.user.id)
    await assertActiveSession(client, user, auth)
    if (!(await verifyPassword(user.passwordHash, credentials.currentPassword))) {
      throw new AppError({
        code: 'CURRENT_PASSWORD_INCORRECT',
        message: 'The current password is incorrect.',
        statusCode: 400,
      })
    }
    if (credentials.currentPassword === credentials.newPassword) {
      throw passwordUnchangedError()
    }

    const passwordHash = await hashPassword(credentials.newPassword)
    await updatePasswordAndRevokeSessions(client, user.id, passwordHash, false)
  }, database)
}

export async function resetMemberPassword(auth, userId, input, database = pool) {
  const credentials = resetPasswordSchema.parse(input)
  await withTransaction(async (client) => {
    const actor = await lockUserCredentials(client, auth.user.id)
    await assertActiveSession(client, actor, auth)
    if (actor.systemRole !== USER_ROLES.ADMIN || actor.mustChangePassword) {
      throw new AppError({
        code: 'ADMIN_REQUIRED',
        message: 'Administrator permission is required.',
        statusCode: 403,
      })
    }
    if (!(await verifyPassword(actor.passwordHash, credentials.administratorPassword))) {
      throw new AppError({
        code: 'ADMIN_PASSWORD_INCORRECT',
        message: 'The administrator password is incorrect.',
        statusCode: 400,
      })
    }

    const user = userId === actor.id ? actor : await lockUserCredentials(client, userId)
    if (!user) {
      throw new AppError({
        code: 'USER_NOT_FOUND',
        message: 'The user was not found.',
        statusCode: 404,
      })
    }
    if (user.systemRole !== USER_ROLES.MEMBER) {
      throw new AppError({
        code: 'PASSWORD_RESET_NOT_ALLOWED',
        message: 'This operation is only available for MEMBER accounts.',
        statusCode: 400,
      })
    }
    if (await verifyPassword(user.passwordHash, credentials.newPassword)) {
      throw passwordUnchangedError()
    }

    const passwordHash = await hashPassword(credentials.newPassword)
    await updatePasswordAndRevokeSessions(client, user.id, passwordHash, true)
  }, database)
}

export async function recoverAdministrator(input, database = pool) {
  const credentials = recoverAdministratorSchema.parse(input)
  return withTransaction(async (client) => {
    const user = await lockAdministratorForRecovery(client, credentials.username)
    if (!user) {
      throw new AppError({
        code: 'ADMIN_NOT_FOUND',
        message: 'The administrator was not found.',
        statusCode: 404,
      })
    }
    if (await verifyPassword(user.passwordHash, credentials.newPassword)) {
      throw passwordUnchangedError()
    }

    const passwordHash = await hashPassword(credentials.newPassword)
    await updatePasswordAndRevokeSessions(client, user.id, passwordHash, false)
    return { id: user.id, username: user.username }
  }, database)
}
