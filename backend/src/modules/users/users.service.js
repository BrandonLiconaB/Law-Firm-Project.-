import { pool } from '../../db/pool.js'
import { withTransaction } from '../../db/transaction.js'
import { AppError } from '../../shared/AppError.js'
import { hashPassword } from '../auth/password.js'
import { USER_ROLES } from './user.constants.js'
import { createUserSchema, initialAdminSchema } from './user.validation.js'
import {
  findAdministrator,
  findUserById,
  findUsersPage,
  insertUser,
} from './users.repository.js'

function administratorAlreadyExistsError() {
  return new AppError({
    code: 'ADMIN_ALREADY_EXISTS',
    message: 'An administrator already exists.',
    statusCode: 409,
  })
}

function usernameAlreadyExistsError() {
  return new AppError({
    code: 'USERNAME_ALREADY_EXISTS',
    message: 'That username is already in use.',
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
      throw usernameAlreadyExistsError()
    }

    throw error
  }
}

export async function createMemberUser(input, database = pool) {
  const user = createUserSchema.parse(input)
  const passwordHash = await hashPassword(user.password)

  try {
    return await insertUser(database, {
      username: user.username,
      fullName: user.fullName,
      passwordHash,
      systemRole: USER_ROLES.MEMBER,
    })
  } catch (error) {
    if (
      error.code === '23505' &&
      error.constraint === 'users_username_unique_ci_idx'
    ) {
      throw usernameAlreadyExistsError()
    }
    throw error
  }
}

export async function getUser(id, database = pool) {
  const user = await findUserById(database, id)
  if (!user) {
    throw new AppError({
      code: 'USER_NOT_FOUND',
      message: 'The user was not found.',
      statusCode: 404,
    })
  }
  return user
}

export async function listUsers({ page, limit }, database = pool) {
  const result = await findUsersPage(database, {
    limit,
    offset: (page - 1) * limit,
  })
  return {
    data: result.users,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  }
}
