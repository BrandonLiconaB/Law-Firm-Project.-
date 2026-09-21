import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanMatterName, isMatterNumberValid, isMatterNameDuplicate } from '../src/features/matters/utils/normalizeMatterName.js'
import { calculateMatterStatus } from '../src/features/matters/utils/calculateMatterStatus.js'
import { applyTemplateChanges, createMatterSnapshot, synchronizeMatterRecord } from '../src/features/matters/utils/synchronizeMatterTemplate.js'
import { countDocumentStatuses, formatDocumentQuantity } from '../src/features/documents/utils/documentReport.js'
import { groupDocumentsBySection } from '../src/features/templates/utils/groupDocumentsBySection.js'
import { matters } from '../src/mocks/matters.js'
import { matterTypes } from '../src/mocks/matterTypes.js'
import { getMockMatterDocuments } from '../src/mocks/matterDetails.js'

const before = '2026-09-19T10:00:00.000Z'
const now = '2026-09-20T10:00:00.000Z'

function fixture(status = 'Ready to Draft', statusSource = 'Automatic') {
  const type = {
    id: 'family', name: 'Family',
    sections: [{ id: 'petitioner', name: 'Petitioner' }, { id: 'beneficiary', name: 'Beneficiary' }],
    documents: [
      { id: 'letters', name: 'Letters', description: 'Original', isKey: true, expectedQuantity: 10, sectionId: 'petitioner' },
      { id: 'passport', name: 'Passport', description: '', isKey: false, expectedQuantity: null, sectionId: 'beneficiary' },
    ],
  }
  const snapshot = createMatterSnapshot('matter-1', type, before)
  snapshot.documents = snapshot.documents.map((document) => ({
    ...document, status: 'Received',
    receivedQuantity: document.expectedQuantity === null ? null : 6,
    comment: 'Received six letters. Keep this note.', updatedBy: 'Alex',
  }))
  const record = { ...snapshot, history: [{ id: 'history', toStatus: status }] }
  const matter = { id: 'matter-1', matterName: '001234', matterTypeId: 'family', status, statusSource, statusUpdatedAt: before, updatedAt: before.slice(0, 10) }
  const data = { matterTypes: [type], matters: [matter], matterRecords: { 'matter-1': record } }
  return { type, record, matter, data }
}

function deepFreeze(value) {
  Object.freeze(value)
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) deepFreeze(item)
  }
  return value
}

test('matter numbers accept exactly six ASCII digits and preserve zeros', () => {
  for (const value of ['432142', '239845', '001234', '000000']) assert.ok(isMatterNumberValid(value))
  for (const value of ['', '12345', '1234567', '12 345', '12.345', '12345a', '-12345', '１２３４５６']) {
    assert.equal(isMatterNumberValid(value), false, value)
  }
  assert.equal(cleanMatterName(' 001234 '), '001234')
  assert.equal(cleanMatterName('12 3456'), '12 3456')
  assert.ok(isMatterNameDuplicate([{ id: 'a', matterName: '001234' }], '001234'))
  assert.equal(isMatterNameDuplicate([{ id: 'a', matterName: '001234' }], '001234', 'a'), false)
})

test('new matters start pending with stable template relationships and no archive', () => {
  const { type } = fixture()
  const record = createMatterSnapshot('new', type, now)
  assert.equal(record.sections[0].templateSectionId, 'petitioner')
  assert.equal(record.documents[0].templateDocumentId, 'letters')
  assert.equal(record.documents[0].sectionId, record.sections[0].id)
  assert.equal(record.documents[0].receivedQuantity, 0)
  assert.equal(record.documents[1].receivedQuantity, null)
  assert.ok(record.documents.every((document) => document.status === 'Pending' && document.comment === ''))
  assert.deepEqual(record.previousDocuments, [])
})

test('renaming, moving, reordering and changing definitions preserves all tracking', () => {
  const { type, record } = fixture()
  deepFreeze(record)
  const updatedType = {
    ...type,
    sections: [{ id: 'beneficiary', name: 'Applicant' }, type.sections[0]],
    documents: [type.documents[1], { ...type.documents[0], name: 'Updated letters', description: 'New description', isKey: false, expectedQuantity: 15, sectionId: 'beneficiary' }],
  }
  const result = synchronizeMatterRecord('matter-1', record, updatedType, now)
  const document = result.documents[1]
  for (const key of ['id', 'status', 'receivedQuantity', 'comment', 'updatedBy', 'updatedAt']) {
    assert.equal(document[key], record.documents[0][key], key)
  }
  assert.equal(document.name, 'Updated letters')
  assert.equal(document.description, 'New description')
  assert.equal(document.isKey, false)
  assert.equal(document.expectedQuantity, 15)
  assert.equal(document.sectionId, result.sections[0].id)
  assert.equal(result.sections[0].name, 'Applicant')
  assert.deepEqual(result.documents.map((item) => item.templateDocumentId), ['passport', 'letters'])
})

test('new requirements are Pending without modifying existing tracking', () => {
  const { type, record } = fixture()
  const nextType = { ...type, documents: [...type.documents, { ...type.documents[0], id: 'new-document', name: 'New letters' }] }
  const result = synchronizeMatterRecord('matter-1', record, nextType, now)
  assert.deepEqual(result.documents.slice(0, 2), record.documents)
  assert.equal(result.documents[2].status, 'Pending')
  assert.equal(result.documents[2].receivedQuantity, 0)
  assert.equal(result.documents[2].comment, '')
  assert.equal(result.documents[2].updatedAt, now)
})

test('removed requirements are archived once with their old definition, section and tracking', () => {
  const { type, record } = fixture()
  const nextType = { ...type, documents: [type.documents[1]] }
  const result = synchronizeMatterRecord('matter-1', record, nextType, now)
  assert.equal(result.documents.length, 1)
  assert.deepEqual(result.previousDocuments[0], { ...record.documents[0], previousSectionName: 'Petitioner', removedAt: now })
  const repeated = synchronizeMatterRecord('matter-1', result, nextType, now)
  assert.deepEqual(repeated, result)
  const fresh = createMatterSnapshot('new', nextType, now)
  assert.equal(fresh.documents.length, 1)
  assert.deepEqual(fresh.previousDocuments, [])
})

test('recreating a removed name does not reuse archived tracking', () => {
  const { type, record } = fixture()
  const removedType = { ...type, documents: [type.documents[1]] }
  const removed = synchronizeMatterRecord('matter-1', record, removedType, now)
  const addedType = { ...type, documents: [...removedType.documents, { ...type.documents[0], id: 'different-id' }] }
  const result = synchronizeMatterRecord('matter-1', removed, addedType, now)
  assert.equal(result.previousDocuments[0].status, 'Received')
  assert.equal(result.documents[1].name, 'Letters')
  assert.equal(result.documents[1].status, 'Pending')
  assert.equal(result.documents[1].comment, '')
})

test('removing a section moves documents to General without removing tracking', () => {
  const { type, record } = fixture()
  const result = synchronizeMatterRecord('matter-1', record, { ...type, sections: [] }, now)
  assert.ok(result.documents.every((document) => document.sectionId === null))
  assert.equal(result.documents[0].comment, record.documents[0].comment)
  assert.equal(result.previousDocuments.length, 0)
  const groups = groupDocumentsBySection(result.documents, result.sections)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, 'General documents')
})

test('quantity changes never clamp amounts, reset Received or lose old quantities', () => {
  const { type, record } = fixture()
  let result = record
  for (const expectedQuantity of [20, 3, null, 10]) {
    result = synchronizeMatterRecord('matter-1', result, {
      ...type, documents: [{ ...type.documents[0], expectedQuantity }, type.documents[1]],
    }, now)
    assert.equal(result.documents[0].receivedQuantity, 6)
    assert.equal(result.documents[0].status, 'Received')
    assert.equal(calculateMatterStatus(result.documents), 'Ready to Draft')
  }
  const newlyCounted = synchronizeMatterRecord('matter-1', record, {
    ...type, documents: [type.documents[0], { ...type.documents[1], expectedQuantity: 4 }],
  }, now)
  assert.equal(newlyCounted.documents[1].receivedQuantity, 0)
  assert.equal(newlyCounted.documents[1].status, 'Received')
})

test('automatic statuses recalculate with a dated history entry; inputs remain untouched', () => {
  const { type, data } = fixture()
  deepFreeze(data)
  const updatedType = { ...type, documents: [...type.documents, { ...type.documents[0], id: 'new-key' }] }
  const result = applyTemplateChanges(data, [updatedType], now)
  assert.equal(result.matters[0].status, 'Pending Documents')
  assert.equal(result.matters[0].statusUpdatedAt, now)
  assert.equal(result.matterRecords['matter-1'].history.length, 2)
  assert.deepEqual(result.matterRecords['matter-1'].history[0], {
    id: `matter-1-template-${now}-1`, fromStatus: 'Ready to Draft', toStatus: 'Pending Documents',
    changedBy: 'System', changedAt: now, source: 'Automatic', reason: 'Template updated',
  })
  const repeated = applyTemplateChanges(result, [updatedType], now)
  assert.deepEqual(repeated, result)
})

test('a new non-key requirement produces Ready to Start Drafting, not Pending Documents', () => {
  const { type, data } = fixture()
  const updatedType = { ...type, documents: [...type.documents, { ...type.documents[1], id: 'new-non-key' }] }
  assert.equal(applyTemplateChanges(data, [updatedType], now).matters[0].status, 'Ready to Start Drafting')
})

test('manual states including Accepted and Sent are never overridden', () => {
  for (const status of ['Pending Documents', 'Ready to Draft', 'Accepted', 'Sent']) {
    const { type, data } = fixture(status, 'Manual')
    const updatedType = { ...type, documents: [...type.documents, { ...type.documents[0], id: 'new-key' }] }
    const result = applyTemplateChanges(data, [updatedType], now)
    assert.equal(result.matters[0].status, status)
    assert.equal(result.matters[0].statusSource, 'Manual')
    assert.equal(result.matters[0].statusUpdatedAt, before)
    assert.deepEqual(result.matterRecords['matter-1'].history, data.matterRecords['matter-1'].history)
    assert.equal(result.matterRecords['matter-1'].documents.length, 3)
  }
})

test('unrelated matters are not changed and same-status edits do not add history', () => {
  const { type, data } = fixture()
  const otherType = { ...type, id: 'other' }
  const otherMatter = { ...data.matters[0], id: 'other-matter', matterTypeId: 'other' }
  const otherRecord = { ...createMatterSnapshot(otherMatter.id, otherType, before), history: [] }
  const input = { ...data, matterTypes: [type, otherType], matters: [...data.matters, otherMatter], matterRecords: { ...data.matterRecords, [otherMatter.id]: otherRecord } }
  const renamed = { ...type, documents: type.documents.map((document) => ({ ...document, name: `${document.name} updated` })) }
  const result = applyTemplateChanges(input, [renamed, otherType], now)
  assert.equal(result.matters[1], otherMatter)
  assert.equal(result.matterRecords[otherMatter.id], otherRecord)
  assert.deepEqual(result.matterRecords['matter-1'].history, data.matterRecords['matter-1'].history)
  assert.equal(result.matters[0].statusUpdatedAt, before)
})

test('empty and keyless templates stay Pending; removed tracking never counts', () => {
  assert.equal(calculateMatterStatus([]), 'Pending Documents')
  assert.equal(calculateMatterStatus([{ isKey: false, status: 'Received' }]), 'Pending Documents')
  const { type, data } = fixture()
  const result = applyTemplateChanges(data, [{ ...type, documents: [] }], now)
  assert.equal(result.matters[0].status, 'Pending Documents')
  assert.equal(result.matterRecords['matter-1'].previousDocuments.length, 2)
  assert.deepEqual(countDocumentStatuses(result.matterRecords['matter-1'].documents), {
    Pending: 0, Received: 0, 'Client Does Not Have': 0, 'Not Applicable': 0,
  })
})

test('report counts distinguish Received from other resolved statuses', () => {
  const counts = countDocumentStatuses(['Received', 'Received', 'Pending', 'Client Does Not Have', 'Not Applicable']
    .map((status) => ({ status })))
  assert.deepEqual(counts, { Pending: 1, Received: 2, 'Client Does Not Have': 1, 'Not Applicable': 1 })
  assert.equal(formatDocumentQuantity({ expectedQuantity: 10, receivedQuantity: 6 }), '6 of 10')
  assert.equal(formatDocumentQuantity({ expectedQuantity: null, receivedQuantity: 6 }), '6 previously recorded; not counted')
})

test('preview fixtures have valid unique numbers and match their actual templates', () => {
  assert.equal(new Set(matters.map((matter) => matter.matterName)).size, matters.length)
  for (const matter of matters) {
    assert.ok(isMatterNumberValid(matter.matterName))
    const type = matterTypes.find((item) => item.id === matter.matterTypeId)
    const snapshot = createMatterSnapshot(matter.id, type, matter.statusUpdatedAt)
    const documents = getMockMatterDocuments(snapshot.documents, matter.status)
    assert.deepEqual(documents.map((document) => document.templateDocumentId), type.documents.map((document) => document.id))
    if (matter.statusSource === 'Automatic') assert.equal(calculateMatterStatus(documents), matter.status)
  }
})
