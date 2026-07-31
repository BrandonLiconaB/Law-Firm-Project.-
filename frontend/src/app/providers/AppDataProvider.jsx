import { useState } from 'react'
import {
  cleanMatterName,
  isMatterNameDuplicate,
} from '../../features/matters/utils/normalizeMatterName.js'
import {
  getMockMatterDocuments,
  getMockMatterHistory,
} from '../../mocks/matterDetails.js'
import { matterTypes } from '../../mocks/matterTypes.js'
import { matters as initialMatters } from '../../mocks/matters.js'
import { AppDataContext } from './AppDataContext.js'

function createInitialMatterRecords() {
  return Object.fromEntries(
    initialMatters.map((matter) => [
      matter.id,
      {
        documents: getMockMatterDocuments(matter.status),
        history: getMockMatterHistory(matter),
      },
    ]),
  )
}

function AppDataProvider({ children }) {
  const [matters, setMatters] = useState(() =>
    initialMatters.map((matter) => ({ ...matter })),
  )
  const [matterRecords, setMatterRecords] = useState(createInitialMatterRecords)

  function createMatter({ matterName, matterTypeId }) {
    const matterType = matterTypes.find((type) => type.id === matterTypeId)
    const cleanedMatterName = cleanMatterName(matterName)

    if (
      !matterType ||
      !cleanedMatterName ||
      isMatterNameDuplicate(matters, cleanedMatterName)
    ) {
      return null
    }

    const now = new Date().toISOString()
    const matterId = `matter-${Date.now()}`
    const matter = {
      id: matterId,
      matterName: cleanedMatterName,
      matterType: matterType.name,
      status: 'Pending Documents',
      statusSource: 'Automatic',
      statusUpdatedAt: now,
      updatedAt: now.slice(0, 10),
    }
    const documents = matterType.documents.map((document) => ({
      ...document,
      id: `${matterId}-${document.id}`,
      status: 'Pending',
      receivedQuantity: document.expectedQuantity === null ? null : 0,
      comment: '',
      updatedBy: 'Administrator',
      updatedAt: now,
    }))
    const history = [
      {
        id: `${matterId}-created`,
        fromStatus: null,
        toStatus: 'Pending Documents',
        changedBy: 'System',
        changedAt: now,
        source: 'Automatic',
      },
    ]

    setMatters((currentMatters) => [matter, ...currentMatters])
    setMatterRecords((currentRecords) => ({
      ...currentRecords,
      [matterId]: {
        documents,
        history,
      },
    }))

    return matter
  }

  function saveMatterChanges(matterId, changes) {
    const now = new Date().toISOString()

    setMatters((currentMatters) =>
      currentMatters.map((matter) =>
        matter.id === matterId
          ? {
              ...matter,
              status: changes.status,
              statusSource: changes.statusSource,
              statusUpdatedAt: changes.statusUpdatedAt,
              updatedAt: now.slice(0, 10),
            }
          : matter,
      ),
    )

    setMatterRecords((currentRecords) => ({
      ...currentRecords,
      [matterId]: {
        documents: changes.documents.map((document) => ({ ...document })),
        history: changes.history.map((entry) => ({ ...entry })),
      },
    }))
  }

  const value = {
    matters,
    matterRecords,
    createMatter,
    saveMatterChanges,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export default AppDataProvider
