import { pool } from '../../db/pool.js'
import { mutateTemplate, moveItemIds, templateError } from './templates.service.js'
import { findSection } from './sections.repository.js'
import {
  createTemplateDocumentSchema, moveTemplateItemSchema, updateTemplateDocumentSchema,
} from './template.validation.js'
import {
  findDocument, insertDocument, listGroupDocuments, reorderDocuments, retireDocument, updateDocument,
} from './documents.repository.js'

async function requireDocument(client, matterTypeId, documentId) {
  const document = await findDocument(client, matterTypeId, documentId)
  if (!document) throw templateError('TEMPLATE_DOCUMENT_NOT_FOUND', 'The template document was not found.')
  return document
}

async function validateSection(client, matterTypeId, sectionId) {
  if (sectionId !== null && !(await findSection(client, matterTypeId, sectionId))) {
    throw templateError('INVALID_TEMPLATE_SECTION', 'Choose a current section from this template.', 400, {
      sectionId: 'The section does not belong to this current template.',
    })
  }
}

export async function createDocument(matterTypeId, input, database = pool) {
  const document = createTemplateDocumentSchema.parse(input)
  return mutateTemplate(matterTypeId, async (client) => {
    await validateSection(client, matterTypeId, document.sectionId)
    const group = await listGroupDocuments(client, matterTypeId, document.sectionId)
    return { entity: await insertDocument(client, matterTypeId, { ...document, position: group.length + 1 }) }
  }, database)
}

export async function updateTemplateDocument(matterTypeId, documentId, input, database = pool) {
  const validated = updateTemplateDocumentSchema.parse(input)
  const changes = Object.fromEntries(Object.entries(validated).filter(([, value]) => value !== undefined))
  return mutateTemplate(matterTypeId, async (client) => {
    const current = await requireDocument(client, matterTypeId, documentId)
    const changed = Object.entries(changes).some(([key, value]) => value !== undefined && current[key] !== value)
    if (!changed) return { entity: current, changed: false }
    const next = { ...current, ...changes }
    await validateSection(client, matterTypeId, next.sectionId)
    const sectionChanged = next.sectionId !== current.sectionId
    if (sectionChanged) {
      const destination = await listGroupDocuments(client, matterTypeId, next.sectionId)
      next.position = destination.length + 1
    }
    const entity = await updateDocument(client, matterTypeId, documentId, next)
    if (sectionChanged) {
      const remaining = await listGroupDocuments(client, matterTypeId, current.sectionId)
      await reorderDocuments(client, matterTypeId, remaining.map((document) => document.id))
    }
    return { entity }
  }, database)
}

export async function deleteDocument(matterTypeId, documentId, database = pool) {
  return mutateTemplate(matterTypeId, async (client) => {
    const document = await requireDocument(client, matterTypeId, documentId)
    await retireDocument(client, matterTypeId, documentId)
    const remaining = await listGroupDocuments(client, matterTypeId, document.sectionId)
    await reorderDocuments(client, matterTypeId, remaining.map((item) => item.id))
    return {}
  }, database)
}

export async function moveDocument(matterTypeId, documentId, input, database = pool) {
  const { direction } = moveTemplateItemSchema.parse(input)
  return mutateTemplate(matterTypeId, async (client) => {
    const document = await requireDocument(client, matterTypeId, documentId)
    const group = await listGroupDocuments(client, matterTypeId, document.sectionId)
    await reorderDocuments(client, matterTypeId, moveItemIds(group, documentId, direction))
    return { entity: await findDocument(client, matterTypeId, documentId) }
  }, database)
}
