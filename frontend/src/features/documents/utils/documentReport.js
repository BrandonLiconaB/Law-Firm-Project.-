import { DOCUMENT_STATUSES } from '../constants/documentStatuses.js'

export function countDocumentStatuses(documents) {
  const counts = Object.fromEntries(DOCUMENT_STATUSES.map((status) => [status, 0]))
  for (const document of documents) {
    if (Object.hasOwn(counts, document.status)) counts[document.status] += 1
  }
  return counts
}

export function formatDocumentQuantity(document) {
  if (document.expectedQuantity === null) {
    return document.receivedQuantity === null
      ? 'Not counted'
      : `${document.receivedQuantity} previously recorded; not counted`
  }
  return `${document.receivedQuantity || 0} of ${document.expectedQuantity}`
}

export function formatReportDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
