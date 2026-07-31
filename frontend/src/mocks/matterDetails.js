import { AUTOMATIC_MATTER_STATUSES } from '../features/matters/constants/matterStatuses.js'

const baseDocuments = [
  {
    id: 'passport-copy',
    name: 'Passport biographic page',
    description: 'Clear copy of the current passport biographic page.',
    isKey: true,
    status: 'Pending',
    expectedQuantity: null,
    receivedQuantity: null,
    comment: '',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T09:30:00',
  },
  {
    id: 'birth-certificate',
    name: 'Birth certificate',
    description: 'Birth certificate and certified translation, when required.',
    isKey: true,
    status: 'Received',
    expectedQuantity: null,
    receivedQuantity: null,
    comment: 'Copy received and verified for legibility.',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T10:10:00',
  },
  {
    id: 'i-94',
    name: 'Form I-94',
    description: 'Most recent arrival and departure record.',
    isKey: true,
    status: 'Received',
    expectedQuantity: null,
    receivedQuantity: null,
    comment: '',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T10:25:00',
  },
  {
    id: 'marriage-certificate',
    name: 'Marriage certificate',
    description: 'Marriage certificate for the petitioner and beneficiary.',
    isKey: true,
    status: 'Received',
    expectedQuantity: null,
    receivedQuantity: null,
    comment: '',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T11:05:00',
  },
  {
    id: 'lease-agreement',
    name: 'Lease agreement',
    description: 'Current lease or other evidence of shared residence.',
    isKey: false,
    status: 'Not Applicable',
    expectedQuantity: null,
    receivedQuantity: null,
    comment: 'Client owns the residence and does not have a lease agreement.',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T11:20:00',
  },
  {
    id: 'support-letters',
    name: 'Support letters',
    description: 'Letters from family members, friends, or community contacts.',
    isKey: false,
    status: 'Received',
    expectedQuantity: 10,
    receivedQuantity: 6,
    comment: 'Received six letters. The client does not expect to obtain the remaining four.',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T13:40:00',
  },
  {
    id: 'tax-returns',
    name: 'Tax returns',
    description: 'Most recent federal tax returns.',
    isKey: false,
    status: 'Client Does Not Have',
    expectedQuantity: 3,
    receivedQuantity: 0,
    comment: 'Client does not have copies available at this time.',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T14:05:00',
  },
  {
    id: 'passport-photos',
    name: 'Passport photos',
    description: 'Recent passport-style photographs.',
    isKey: false,
    status: 'Pending',
    expectedQuantity: 4,
    receivedQuantity: 0,
    comment: '',
    updatedBy: 'Administrator',
    updatedAt: '2026-07-15T14:20:00',
  },
]

export function getMockMatterDocuments(matterStatus) {
  const shouldResolveKeyDocuments = matterStatus !== 'Pending Documents'
  const shouldResolveAllDocuments =
    matterStatus === 'Ready to Draft' || !AUTOMATIC_MATTER_STATUSES.includes(matterStatus)

  return baseDocuments.map((document) => {
    const shouldResolveDocument =
      (shouldResolveKeyDocuments && document.isKey) ||
      (shouldResolveAllDocuments && document.status === 'Pending')

    if (!shouldResolveDocument || document.status !== 'Pending') {
      return { ...document }
    }

    return {
      ...document,
      status: 'Received',
      receivedQuantity: document.expectedQuantity ?? document.receivedQuantity,
    }
  })
}

export function getMockMatterHistory(matter) {
  const createdEntry = {
    id: `${matter.id}-created`,
    fromStatus: null,
    toStatus: 'Pending Documents',
    changedBy: 'Administrator',
    changedAt: '2026-07-08T09:00:00',
    source: 'Manual',
  }

  if (matter.status === 'Pending Documents') {
    return [createdEntry]
  }

  return [
    {
      id: `${matter.id}-current`,
      fromStatus: 'Pending Documents',
      toStatus: matter.status,
      changedBy: AUTOMATIC_MATTER_STATUSES.includes(matter.status)
        ? 'System'
        : 'Administrator',
      changedAt: `${matter.updatedAt}T14:30:00`,
      source: AUTOMATIC_MATTER_STATUSES.includes(matter.status) ? 'Automatic' : 'Manual',
    },
    createdEntry,
  ]
}
