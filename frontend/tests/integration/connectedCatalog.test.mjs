import { before, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthSession } from '../../src/features/auth/services/authSession.js'
import { createCatalogStore } from '../../src/features/catalog/catalogStore.js'
import { createBackendFixture, createCookieFetch } from '../support/backendFixture.mjs'
import { createTestDatabase } from '../../../backend/tests/integration/testDatabase.js'

let fixture
let admin
let store
let type
const sessionFor = (jar = createCookieFetch(fixture.origin)) => createAuthSession({ baseUrl: `${fixture.baseUrl}/api`, fetchImpl: jar })

describe('frontend services connected to the real API and isolated PostgreSQL', { concurrency: false, timeout: 60000 }, () => {
  before(async () => {
    fixture = await createBackendFixture()
    admin = sessionFor()
    await admin.restore()
    await admin.login({ username: fixture.users.admin.username, password: fixture.password })
    store = createCatalogStore(admin.api)
    await store.loadCatalog()
  })
  after(async () => {
    await fixture?.close()
    const database = createTestDatabase()
    try {
      const remaining = await database.query('SELECT id FROM app.matter_types WHERE id = $1', [type?.id ?? null])
      assert.equal(remaining.rowCount, 0, 'The fixture must remove its own matter type.')
    } finally { await database.end() }
  })

  it('restores a cookie session with a new session controller and preserves database identity', async () => {
    const jar = createCookieFetch(fixture.origin)
    const first = sessionFor(jar)
    await first.login({ username: fixture.users.member.username, password: fixture.password })
    const reloaded = sessionFor(jar)
    await reloaded.restore()
    assert.equal(reloaded.getSnapshot().user.id, fixture.users.member.id)
    assert.equal(reloaded.getSnapshot().status, 'Authenticated')
    await reloaded.logout()
    await first.restore()
    assert.equal(first.getSnapshot().status, 'Anonymous')
  })

  it('creates and edits canonical matter types and loads them again from PostgreSQL', async () => {
    type = await store.createMatterType({ name: ' Frontend   QA Family ', description: 'Configured through the API' })
    assert.equal(type.name, 'Frontend QA Family')
    assert.equal(type.templateStatus, 'Template required')
    const updated = await store.updateMatterType(type.id, { description: 'Updated description' })
    assert.equal(updated.id, type.id)
    const reloaded = createCatalogStore(admin.api)
    await reloaded.loadCatalog()
    assert.equal(reloaded.getSnapshot().matterTypes.find((item) => item.id === type.id).description, 'Updated description')
  })

  it('uses all section and document operations, refreshes summaries and retains retired records', async () => {
    const petitioner = await store.createTemplateSection(type.id, 'Petitioner')
    const beneficiary = await store.createTemplateSection(type.id, 'Beneficiary')
    await store.moveTemplateSection(type.id, beneficiary.id, 'up')
    const renamed = await store.updateTemplateSection(type.id, petitioner.id, 'Applicant')
    assert.equal(renamed.id, petitioner.id)
    const passport = await store.createTemplateDocument(type.id, { name: 'Applicant passport', sectionId: petitioner.id, isKey: true })
    const letters = await store.createTemplateDocument(type.id, { name: 'Applicant letters', sectionId: petitioner.id, expectedQuantity: 10 })
    await store.moveTemplateDocument(type.id, letters.id, 'up')
    await store.updateTemplateDocument(type.id, passport.id, { name: 'Applicant identification', expectedQuantity: null })
    let current = store.getSnapshot().templates[type.id].data
    assert.deepEqual(current.documents.map((item) => item.id), [letters.id, passport.id])
    assert.equal(current.templateStatus, 'Ready')
    assert.equal(current.documentCount, 2)
    await store.deleteTemplateSection(type.id, petitioner.id)
    current = store.getSnapshot().templates[type.id].data
    assert.ok(current.documents.every((item) => item.sectionId === null))
    assert.deepEqual(current.documents.map((item) => item.id), [letters.id, passport.id])
    await store.deleteTemplateDocument(type.id, letters.id)
    const retired = await fixture.database.query('SELECT retired_at FROM app.template_documents WHERE id = $1', [letters.id])
    assert.ok(retired.rows[0].retired_at)
    const reloaded = createCatalogStore(admin.api)
    await reloaded.loadTemplate(type.id)
    assert.equal(reloaded.getSnapshot().templates[type.id].data.documents[0].id, passport.id)
    assert.equal(reloaded.getSnapshot().templates[type.id].data.documentCount, 1)
  })

  it('shows server conflict fields without adding a duplicate or falsely reporting a save', async () => {
    const count = store.getSnapshot().matterTypes.length
    await assert.rejects(store.createMatterType({ name: type.name.toUpperCase() }),
      (error) => error.status === 409 && Boolean(error.fields.name))
    assert.equal(store.getSnapshot().matterTypes.length, count)
  })

  it('allows MEMBER reads while the real backend rejects all mutations', async () => {
    const member = sessionFor()
    await member.login({ username: fixture.users.member.username, password: fixture.password })
    const catalog = createCatalogStore(member.api)
    await catalog.loadCatalog()
    assert.equal(catalog.getSnapshot().status, 'Ready')
    await catalog.loadTemplate(type.id)
    await assert.rejects(catalog.createMatterType({ name: 'Forbidden' }), { code: 'ADMIN_REQUIRED' })
    await assert.rejects(catalog.createTemplateSection(type.id, 'Forbidden'), { code: 'ADMIN_REQUIRED' })
    assert.equal(member.getSnapshot().status, 'Authenticated')
  })

  it('requires temporary-password replacement and clears the session after a confirmed change', async () => {
    const temporary = sessionFor()
    await temporary.login({ username: fixture.users.temporary.username, password: fixture.password })
    assert.equal(temporary.getSnapshot().user.mustChangePassword, true)
    await assert.rejects(temporary.api.request('/matter-types'), { code: 'PASSWORD_CHANGE_REQUIRED' })
    const password = 'Different fictitious frontend password!43'
    await temporary.changePassword({ currentPassword: fixture.password, newPassword: password })
    assert.equal(temporary.getSnapshot().status, 'Anonymous')
    await temporary.login({ username: fixture.users.temporary.username, password })
    assert.equal(temporary.getSnapshot().user.mustChangePassword, false)
    await temporary.logout()
  })

  it('detects revoked sessions on the next request and exposes no matter API in this block', async () => {
    const unknown = await fetch(`${fixture.baseUrl}/api/matters`)
    assert.equal(unknown.status, 404)
    await fixture.revokeSessions()
    await assert.rejects(admin.api.request('/matter-types'), { code: 'AUTHENTICATION_REQUIRED' })
    assert.equal(admin.getSnapshot().status, 'Anonymous')
  })
})
