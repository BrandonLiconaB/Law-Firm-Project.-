export function calculateMatterStatus(documents) {
  const hasPendingKeyDocument = documents.some(
    (document) => document.isKey && document.status === 'Pending',
  )

  if (hasPendingKeyDocument) {
    return 'Pending Documents'
  }

  const hasPendingDocument = documents.some((document) => document.status === 'Pending')

  if (hasPendingDocument) {
    return 'Ready to Start Drafting'
  }

  return 'Ready to Draft'
}
