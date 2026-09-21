import { calculateMatterStatus } from './calculateMatterStatus.js'

function createSections(matterId, matterType) {
  return (matterType.sections ?? []).map((section) => ({
    id: `${matterId}-${section.id}`,
    templateSectionId: section.id,
    name: section.name,
  }))
}

function createDocument(matterId, definition, sectionIds, updatedAt) {
  return {
    ...definition,
    id: `${matterId}-${definition.id}`,
    templateDocumentId: definition.id,
    sectionId: sectionIds.get(definition.sectionId) ?? null,
    status: 'Pending',
    receivedQuantity: definition.expectedQuantity === null ? null : 0,
    comment: '',
    updatedBy: 'System',
    updatedAt,
  }
}

export function createMatterSnapshot(matterId, matterType, updatedAt) {
  const sections = createSections(matterId, matterType)
  const sectionIds = new Map(
    sections.map((section) => [section.templateSectionId, section.id]),
  )

  return {
    sections,
    documents: matterType.documents.map((definition) =>
      createDocument(matterId, definition, sectionIds, updatedAt),
    ),
    previousDocuments: [],
  }
}

export function synchronizeMatterRecord(matterId, record, matterType, updatedAt) {
  const snapshot = createMatterSnapshot(matterId, matterType, updatedAt)
  const existingByTemplateId = new Map(
    record.documents.map((document) => [document.templateDocumentId, document]),
  )
  const activeTemplateIds = new Set(matterType.documents.map((document) => document.id))
  const oldSectionNames = new Map(record.sections.map((section) => [section.id, section.name]))

  const documents = snapshot.documents.map((definition) => {
    const existing = existingByTemplateId.get(definition.templateDocumentId)
    if (!existing) return definition

    // Definitions follow the template. Tracking belongs to the matter forever.
    return {
      ...definition,
      id: existing.id,
      status: existing.status,
      receivedQuantity: existing.receivedQuantity ?? definition.receivedQuantity,
      comment: existing.comment,
      updatedBy: existing.updatedBy,
      updatedAt: existing.updatedAt,
    }
  })
  const removedDocuments = record.documents
    .filter((document) => !activeTemplateIds.has(document.templateDocumentId))
    .map((document) => ({
      ...document,
      previousSectionName: oldSectionNames.get(document.sectionId) ?? 'General documents',
      removedAt: updatedAt,
    }))

  return {
    ...record,
    sections: snapshot.sections,
    documents,
    previousDocuments: [...(record.previousDocuments ?? []), ...removedDocuments],
  }
}

// Commit template definitions, checklists, and automatic statuses together.
export function applyTemplateChanges(data, nextMatterTypes, updatedAt) {
  const oldTypes = new Map(data.matterTypes.map((type) => [type.id, type]))
  const changedTypes = new Map(nextMatterTypes
    .filter((type) => {
      const previous = oldTypes.get(type.id)
      return previous && (
        previous.documents !== type.documents || previous.sections !== type.sections
      )
    })
    .map((type) => [type.id, type]))
  const matterRecords = { ...data.matterRecords }
  const matters = data.matters.map((matter) => {
    const type = changedTypes.get(matter.matterTypeId)
    if (!type) return matter

    const record = synchronizeMatterRecord(
      matter.id, data.matterRecords[matter.id], type, updatedAt,
    )
    const status = matter.statusSource === 'Automatic'
      ? calculateMatterStatus(record.documents)
      : matter.status
    const statusChanged = status !== matter.status

    if (statusChanged) {
      record.history = [{
        id: `${matter.id}-template-${updatedAt}-${record.history.length}`,
        fromStatus: matter.status,
        toStatus: status,
        changedBy: 'System',
        changedAt: updatedAt,
        source: 'Automatic',
        reason: 'Template updated',
      }, ...record.history]
    }

    matterRecords[matter.id] = record
    return {
      ...matter,
      status,
      statusUpdatedAt: statusChanged ? updatedAt : matter.statusUpdatedAt,
      updatedAt: updatedAt.slice(0, 10),
    }
  })

  return { ...data, matterTypes: nextMatterTypes, matters, matterRecords }
}
