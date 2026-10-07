import test from 'node:test'
import assert from 'node:assert/strict'
import { createCatalogStore } from '../src/features/catalog/catalogStore.js'
import { ApiError } from '../src/api/apiClient.js'
import { getMatterTypeTemplateStatus, getTemplateDocumentCount, getTemplateKeyCount } from '../src/features/matterTypes/utils/matterTypeTemplateStatus.js'

const type = { id: 'type-1', name: 'Family', description: '', templateRevision: 0, documentCount: 0, keyDocumentCount: 0, templateStatus: 'Template required' }
const complete = (extra = {}) => ({ data: { matterType: type, sections: [], documents: [], ...extra } })

test('catalog loads all pages, removes duplicate identities and does not fetch every template', async () => {
  const calls = []
  const store = createCatalogStore({ request: async (path) => {
    calls.push(path)
    return { data: path.includes('page=1') ? [type] : [type, { ...type, id: 'type-2', name: 'Adjustment' }], pagination: { totalPages: 2 } }
  } })
  await store.loadCatalog()
  assert.equal(store.getSnapshot().status, 'Ready')
  assert.deepEqual(store.getSnapshot().matterTypes.map((item) => item.name), ['Adjustment', 'Family'])
  assert.equal(calls.length, 2)
  assert.equal(calls.some((path) => path.endsWith('/template')), false)
})

test('catalog failure is explicit and retry replaces the error', async () => {
  let offline = true
  const store = createCatalogStore({ request: async () => {
    if (offline) throw new ApiError('Offline')
    return { data: [], pagination: { totalPages: 0 } }
  } })
  await store.loadCatalog()
  assert.equal(store.getSnapshot().status, 'Error')
  offline = false
  await store.loadCatalog()
  assert.equal(store.getSnapshot().status, 'Ready')
  assert.equal(store.getSnapshot().error, null)
})

test('creation is not optimistic, preserves canonical server data and blocks duplicate submissions', async () => {
  const deferred = Promise.withResolvers()
  let count = 0
  const store = createCatalogStore({ request: () => { count += 1; return deferred.promise } })
  const saving = store.createMatterType({ name: ' Family ' })
  assert.deepEqual(store.getSnapshot().matterTypes, [])
  assert.equal(store.getSnapshot().isMutating, true)
  await assert.rejects(store.createMatterType({ name: 'Other' }), { code: 'SAVE_IN_PROGRESS' })
  deferred.resolve({ data: type })
  assert.deepEqual(await saving, type)
  assert.equal(count, 1)
  assert.equal(store.getSnapshot().matterTypes[0].name, 'Family')
})

test('failed writes leave cached data unchanged and remain recoverable', async () => {
  const failure = new ApiError('Duplicate', { status: 409, fields: { name: 'Already exists.' } })
  const store = createCatalogStore({ request: async (path, options) => {
    if (options) throw failure
    return { data: [type], pagination: { totalPages: 1 } }
  } })
  await store.loadCatalog()
  await assert.rejects(store.updateMatterType(type.id, { name: 'Other' }), (error) => error === failure)
  assert.equal(store.getSnapshot().matterTypes[0].name, 'Family')
  assert.equal(store.getSnapshot().isMutating, false)
})

test('full template reads adapt definitions and authoritative summary into a shared record', async () => {
  const summary = { ...type, templateRevision: 3, documentCount: 1, keyDocumentCount: 1, templateStatus: 'Ready' }
  const store = createCatalogStore({ request: async () => complete({ matterType: summary, sections: [{ id: 'section' }], documents: [{ id: 'document', isKey: true }] }) })
  const data = await store.loadTemplate(type.id)
  assert.equal(data.templateRevision, 3)
  assert.equal(data.documents[0].id, 'document')
  assert.equal(store.getSnapshot().matterTypes[0].documentCount, 1)
  assert.equal(getMatterTypeTemplateStatus(summary), 'Ready')
  assert.equal(getTemplateDocumentCount(summary), 1)
  assert.equal(getTemplateKeyCount(summary), 1)
})

test('all eight template writes use the correct route, verb and body then reload server state', async () => {
  const calls = []
  const store = createCatalogStore({ request: async (path, options) => {
    calls.push([path, options])
    return options ? { data: { id: 'saved' } } : complete()
  } })
  await store.createTemplateSection('t', 'Petitioner')
  await store.updateTemplateSection('t', 's', 'Applicant')
  await store.deleteTemplateSection('t', 's')
  await store.moveTemplateSection('t', 's', 'up')
  await store.createTemplateDocument('t', { name: 'Passport' })
  await store.updateTemplateDocument('t', 'd', { isKey: true })
  await store.deleteTemplateDocument('t', 'd')
  await store.moveTemplateDocument('t', 'd', 'down')
  const writes = calls.filter(([, options]) => options)
  assert.deepEqual(writes.map(([, options]) => options.method), ['POST', 'PATCH', 'DELETE', 'POST', 'POST', 'PATCH', 'DELETE', 'POST'])
  assert.deepEqual(writes.map(([path]) => path), [
    '/matter-types/t/template/sections', '/matter-types/t/template/sections/s',
    '/matter-types/t/template/sections/s', '/matter-types/t/template/sections/s/move',
    '/matter-types/t/template/documents', '/matter-types/t/template/documents/d',
    '/matter-types/t/template/documents/d', '/matter-types/t/template/documents/d/move',
  ])
  assert.equal(writes[2][1].body, undefined)
  assert.equal(writes[6][1].body, undefined)
  assert.deepEqual(writes[7][1].body, { direction: 'down' })
  assert.equal(calls.filter(([, options]) => !options).length, 8)
})

test('confirmed saves with a failed refresh do not report a failed write or repeat it', async () => {
  let writes = 0
  const store = createCatalogStore({ request: async (path, options) => {
    if (options) { writes += 1; return { data: { id: 'new-document' } } }
    throw new ApiError('Offline')
  } })
  assert.equal((await store.createTemplateDocument('t', { name: 'Passport' })).id, 'new-document')
  assert.equal(writes, 1)
  assert.equal(store.getSnapshot().templates.t.status, 'Error')
  assert.equal(store.getSnapshot().templates.t.error.code, 'SAVED_REFRESH_FAILED')
})

test('a late template read cannot overwrite a newer confirmed edit', async () => {
  const deferred = Promise.withResolvers()
  let reads = 0
  const store = createCatalogStore({ request: async (path, options) => {
    if (options) return { data: { id: 'new' } }
    if (++reads === 1) return deferred.promise
    return complete({ documents: [{ id: 'new', name: 'New' }], matterType: { ...type, templateRevision: 1 } })
  } })
  const previous = store.loadTemplate(type.id)
  await store.createTemplateDocument(type.id, { name: 'New' })
  deferred.resolve(complete())
  await previous
  assert.equal(store.getSnapshot().templates[type.id].data.documents[0].id, 'new')
})

test('a catalog reload retains changes confirmed while its older read was in flight', async () => {
  const deferred = Promise.withResolvers()
  const store = createCatalogStore({ request: async (path, options) => options ? { data: type } : deferred.promise })
  const loading = store.loadCatalog()
  await store.createMatterType({ name: 'Family' })
  deferred.resolve({ data: [], pagination: { totalPages: 0 } })
  await loading
  assert.equal(store.getSnapshot().status, 'Ready')
  assert.equal(store.getSnapshot().matterTypes[0].id, type.id)
})

test('unmounting a user workspace ignores late responses from that workspace', async () => {
  const deferred = Promise.withResolvers()
  const store = createCatalogStore({ request: () => deferred.promise })
  const loading = store.loadTemplate(type.id)
  store.dispose()
  deferred.resolve(complete())
  await loading
  assert.equal(store.getSnapshot().templates[type.id].status, 'Loading')
  assert.deepEqual(store.getSnapshot().matterTypes, [])
})
