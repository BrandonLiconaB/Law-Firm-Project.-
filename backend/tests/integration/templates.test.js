import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createTestDatabase, prepareTestEnvironment } from './testDatabase.js'

prepareTestEnvironment()

const { createApp } = await import('../../src/app.js')
const { hashPassword } = await import('../../src/modules/auth/password.js')
const { insertUser } = await import('../../src/modules/users/users.repository.js')
const { createToken, loginLimitKeys } = await import('../../src/modules/auth/auth.tokens.js')
const { deleteSection } = await import('../../src/modules/templates/sections.service.js')

const database = createTestDatabase()
const runId = randomUUID().replaceAll('-', '').slice(0, 18)
const fixturePassword = 'Learning-only template password!42'
const origin = 'http://localhost:5173'
const typeIds = new Set()
const userIds = new Set()
const limitKeys = new Set()
let server
let adminSession
let memberSession
let temporarySession
let typeId
let otherTypeId
let sequence = 0

function path(suffix = '', id = typeId) {
  return `/api/matter-types/${id}/template${suffix}`
}

function write(method, suffix, input, session = adminSession, id = typeId) {
  const operation = request(server)[method](path(suffix, id)).set('Origin', origin)
  if (session) operation.set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken)
  return input === undefined ? operation : operation.send(input)
}

async function template(id = typeId, session = memberSession) {
  const response = await request(server).get(path('', id)).set('Cookie', session.cookie).expect(200)
  assert.equal(response.headers['cache-control'], 'no-store')
  return response.body.data
}

async function section(name, id = typeId) {
  const response = await write('post', '/sections', { name }, adminSession, id).expect(201)
  return response.body.data
}

async function document(name, extra = {}, id = typeId) {
  const response = await write('post', '/documents', { name, ...extra }, adminSession, id).expect(201)
  return response.body.data
}

async function createType() {
  sequence += 1
  const response = await request(server).post('/api/matter-types').set('Origin', origin)
    .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
    .send({ name: `Templates ${runId} ${sequence}` }).expect(201)
  typeIds.add(response.body.data.id)
  return response.body.data.id
}

async function cleanTypes() {
  const ids = [[...typeIds]]
  await database.query('DELETE FROM app.template_documents WHERE matter_type_id = ANY($1::uuid[])', ids)
  await database.query('DELETE FROM app.template_sections WHERE matter_type_id = ANY($1::uuid[])', ids)
  await database.query('DELETE FROM app.matter_types WHERE id = ANY($1::uuid[])', ids)
  typeIds.clear()
}

async function signIn(user) {
  for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
    const keys = loginLimitKeys(ip, user.username)
    limitKeys.add(keys.ip)
    limitKeys.add(keys.accountIp)
  }
  const response = await request(server).post('/api/auth/login').set('Origin', origin)
    .send({ username: user.username, password: fixturePassword }).expect(200)
  return { cookie: response.headers['set-cookie'][0].split(';')[0], csrfToken: response.body.data.csrfToken }
}

function assertDense(data) {
  assert.deepEqual(data.sections.map((item) => item.position), data.sections.map((item, i) => i + 1))
  assert.equal(new Set(data.documents.map((item) => item.id)).size, data.documents.length)
  for (const sectionId of [null, ...data.sections.map((item) => item.id)]) {
    const group = data.documents.filter((item) => item.sectionId === sectionId)
    assert.deepEqual(group.map((item) => item.position), group.map((item, i) => i + 1))
  }
}

function interceptedDatabase(intercept) {
  return {
    query: (...args) => database.query(...args),
    connect: async () => {
      const client = await database.connect()
      return { query: (sql, params) => intercept(sql, params, () => client.query(sql, params)), release: () => client.release() }
    },
  }
}

describe('template definitions against isolated PostgreSQL', { concurrency: false, timeout: 60000 }, () => {
  before(async () => {
    const passwordHash = await hashPassword(fixturePassword)
    for (const [label, role, temporary] of [['admin', 'ADMIN', false], ['member', 'MEMBER', false], ['temp', 'MEMBER', true]]) {
      const user = await insertUser(database, {
        username: `template_${label}_${runId}`, fullName: `Template Integration ${label}`,
        passwordHash, systemRole: role, mustChangePassword: temporary,
      })
      userIds.add(user.id)
      if (!server) {
        server = createApp({ database }).listen(0, '127.0.0.1')
        await new Promise((resolve, reject) => {
          server.once('listening', resolve)
          server.once('error', reject)
        })
      }
      const session = await signIn(user)
      if (label === 'admin') adminSession = session
      if (label === 'member') memberSession = session
      if (label === 'temp') temporarySession = session
    }
  })

  beforeEach(async () => {
    await cleanTypes()
    await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])
    typeId = await createType()
    otherTypeId = await createType()
  })

  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
    try {
      await cleanTypes()
      await database.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [[...userIds]])
      await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])
    } finally {
      await database.end()
    }
  })

  it('requires authentication for the complete template and all eight write routes', async () => {
    await request(server).get(path()).expect(401)
    for (const [method, suffix, input] of [
      ['post', '/sections', { name: 'Petitioner' }], ['patch', `/sections/${randomUUID()}`, { name: 'New' }],
      ['delete', `/sections/${randomUUID()}`], ['post', `/sections/${randomUUID()}/move`, { direction: 'up' }],
      ['post', '/documents', { name: 'Passport' }], ['patch', `/documents/${randomUUID()}`, { name: 'New' }],
      ['delete', `/documents/${randomUUID()}`], ['post', `/documents/${randomUUID()}/move`, { direction: 'up' }],
    ]) await write(method, suffix, input, null).expect(401)
  })

  it('allows ADMIN and MEMBER to read an empty template with derived metadata', async () => {
    for (const session of [adminSession, memberSession]) {
      const data = await template(typeId, session)
      assert.deepEqual(data.sections, [])
      assert.deepEqual(data.documents, [])
      assert.equal(data.matterType.templateRevision, 0)
      assert.equal(data.matterType.documentCount, 0)
      assert.equal(data.matterType.keyDocumentCount, 0)
      assert.equal(data.matterType.templateStatus, 'Template required')
      const catalog = await request(server).get(`/api/matter-types/${typeId}`).set('Cookie', session.cookie).expect(200)
      assert.deepEqual(data.matterType, catalog.body.data)
    }
  })

  it('rejects MEMBER writes and temporary-password access', async () => {
    const s = await section('Petitioner')
    const d = await document('Passport')
    const routes = [
      ['post', '/sections', { name: 'New' }], ['patch', `/sections/${s.id}`, { name: 'New' }],
      ['delete', `/sections/${s.id}`], ['post', `/sections/${s.id}/move`, { direction: 'up' }],
      ['post', '/documents', { name: 'New' }], ['patch', `/documents/${d.id}`, { name: 'New' }],
      ['delete', `/documents/${d.id}`], ['post', `/documents/${d.id}/move`, { direction: 'up' }],
    ]
    const before = await template()
    for (const [method, suffix, input] of routes) {
      const member = await write(method, suffix, input, memberSession).expect(403)
      assert.equal(member.body.error.code, 'ADMIN_REQUIRED')
      const temporary = await write(method, suffix, input, temporarySession).expect(403)
      assert.equal(temporary.body.error.code, 'PASSWORD_CHANGE_REQUIRED')
    }
    const read = await request(server).get(path()).set('Cookie', temporarySession.cookie).expect(403)
    assert.equal(read.body.error.code, 'PASSWORD_CHANGE_REQUIRED')
    assert.deepEqual(await template(), before)
  })

  it('requires CSRF and trusted origin on every write, and JSON on writes with bodies', async () => {
    const s = await section('Petitioner')
    const d = await document('Passport')
    const before = await template()
    for (const [method, suffix, input] of [
      ['post', '/sections', { name: 'New' }], ['patch', `/sections/${s.id}`, { name: 'New' }],
      ['delete', `/sections/${s.id}`], ['post', `/sections/${s.id}/move`, { direction: 'up' }],
      ['post', '/documents', { name: 'New' }], ['patch', `/documents/${d.id}`, { name: 'New' }],
      ['delete', `/documents/${d.id}`], ['post', `/documents/${d.id}/move`, { direction: 'up' }],
    ]) {
      for (const csrfToken of [undefined, createToken(), memberSession.csrfToken]) {
        const operation = request(server)[method](path(suffix)).set('Origin', origin).set('Cookie', adminSession.cookie)
        if (csrfToken) operation.set('X-CSRF-Token', csrfToken)
        const response = await operation.send(input).expect(403)
        assert.equal(response.body.error.code, 'INVALID_CSRF_TOKEN')
      }
      for (const untrustedOrigin of [undefined, 'https://other.example']) {
        const operation = request(server)[method](path(suffix)).set('Cookie', adminSession.cookie)
          .set('X-CSRF-Token', adminSession.csrfToken)
        if (untrustedOrigin) operation.set('Origin', untrustedOrigin)
        await operation.send(input).expect(403)
      }
      if (input) await request(server)[method](path(suffix)).set('Origin', origin)
        .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
        .type('text').send('plain text').expect(415)
    }
    assert.deepEqual(await template(), before)
  })

  it('cleans section names, scopes duplicates to a template and preserves section identity on rename', async () => {
    const s = await section('  Petitioner\t  Documents ')
    assert.equal(s.name, 'Petitioner Documents')
    assert.equal(s.position, 1)
    assert.equal(s.matterTypeId, typeId)
    const duplicate = await write('post', '/sections', { name: 'petitioner documents' }).expect(409)
    assert.equal(duplicate.body.error.code, 'TEMPLATE_SECTION_NAME_ALREADY_EXISTS')
    await section('Petitioner Documents', otherTypeId)
    const response = await write('patch', `/sections/${s.id}`, { name: 'Beneficiary' }).expect(200)
    assert.equal(response.body.data.id, s.id)
    assert.equal(response.body.data.createdAt, s.createdAt)
    assert.equal(response.body.templateRevision, 2)
    const same = await write('patch', `/sections/${s.id}`, { name: 'Beneficiary' }).expect(200)
    assert.equal(same.body.templateRevision, 2)
  })

  it('reorders sections densely and rejects movement beyond either boundary without incrementing revision', async () => {
    const a = await section('A')
    const b = await section('B')
    const c = await section('C')
    await write('post', `/sections/${b.id}/move`, { direction: 'up' }).expect(200)
    let data = await template()
    assert.deepEqual(data.sections.map((item) => item.id), [b.id, a.id, c.id])
    assertDense(data)
    await write('post', `/sections/${b.id}/move`, { direction: 'up' }).expect(400)
    await write('post', `/sections/${c.id}/move`, { direction: 'down' }).expect(400)
    data = await template()
    assert.equal(data.matterType.templateRevision, 4)
    await write('post', `/sections/${b.id}/move`, { direction: 'down' }).expect(200)
    assert.deepEqual((await template()).sections.map((item) => item.id), [a.id, b.id, c.id])
  })

  it('creates General and section requirements with clean names, defaults and no tracking fields', async () => {
    const s = await section('Petitioner')
    const general = await document('  General   Passport ')
    const grouped = await document('Petitioner Passport', { sectionId: s.id, isKey: true, expectedQuantity: 5 })
    assert.equal(general.sectionId, null)
    assert.equal(general.isKey, false)
    assert.equal(general.expectedQuantity, null)
    assert.equal(general.description, '')
    assert.equal(general.position, 1)
    assert.equal(grouped.position, 1)
    const data = await template()
    assert.deepEqual(data.documents.map((item) => item.id), [grouped.id, general.id])
    assert.equal(data.matterType.documentCount, 2)
    assert.equal(data.matterType.keyDocumentCount, 1)
    assert.equal(data.matterType.templateStatus, 'Ready')
    assert.equal(data.matterType.templateRevision, 3)
    assert.equal(data.documents[0].status, undefined)
    assert.equal(data.documents[0].receivedQuantity, undefined)
    assert.equal(data.documents[0].general_group, undefined)
    assert.equal(data.documents[0].section_position, undefined)
    assertDense(data)
  })

  it('enforces unique document names across all sections, but allows them in another template', async () => {
    const a = await section('Petitioner')
    const b = await section('Beneficiary')
    await document('Passport', { sectionId: a.id })
    const duplicate = await write('post', '/documents', { name: '  PASSPORT ', sectionId: b.id }).expect(409)
    assert.equal(duplicate.body.error.code, 'TEMPLATE_DOCUMENT_NAME_ALREADY_EXISTS')
    assert.ok(duplicate.body.error.fields.name)
    assert.doesNotMatch(JSON.stringify(duplicate.body), /23505|template_documents_name_active_idx/)
    await document('Passport', {}, otherTypeId)
    assert.equal((await template()).matterType.templateRevision, 3)
  })

  it('supports partial edits, explicit false/null/empty values and unchanged UUIDs', async () => {
    const s = await section('Petitioner')
    const d = await document('Letters', { sectionId: s.id, isKey: true, expectedQuantity: 10, description: 'Instructions' })
    const edit = await write('patch', `/documents/${d.id}`, { name: ' Renamed   Letters ' }).expect(200)
    assert.equal(edit.body.data.id, d.id)
    assert.equal(edit.body.data.createdAt, d.createdAt)
    assert.equal(edit.body.data.expectedQuantity, 10)
    assert.equal(edit.body.data.description, 'Instructions')
    const clear = await write('patch', `/documents/${d.id}`, {
      sectionId: null, isKey: false, expectedQuantity: null, description: '',
    }).expect(200)
    assert.equal(clear.body.data.sectionId, null)
    assert.equal(clear.body.data.isKey, false)
    assert.equal(clear.body.data.expectedQuantity, null)
    assert.equal(clear.body.data.description, '')
    const same = await write('patch', `/documents/${d.id}`, { isKey: false }).expect(200)
    assert.equal(same.body.templateRevision, clear.body.templateRevision)
    assert.equal((await template()).matterType.templateStatus, 'Key document required')
  })

  it('appends documents to a destination section and rebalances the source without losing definitions', async () => {
    const a = await section('A')
    const b = await section('B')
    const d1 = await document('A1', { sectionId: a.id })
    const d2 = await document('A2', { sectionId: a.id, isKey: true, expectedQuantity: 6 })
    const d3 = await document('B1', { sectionId: b.id })
    await write('patch', `/documents/${d1.id}`, { sectionId: b.id }).expect(200)
    const data = await template()
    assert.deepEqual(data.documents.map((item) => item.id), [d2.id, d3.id, d1.id])
    assert.equal(data.documents[0].expectedQuantity, 6)
    assertDense(data)
    await write('patch', `/documents/${d1.id}`, { sectionId: null }).expect(200)
    assert.equal((await template()).documents.at(-1).id, d1.id)
  })

  it('moves requirements only within their own group and follows the section order in complete reads', async () => {
    const a = await section('A')
    const b = await section('B')
    const a1 = await document('A1', { sectionId: a.id })
    const a2 = await document('A2', { sectionId: a.id })
    const b1 = await document('B1', { sectionId: b.id })
    const g1 = await document('G1')
    const g2 = await document('G2')
    await write('post', `/documents/${a2.id}/move`, { direction: 'up' }).expect(200)
    await write('post', `/documents/${g2.id}/move`, { direction: 'up' }).expect(200)
    await write('post', `/documents/${b1.id}/move`, { direction: 'down' }).expect(400)
    await write('post', `/sections/${b.id}/move`, { direction: 'up' }).expect(200)
    const data = await template()
    assert.deepEqual(data.documents.map((item) => item.id), [b1.id, a2.id, a1.id, g2.id, g1.id])
    assertDense(data)
  })

  it('retires a requirement without deleting its row and recreates the same name with a new UUID', async () => {
    const d = await document('Letters', { isKey: true, expectedQuantity: 10, description: 'Keep definition' })
    await write('delete', `/documents/${d.id}`).expect(204)
    const archived = await database.query('SELECT * FROM app.template_documents WHERE id = $1', [d.id])
    assert.equal(archived.rowCount, 1)
    assert.ok(archived.rows[0].retired_at)
    assert.equal(archived.rows[0].description, 'Keep definition')
    assert.equal(archived.rows[0].expected_quantity, 10)
    assert.deepEqual((await template()).documents, [])
    const recreated = await document('Letters')
    assert.notEqual(recreated.id, d.id)
    const before = await template()
    for (const [method, suffix, input] of [
      ['patch', `/documents/${d.id}`, { name: 'Hidden' }],
      ['post', `/documents/${d.id}/move`, { direction: 'up' }], ['delete', `/documents/${d.id}`],
    ]) await write(method, suffix, input).expect(404)
    assert.deepEqual(await template(), before)
  })

  it('retires sections and appends their current documents to General in relative order', async () => {
    const a = await section('Petitioner')
    const b = await section('Beneficiary')
    const g = await document('G')
    const a1 = await document('A1', { sectionId: a.id, isKey: true, expectedQuantity: 5 })
    const a2 = await document('A2', { sectionId: a.id })
    const old = await document('Old', { sectionId: a.id })
    const b1 = await document('B1', { sectionId: b.id })
    await write('delete', `/documents/${old.id}`).expect(204)
    await write('delete', `/sections/${a.id}`).expect(204)
    const data = await template()
    assert.deepEqual(data.sections.map((item) => item.id), [b.id])
    assert.deepEqual(data.documents.map((item) => item.id), [b1.id, g.id, a1.id, a2.id])
    assert.equal(data.documents.find((item) => item.id === a1.id).sectionId, null)
    assert.equal(data.documents.find((item) => item.id === a1.id).expectedQuantity, 5)
    assert.equal(data.matterType.keyDocumentCount, 1)
    assertDense(data)
    const archived = await database.query('SELECT retired_at FROM app.template_sections WHERE id = $1', [a.id])
    assert.ok(archived.rows[0].retired_at)
    const oldDefinition = await database.query('SELECT section_id FROM app.template_documents WHERE id = $1', [old.id])
    assert.equal(oldDefinition.rows[0].section_id, a.id)
    const invalid = await write('post', '/documents', { name: 'Invalid section', sectionId: a.id }).expect(400)
    assert.equal(invalid.body.error.code, 'INVALID_TEMPLATE_SECTION')
    const replacement = await section('Petitioner')
    assert.notEqual(replacement.id, a.id)
    await write('patch', `/sections/${a.id}`, { name: 'No restore' }).expect(404)
  })

  it('allows incomplete configuration and derives readiness without preventing edits', async () => {
    const d = await document('Key evidence', { isKey: true })
    assert.equal((await template()).matterType.templateStatus, 'Ready')
    await write('patch', `/documents/${d.id}`, { isKey: false }).expect(200)
    assert.equal((await template()).matterType.templateStatus, 'Key document required')
    await write('patch', `/documents/${d.id}`, { description: 'Still editable' }).expect(200)
    await write('delete', `/documents/${d.id}`).expect(204)
    assert.equal((await template()).matterType.templateStatus, 'Template required')
    await document('New key', { isKey: true })
    const data = await template()
    const catalog = await request(server).get('/api/matter-types').set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(catalog.body.data.find((item) => item.id === typeId), data.matterType)
  })

  it('distinguishes invalid UUIDs, missing types and records from a different template', async () => {
    const s = await section('Foreign', otherTypeId)
    const d = await document('Foreign', {}, otherTypeId)
    await request(server).get(path('', 'not-a-uuid')).set('Cookie', memberSession.cookie).expect(400)
    await request(server).get(path('', randomUUID())).set('Cookie', memberSession.cookie).expect(404)
    await write('post', '/sections', { name: 'Missing parent' }, adminSession, randomUUID()).expect(404)
    await write('patch', '/sections/not-a-uuid', { name: 'Invalid' }).expect(400)
    await write('patch', `/sections/${s.id}`, { name: 'Foreign edit' }).expect(404)
    await write('delete', `/documents/${d.id}`).expect(404)
    const foreignSection = await write('post', '/documents', { name: 'Wrong group', sectionId: s.id }).expect(400)
    assert.equal(foreignSection.body.error.code, 'INVALID_TEMPLATE_SECTION')
    assert.equal((await template()).matterType.templateRevision, 0)
  })

  it('rejects invalid quantities, empty edits and injected tracking fields without changing revision', async () => {
    const d = await document('Valid')
    const before = await template()
    for (const input of [
      {}, { name: '' }, { name: 'x'.repeat(121) }, { name: 'X\0' }, { name: 'Valid', description: 'x'.repeat(1001) },
      { name: 'Valid', isKey: 'true' }, { name: 'Valid', expectedQuantity: 0 },
      { name: 'Valid', expectedQuantity: 1.5 }, { name: 'Valid', expectedQuantity: '5' },
      { name: 'Valid', expectedQuantity: 2_147_483_648 }, { name: 'Valid', status: 'Received' },
      { name: 'Valid', receivedQuantity: 5 }, { name: 'Valid', comment: 'Not a template field' },
    ]) {
      const response = await write('post', '/documents', input).expect(400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
    }
    await write('patch', `/documents/${d.id}`, {}).expect(400)
    await write('post', `/documents/${d.id}/move`, { direction: 'left' }).expect(400)
    await write('post', '/sections', { name: 'Injected', position: 10 }).expect(400)
    assert.deepEqual(await template(), before)
    await document('Maximum', { expectedQuantity: 2_147_483_647, name: 'x'.repeat(120), description: 'x'.repeat(1000) })
  })

  it('rolls back a conflicting rename including other fields and the revision', async () => {
    await document('Existing')
    const other = await document('Other', { description: 'Original', expectedQuantity: 5 })
    const before = await template()
    await write('patch', `/documents/${other.id}`, { name: ' existing ', description: 'Must roll back', expectedQuantity: null }).expect(409)
    assert.deepEqual(await template(), before)
    const a = await section('A')
    await section('B')
    const beforeSection = await template()
    await write('patch', `/sections/${a.id}`, { name: 'b' }).expect(409)
    assert.deepEqual(await template(), beforeSection)
  })

  it('serializes simultaneous creations with dense positions and one revision per success', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => write('post', '/documents', { name: `Concurrent ${i}` })))
    assert.equal(responses.filter((response) => response.status === 201).length, 8)
    let data = await template()
    assert.equal(data.matterType.templateRevision, 8)
    assertDense(data)
    const duplicates = await Promise.all([
      write('post', '/documents', { name: 'Duplicate' }), write('post', '/documents', { name: ' duplicate ' }),
    ])
    assert.deepEqual(duplicates.map((response) => response.status).sort(), [201, 409])
    data = await template()
    assert.equal(data.matterType.templateRevision, 9)
    assertDense(data)
  })

  it('preserves both fields from concurrent partial edits', async () => {
    const d = await document('Original', { expectedQuantity: 5 })
    const responses = await Promise.all([
      write('patch', `/documents/${d.id}`, { name: 'Changed' }),
      write('patch', `/documents/${d.id}`, { description: 'Changed description', isKey: true }),
    ])
    assert.deepEqual(responses.map((response) => response.status), [200, 200])
    const data = await template()
    assert.equal(data.documents[0].name, 'Changed')
    assert.equal(data.documents[0].description, 'Changed description')
    assert.equal(data.documents[0].isKey, true)
    assert.equal(data.documents[0].expectedQuantity, 5)
    assert.equal(data.matterType.templateRevision, 3)
  })

  it('keeps ordering valid under simultaneous moves', async () => {
    const docs = []
    for (const name of ['A', 'B', 'C', 'D']) docs.push(await document(name))
    const responses = await Promise.all([
      write('post', `/documents/${docs[1].id}/move`, { direction: 'up' }),
      write('post', `/documents/${docs[2].id}/move`, { direction: 'down' }),
    ])
    assert.deepEqual(responses.map((response) => response.status), [200, 200])
    const data = await template()
    assert.deepEqual(data.documents.map((item) => item.name), ['B', 'A', 'D', 'C'])
    assert.equal(data.matterType.templateRevision, 6)
    assertDense(data)
  })

  it('handles section retirement racing with assignment without leaving a current orphan', async () => {
    const s = await section('Petitioner')
    const [removal, creation] = await Promise.all([
      write('delete', `/sections/${s.id}`), write('post', '/documents', { name: 'Racing', sectionId: s.id }),
    ])
    assert.equal(removal.status, 204)
    assert.ok([201, 400].includes(creation.status))
    const data = await template()
    assert.deepEqual(data.sections, [])
    assert.ok(data.documents.every((item) => item.sectionId === null))
    assert.equal(data.matterType.templateRevision, 2 + (creation.status === 201 ? 1 : 0))
    assertDense(data)
  })

  it('rolls back retirement, reassignment, order and revision if the final revision update fails', async () => {
    const s = await section('Petitioner')
    await document('G')
    await document('Grouped', { sectionId: s.id, isKey: true })
    const before = await template()
    const failingDatabase = interceptedDatabase((sql, params, runQuery) => {
      if (sql.includes('SET template_revision = template_revision + 1')) throw new Error('Simulated revision failure')
      return runQuery()
    })
    await assert.rejects(deleteSection(typeId, s.id, failingDatabase), /Simulated revision failure/)
    assert.deepEqual(await template(), before)
    const stored = await database.query('SELECT retired_at FROM app.template_sections WHERE id = $1', [s.id])
    assert.equal(stored.rows[0].retired_at, null)
  })

  it('reads a coherent committed snapshot while another transaction is retiring a section', async () => {
    const s = await section('Petitioner')
    await document('Grouped', { sectionId: s.id })
    const before = await template()
    const arrived = Promise.withResolvers()
    const resume = Promise.withResolvers()
    const pausedDatabase = interceptedDatabase(async (sql, params, runQuery) => {
      const result = await runQuery()
      if (sql.startsWith('UPDATE app.template_sections SET retired_at')) {
        arrived.resolve()
        await resume.promise
      }
      return result
    })
    const pending = deleteSection(typeId, s.id, pausedDatabase)
    try {
      await arrived.promise
      assert.deepEqual(await template(), before)
    } finally {
      resume.resolve()
    }
    await pending
    const after = await template()
    assert.deepEqual(after.sections, [])
    assert.equal(after.documents[0].sectionId, null)
    assert.equal(after.matterType.templateRevision, before.matterType.templateRevision + 1)
  })

  it('enforces same-template foreign keys, clean names, quantities and active uniqueness in PostgreSQL', async () => {
    const s = await section('Foreign', otherTypeId)
    const insert = (name, sectionId = null, quantity = null) => database.query(
      'INSERT INTO app.template_documents (matter_type_id, section_id, name, expected_quantity, position) VALUES ($1, $2, $3, $4, 1)',
      [typeId, sectionId, name, quantity],
    )
    await assert.rejects(insert('Cross type', s.id), { code: '23503', constraint: 'template_documents_section_type_fk' })
    await assert.rejects(insert(' Dirty '), { code: '23514', constraint: 'template_documents_name_format_check' })
    await assert.rejects(insert('Zero', null, 0), { code: '23514', constraint: 'template_documents_quantity_check' })
    await document('Unique')
    await assert.rejects(insert('UNIQUE'), { code: '23505', constraint: 'template_documents_name_active_idx' })
    await assert.rejects(database.query('DELETE FROM app.matter_types WHERE id = $1', [typeId]), { code: '23503' })
  })

  it('keeps definitions and metadata after recreating the app, without private ordering columns', async () => {
    await section('Petitioner')
    await document("O'Brien evidence", { description: "Literal ' quotation", isKey: true })
    const before = await template()
    const app = createApp({ database })
    const response = await request(app).get(path()).set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(response.body.data, before)
    assert.doesNotMatch(JSON.stringify(response.body), /passwordHash|tokenHash|general_group|section_position/)
  })
})
