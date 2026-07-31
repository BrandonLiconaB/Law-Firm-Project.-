import { useState } from 'react'
import { clients as initialClients } from '../../mocks/clients.js'
import {
  getMockMatterDocuments,
  getMockMatterHistory,
} from '../../mocks/matterDetails.js'
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
  const [clients, setClients] = useState(() =>
    initialClients.map((client) => ({ ...client })),
  )
  const [matters, setMatters] = useState(() =>
    initialMatters.map((matter) => ({ ...matter })),
  )
  const [matterRecords, setMatterRecords] = useState(createInitialMatterRecords)

  function createClient(fullName) {
    const now = new Date().toISOString()
    const client = {
      id: `client-${Date.now()}`,
      fullName: fullName.trim(),
      createdAt: now,
      updatedAt: now,
    }

    setClients((currentClients) => [...currentClients, client])
    return client
  }

  function updateClient(clientId, fullName) {
    const now = new Date().toISOString()

    setClients((currentClients) =>
      currentClients.map((client) =>
        client.id === clientId
          ? { ...client, fullName: fullName.trim(), updatedAt: now }
          : client,
      ),
    )
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
    clients,
    matters,
    matterRecords,
    createClient,
    updateClient,
    saveMatterChanges,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export default AppDataProvider
