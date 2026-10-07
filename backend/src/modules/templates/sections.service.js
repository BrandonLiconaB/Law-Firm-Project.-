import { pool } from '../../db/pool.js'
import { mutateTemplate, moveItemIds, templateError } from './templates.service.js'
import { moveTemplateItemSchema, sectionSchema } from './template.validation.js'
import {
  findSection, insertSection, listSections, renameSection, reorderSections, retireSection,
} from './sections.repository.js'
import {
  listGroupDocuments, moveSectionDocumentsToGeneral, reorderDocuments,
} from './documents.repository.js'

export async function requireSection(client, matterTypeId, sectionId) {
  const section = await findSection(client, matterTypeId, sectionId)
  if (!section) throw templateError('TEMPLATE_SECTION_NOT_FOUND', 'The template section was not found.')
  return section
}

export async function createSection(matterTypeId, input, database = pool) {
  const { name } = sectionSchema.parse(input)
  return mutateTemplate(matterTypeId, async (client) => {
    const sections = await listSections(client, matterTypeId)
    return { entity: await insertSection(client, matterTypeId, name, sections.length + 1) }
  }, database)
}

export async function updateSection(matterTypeId, sectionId, input, database = pool) {
  const { name } = sectionSchema.parse(input)
  return mutateTemplate(matterTypeId, async (client) => {
    const section = await requireSection(client, matterTypeId, sectionId)
    if (section.name === name) return { entity: section, changed: false }
    return { entity: await renameSection(client, matterTypeId, sectionId, name) }
  }, database)
}

export async function deleteSection(matterTypeId, sectionId, database = pool) {
  return mutateTemplate(matterTypeId, async (client) => {
    await requireSection(client, matterTypeId, sectionId)
    const general = await listGroupDocuments(client, matterTypeId, null)
    const moving = await listGroupDocuments(client, matterTypeId, sectionId)
    await moveSectionDocumentsToGeneral(client, matterTypeId, sectionId)
    await reorderDocuments(client, matterTypeId, [...general, ...moving].map((document) => document.id))
    await retireSection(client, matterTypeId, sectionId)
    const remaining = await listSections(client, matterTypeId)
    await reorderSections(client, matterTypeId, remaining.map((section) => section.id))
    return {}
  }, database)
}

export async function moveSection(matterTypeId, sectionId, input, database = pool) {
  const { direction } = moveTemplateItemSchema.parse(input)
  return mutateTemplate(matterTypeId, async (client) => {
    await requireSection(client, matterTypeId, sectionId)
    const sections = await listSections(client, matterTypeId)
    await reorderSections(client, matterTypeId, moveItemIds(sections, sectionId, direction))
    return { entity: await findSection(client, matterTypeId, sectionId) }
  }, database)
}
