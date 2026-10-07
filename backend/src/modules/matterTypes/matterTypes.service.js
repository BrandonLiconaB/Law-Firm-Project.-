import { pool } from '../../db/pool.js'
import { withTransaction } from '../../db/transaction.js'
import { AppError } from '../../shared/AppError.js'
import { createMatterTypeSchema, updateMatterTypeSchema } from './matterType.validation.js'
import {
  findMatterTypeById,
  findMatterTypesPage,
  insertMatterType,
  updateMatterTypeById,
} from './matterTypes.repository.js'

function matterTypeNotFoundError() {
  return new AppError({
    code: 'MATTER_TYPE_NOT_FOUND',
    message: 'The matter type was not found.',
    statusCode: 404,
  })
}

function rethrowWriteError(error) {
  if (error.code === '23505' && error.constraint === 'matter_types_name_unique_ci_idx') {
    throw new AppError({
      code: 'MATTER_TYPE_NAME_ALREADY_EXISTS',
      message: 'That matter type name is already in use.',
      statusCode: 409,
      fields: { name: 'This matter type name is already in use.' },
    })
  }
  throw error
}

export async function createMatterType(input, database = pool) {
  const matterType = createMatterTypeSchema.parse(input)
  try {
    return await withTransaction(async (client) => {
      const created = await insertMatterType(client, matterType)
      return findMatterTypeById(client, created.id)
    }, database)
  } catch (error) {
    rethrowWriteError(error)
  }
}

export async function updateMatterType(id, input, database = pool) {
  const changes = updateMatterTypeSchema.parse(input)
  try {
    return await withTransaction(async (client) => {
      const matterType = await updateMatterTypeById(client, id, changes)
      if (!matterType) throw matterTypeNotFoundError()
      return findMatterTypeById(client, id)
    }, database)
  } catch (error) {
    rethrowWriteError(error)
  }
}

export async function getMatterType(id, database = pool) {
  const matterType = await findMatterTypeById(database, id)
  if (!matterType) throw matterTypeNotFoundError()
  return matterType
}

export async function listMatterTypes({ page, limit }, database = pool) {
  const result = await findMatterTypesPage(database, {
    limit,
    offset: (page - 1) * limit,
  })
  return {
    data: result.matterTypes,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  }
}
