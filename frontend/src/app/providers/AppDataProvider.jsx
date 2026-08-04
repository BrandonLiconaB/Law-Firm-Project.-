import { useState } from 'react'
import {
  cleanMatterTypeName,
  isMatterTypeNameDuplicate,
} from '../../features/matterTypes/utils/normalizeMatterTypeName.js'
import { isMatterTypeReady } from '../../features/matterTypes/utils/matterTypeTemplateStatus.js'
import {
  cleanMatterName,
  isMatterNameDuplicate,
} from '../../features/matters/utils/normalizeMatterName.js'
import {
  cleanTemplateDocumentName,
  isTemplateDocumentNameDuplicate,
} from '../../features/templates/utils/normalizeTemplateDocumentName.js'
import {
  cleanUserName,
  isUserEmailDuplicate,
  isUserEmailValid,
  normalizeUserEmail,
} from '../../features/users/utils/userValidation.js'
import {
  getMockMatterDocuments,
  getMockMatterHistory,
} from '../../mocks/matterDetails.js'
import { matterTypes as initialMatterTypes } from '../../mocks/matterTypes.js'
import { matters as initialMatters } from '../../mocks/matters.js'
import { users as initialUsers } from '../../mocks/users.js'
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

function createInitialMatterTypes() {
  return initialMatterTypes.map((matterType) => ({
    ...matterType,
    documents: matterType.documents.map((document) => ({ ...document })),
  }))
}

function createDocumentsFromMatterType(matterId, matterType, updatedAt) {
  return matterType.documents.map((document) => ({
    ...document,
    id: `${matterId}-${document.id}`,
    status: 'Pending',
    receivedQuantity: document.expectedQuantity === null ? null : 0,
    comment: '',
    updatedBy: 'Administrator',
    updatedAt,
  }))
}

function AppDataProvider({ children }) {
  const [matterTypes, setMatterTypes] = useState(createInitialMatterTypes)
  const [matters, setMatters] = useState(() =>
    initialMatters.map((matter) => ({ ...matter })),
  )
  const [matterRecords, setMatterRecords] = useState(createInitialMatterRecords)
  const [users, setUsers] = useState(() =>
    initialUsers.map((user) => ({ ...user })),
  )

  function createMatter({ matterName, matterTypeId }) {
    const matterType = matterTypes.find((type) => type.id === matterTypeId)
    const cleanedMatterName = cleanMatterName(matterName)

    if (
      !matterType ||
      !isMatterTypeReady(matterType) ||
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
      matterTypeId: matterType.id,
      status: 'Pending Documents',
      statusSource: 'Automatic',
      statusUpdatedAt: now,
      updatedAt: now.slice(0, 10),
    }
    const documents = createDocumentsFromMatterType(
      matterId,
      matterType,
      now,
    )
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

  function updateMatterDetails(matterId, { matterName, matterTypeId }) {
    const currentMatter = matters.find((matter) => matter.id === matterId)
    const currentRecord = matterRecords[matterId]
    const nextMatterType = matterTypes.find(
      (matterType) => matterType.id === matterTypeId,
    )
    const cleanedMatterName = cleanMatterName(matterName)
    const matterTypeChanged = currentMatter?.matterTypeId !== matterTypeId

    if (
      !currentMatter ||
      !currentRecord ||
      !nextMatterType ||
      !cleanedMatterName ||
      isMatterNameDuplicate(matters, cleanedMatterName, matterId) ||
      (matterTypeChanged && !isMatterTypeReady(nextMatterType))
    ) {
      return null
    }

    const now = new Date().toISOString()
    const updatedMatter = matterTypeChanged
      ? {
          ...currentMatter,
          matterName: cleanedMatterName,
          matterTypeId: nextMatterType.id,
          status: 'Pending Documents',
          statusSource: 'Automatic',
          statusUpdatedAt: now,
          updatedAt: now.slice(0, 10),
        }
      : {
          ...currentMatter,
          matterName: cleanedMatterName,
          updatedAt: now.slice(0, 10),
        }

    setMatters((currentMatters) =>
      currentMatters.map((matter) =>
        matter.id === matterId ? updatedMatter : matter,
      ),
    )

    if (matterTypeChanged) {
      const statusResetEntry =
        currentMatter.status === 'Pending Documents'
          ? []
          : [
              {
                id: `${matterId}-type-reset-${Date.now()}`,
                fromStatus: currentMatter.status,
                toStatus: 'Pending Documents',
                changedBy: 'Administrator',
                changedAt: now,
                source: 'Manual',
              },
            ]

      setMatterRecords((currentRecords) => ({
        ...currentRecords,
        [matterId]: {
          documents: createDocumentsFromMatterType(
            matterId,
            nextMatterType,
            now,
          ),
          history: [
            ...statusResetEntry,
            ...currentRecord.history.map((entry) => ({ ...entry })),
          ],
        },
      }))
    }

    return {
      matter: updatedMatter,
      matterTypeChanged,
    }
  }

  function createMatterType({ name, description }) {
    const cleanedName = cleanMatterTypeName(name)

    if (
      !cleanedName ||
      isMatterTypeNameDuplicate(matterTypes, cleanedName)
    ) {
      return null
    }

    const matterType = {
      id: `matter-type-${Date.now()}`,
      name: cleanedName,
      description: description.trim(),
      documents: [],
    }

    setMatterTypes((currentMatterTypes) => [
      ...currentMatterTypes,
      matterType,
    ])
    return matterType
  }

  function updateMatterType(matterTypeId, { name, description }) {
    const currentMatterType = matterTypes.find(
      (matterType) => matterType.id === matterTypeId,
    )
    const cleanedName = cleanMatterTypeName(name)

    if (
      !currentMatterType ||
      !cleanedName ||
      isMatterTypeNameDuplicate(matterTypes, cleanedName, matterTypeId)
    ) {
      return null
    }

    const updatedMatterType = {
      ...currentMatterType,
      name: cleanedName,
      description: description.trim(),
    }

    setMatterTypes((currentMatterTypes) =>
      currentMatterTypes.map((matterType) =>
        matterType.id === matterTypeId ? updatedMatterType : matterType,
      ),
    )
    return updatedMatterType
  }

  function createTemplateDocument(matterTypeId, documentData) {
    const matterType = matterTypes.find(
      (currentMatterType) => currentMatterType.id === matterTypeId,
    )
    const cleanedName = cleanTemplateDocumentName(documentData.name)
    const hasValidQuantity =
      documentData.expectedQuantity === null ||
      (Number.isInteger(documentData.expectedQuantity) &&
        documentData.expectedQuantity > 0)

    if (
      !matterType ||
      !cleanedName ||
      !hasValidQuantity ||
      isTemplateDocumentNameDuplicate(matterType.documents, cleanedName)
    ) {
      return null
    }

    const document = {
      id: `${matterTypeId}-document-${Date.now()}`,
      name: cleanedName,
      description: documentData.description.trim(),
      isKey: documentData.isKey,
      expectedQuantity: documentData.expectedQuantity,
    }

    setMatterTypes((currentMatterTypes) =>
      currentMatterTypes.map((currentMatterType) =>
        currentMatterType.id === matterTypeId
          ? {
              ...currentMatterType,
              documents: [...currentMatterType.documents, document],
            }
          : currentMatterType,
      ),
    )
    return document
  }

  function updateTemplateDocument(matterTypeId, documentId, documentData) {
    const matterType = matterTypes.find(
      (currentMatterType) => currentMatterType.id === matterTypeId,
    )
    const currentDocument = matterType?.documents.find(
      (document) => document.id === documentId,
    )
    const cleanedName = cleanTemplateDocumentName(documentData.name)
    const hasValidQuantity =
      documentData.expectedQuantity === null ||
      (Number.isInteger(documentData.expectedQuantity) &&
        documentData.expectedQuantity > 0)

    if (
      !matterType ||
      !currentDocument ||
      !cleanedName ||
      !hasValidQuantity ||
      isTemplateDocumentNameDuplicate(
        matterType.documents,
        cleanedName,
        documentId,
      )
    ) {
      return null
    }

    const updatedDocument = {
      ...currentDocument,
      name: cleanedName,
      description: documentData.description.trim(),
      isKey: documentData.isKey,
      expectedQuantity: documentData.expectedQuantity,
    }

    setMatterTypes((currentMatterTypes) =>
      currentMatterTypes.map((currentMatterType) =>
        currentMatterType.id === matterTypeId
          ? {
              ...currentMatterType,
              documents: currentMatterType.documents.map((document) =>
                document.id === documentId ? updatedDocument : document,
              ),
            }
          : currentMatterType,
      ),
    )
    return updatedDocument
  }

  function deleteTemplateDocument(matterTypeId, documentId) {
    const matterType = matterTypes.find(
      (currentMatterType) => currentMatterType.id === matterTypeId,
    )
    const documentExists = matterType?.documents.some(
      (document) => document.id === documentId,
    )

    if (!matterType || !documentExists) {
      return false
    }

    setMatterTypes((currentMatterTypes) =>
      currentMatterTypes.map((currentMatterType) =>
        currentMatterType.id === matterTypeId
          ? {
              ...currentMatterType,
              documents: currentMatterType.documents.filter(
                (document) => document.id !== documentId,
              ),
            }
          : currentMatterType,
      ),
    )
    return true
  }

  function moveTemplateDocument(matterTypeId, documentId, direction) {
    const matterType = matterTypes.find(
      (currentMatterType) => currentMatterType.id === matterTypeId,
    )
    const currentIndex = matterType?.documents.findIndex(
      (document) => document.id === documentId,
    )
    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (
      !matterType ||
      currentIndex === undefined ||
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= matterType.documents.length
    ) {
      return false
    }

    const reorderedDocuments = [...matterType.documents]
    const [document] = reorderedDocuments.splice(currentIndex, 1)
    reorderedDocuments.splice(targetIndex, 0, document)

    setMatterTypes((currentMatterTypes) =>
      currentMatterTypes.map((currentMatterType) =>
        currentMatterType.id === matterTypeId
          ? { ...currentMatterType, documents: reorderedDocuments }
          : currentMatterType,
      ),
    )
    return true
  }

  function createUser({ name, email }) {
    const cleanedName = cleanUserName(name)
    const normalizedEmail = normalizeUserEmail(email)

    if (
      !cleanedName ||
      !isUserEmailValid(normalizedEmail) ||
      isUserEmailDuplicate(users, normalizedEmail)
    ) {
      return null
    }

    const user = {
      id: `user-${Date.now()}`,
      name: cleanedName,
      email: normalizedEmail,
    }

    setUsers((currentUsers) => [...currentUsers, user])
    return user
  }

  function updateUser(userId, { name, email }) {
    const currentUser = users.find((user) => user.id === userId)
    const cleanedName = cleanUserName(name)
    const normalizedEmail = normalizeUserEmail(email)

    if (
      !currentUser ||
      !cleanedName ||
      !isUserEmailValid(normalizedEmail) ||
      isUserEmailDuplicate(users, normalizedEmail, userId)
    ) {
      return null
    }

    const updatedUser = {
      ...currentUser,
      name: cleanedName,
      email: normalizedEmail,
    }

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId ? updatedUser : user,
      ),
    )
    return updatedUser
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
    matterTypes,
    matters,
    matterRecords,
    users,
    createMatter,
    updateMatterDetails,
    createMatterType,
    updateMatterType,
    createTemplateDocument,
    updateTemplateDocument,
    deleteTemplateDocument,
    moveTemplateDocument,
    createUser,
    updateUser,
    saveMatterChanges,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export default AppDataProvider
