export const DOCUMENT_STATUSES = [
  'Pending',
  'Received',
  'Client Does Not Have',
  'Not Applicable',
]

export function isDocumentResolved(status) {
  return status !== 'Pending'
}
