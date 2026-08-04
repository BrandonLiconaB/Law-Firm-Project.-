export function cleanTemplateDocumentName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeTemplateDocumentName(value) {
  return cleanTemplateDocumentName(value).toLowerCase()
}

export function isTemplateDocumentNameDuplicate(
  documents,
  documentName,
  excludedDocumentId = null,
) {
  const normalizedDocumentName = normalizeTemplateDocumentName(documentName)

  return documents.some(
    (document) =>
      document.id !== excludedDocumentId &&
      normalizeTemplateDocumentName(document.name) === normalizedDocumentName,
  )
}
