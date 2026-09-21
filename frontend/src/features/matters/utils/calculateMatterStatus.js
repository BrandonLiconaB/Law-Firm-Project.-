export function calculateMatterStatus(documents) {
  // An empty or unfinished template must never make a matter ready by default.
  if (!documents.some((document) => document.isKey)) {
    return 'Pending Documents'
  }

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
