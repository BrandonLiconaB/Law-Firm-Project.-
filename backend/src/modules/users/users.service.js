import { pool } from '../../db/pool.js'
import { withTransaction } from '../../db/transaction.js'
import { AppError } from '../../shared/AppError.js'
import { hashPassword } from '../auth/password.js'
import { USER_ROLES } from './user.constants.js'
import { initialAdminSchema } from './user.validation.js'
import { findAdministrator, insertUser } from './users.repository.js'

function administratorAlreadyExistsError() {
  return new AppError({
    code: 'ADMIN_ALREADY_EXISTS',
    message: 'An administrator already exists.',
    statusCode: 409,
  })
}

export async function administratorExists(database = pool) {
  return Boolean(await findAdministrator(database))
}

export async function createInitialAdministrator(input, database = pool) {
  const administrator = initialAdminSchema.parse(input)

  if (await administratorExists(database)) {
    throw administratorAlreadyExistsError()
  }

  const passwordHash = await hashPassword(administrator.password)

  try {
    return await withTransaction(async (client) => {
      if (await findAdministrator(client)) {
        throw administratorAlreadyExistsError()
      }

      return insertUser(client, {
        username: administrator.username,
        fullName: administrator.fullName,
        passwordHash,
        systemRole: USER_ROLES.ADMIN,
      })
    }, database)
  } catch (error) {
    if (
      error.code === '23505' &&
      error.constraint === 'users_single_admin_idx'
    ) {
      throw administratorAlreadyExistsError()
    }

    if (
      error.code === '23505' &&
      error.constraint === 'users_username_unique_ci_idx'
    ) {
      throw new AppError({
        code: 'USERNAME_ALREADY_EXISTS',
        message: 'That username is already in use.',
        statusCode: 409,
      })
    }

    throw error
  }
}
