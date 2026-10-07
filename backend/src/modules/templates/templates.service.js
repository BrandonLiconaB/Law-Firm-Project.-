import { pool } from '../../db/pool.js'
import { withTransaction } from '../../db/transaction.js'
import { AppError } from '../../shared/AppError.js'
import { findTemplate, incrementTemplateRevision, lockTemplate } from './templates.repository.js'

export function templateError(code, message, statusCode = 404, fields) {
  return new AppError({ code, message, statusCode, fields })
}

export async function getTemplate(matterTypeId, database = pool) {
  const template = await findTemplate(database, matterTypeId)
  if (!template) throw templateError('MATTER_TYPE_NOT_FOUND', 'The matter type was not found.')
  return template
}

export async function mutateTemplate(matterTypeId, operation, database = pool) {
  try {
    return await withTransaction(async (client) => {
      const template = await lockTemplate(client, matterTypeId)
      if (!template) throw templateError('MATTER_TYPE_NOT_FOUND', 'The matter type was not found.')
      const result = await operation(client)
      const templateRevision = result.changed === false
        ? template.templateRevision
        : await incrementTemplateRevision(client, matterTypeId)
      return { entity: result.entity, templateRevision }
    }, database)
  } catch (error) {
    const names = {
      template_sections_name_active_idx: ['TEMPLATE_SECTION_NAME_ALREADY_EXISTS', 'section'],
      template_documents_name_active_idx: ['TEMPLATE_DOCUMENT_NAME_ALREADY_EXISTS', 'document'],
    }
    const conflict = error.code === '23505' && names[error.constraint]
    if (conflict) {
      throw templateError(conflict[0], `That ${conflict[1]} name is already in this template.`, 409, {
        name: `This ${conflict[1]} name is already in this template.`,
      })
    }
    throw error
  }
}

export function moveItemIds(items, itemId, direction) {
  const index = items.findIndex((item) => item.id === itemId)
  const target = index + (direction === 'up' ? -1 : 1)
  if (index < 0 || target < 0 || target >= items.length) {
    throw templateError('TEMPLATE_MOVE_OUT_OF_RANGE', 'The item cannot move in that direction.', 400)
  }
  const ids = items.map((item) => item.id)
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  return ids
}
