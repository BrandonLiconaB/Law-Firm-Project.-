export const GENERAL_DOCUMENTS_GROUP_ID = 'general-documents'

export function groupDocumentsBySection(
  documents,
  sections,
  { includeEmptySections = false } = {},
) {
  const availableSections = sections ?? []
  const sectionIds = new Set(availableSections.map((section) => section.id))
  const sectionGroups = availableSections
    .map((section) => ({
      id: section.id,
      name: section.name,
      isGeneral: false,
      documents: documents.filter(
        (document) => document.sectionId === section.id,
      ),
    }))
    .filter((group) => includeEmptySections || group.documents.length > 0)
  const generalDocuments = documents.filter(
    (document) =>
      !document.sectionId || !sectionIds.has(document.sectionId),
  )

  if (generalDocuments.length > 0) {
    sectionGroups.push({
      id: GENERAL_DOCUMENTS_GROUP_ID,
      name: 'General documents',
      isGeneral: true,
      documents: generalDocuments,
    })
  }

  return sectionGroups
}
