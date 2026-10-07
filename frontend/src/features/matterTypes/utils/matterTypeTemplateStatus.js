export const MATTER_TYPE_TEMPLATE_STATUSES = {
  READY: 'Ready',
  TEMPLATE_REQUIRED: 'Template required',
  KEY_DOCUMENT_REQUIRED: 'Key document required',
}

export function getMatterTypeTemplateStatus(matterType) {
  if (matterType?.templateStatus) return matterType.templateStatus
  const documents = matterType?.documents ?? []

  if (documents.length === 0) {
    return MATTER_TYPE_TEMPLATE_STATUSES.TEMPLATE_REQUIRED
  }

  if (!documents.some((document) => document.isKey)) {
    return MATTER_TYPE_TEMPLATE_STATUSES.KEY_DOCUMENT_REQUIRED
  }

  return MATTER_TYPE_TEMPLATE_STATUSES.READY
}

export function getTemplateDocumentCount(matterType) {
  return matterType?.documentCount ?? matterType?.documents?.length ?? 0
}

export function getTemplateKeyCount(matterType) {
  return matterType?.keyDocumentCount ?? matterType?.documents?.filter((document) => document.isKey).length ?? 0
}

export function isMatterTypeReady(matterType) {
  return (
    getMatterTypeTemplateStatus(matterType) ===
    MATTER_TYPE_TEMPLATE_STATUSES.READY
  )
}
