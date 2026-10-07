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

const database = createTestDatabase()
const runId = randomUUID().replaceAll('-', '').slice(0, 18)
const fixturePassword = 'Learning-only catalog password!42'
const origin = 'http://localhost:5173'
const typeIds = new Set()
const userIds = new Set()
const limitKeys = new Set()
const publicFields = [
  'createdAt', 'description', 'documentCount', 'id', 'keyDocumentCount', 'name',
  'templateRevision', 'templateStatus', 'updatedAt',
]
let server
let administrator
let member
let temporaryMember
let adminSession
let memberSession
let temporarySession
let sequence = 0

function newTypeInput(overrides = {}) {
  sequence += 1
  return { name: `MT ${runId} ${sequence}`, description: 'Integration catalog description', ...overrides }
}

async function signIn(user) {
  for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
    const keys = loginLimitKeys(ip, user.username)
    limitKeys.add(keys.ip)
    limitKeys.add(keys.accountIp)
  }
  const response = await request(server).post('/api/auth/login')
    .set('Origin', origin).send({ username: user.username, password: fixturePassword }).expect(200)
  return {
    cookie: response.headers['set-cookie'][0].split(';')[0],
    csrfToken: response.body.data.csrfToken,
  }
}

async function createType(input = newTypeInput(), session = adminSession) {
  const operation = request(server).post('/api/matter-types').set('Origin', origin)
  if (session) operation.set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken)
  const response = await operation.send(input)
  if (response.status === 201) typeIds.add(response.body.data.id)
  return response
}

function updateType(id, input, session = adminSession) {
  const operation = request(server).patch(`/api/matter-types/${id}`).set('Origin', origin)
  if (session) operation.set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken)
  return operation.send(input)
}

function getType(id, session = memberSession, status = 200) {
  return request(server).get(`/api/matter-types/${id}`).set('Cookie', session.cookie).expect(status)
}

function assertPublicType(matterType) {
  assert.deepEqual(Object.keys(matterType).sort(), publicFields)
  assert.match(matterType.id, /^[a-f0-9-]{36}$/)
  assert.equal(Number.isNaN(Date.parse(matterType.createdAt)), false)
  assert.equal(Number.isNaN(Date.parse(matterType.updatedAt)), false)
}

async function insertDirect(name, description = '') {
  const id = randomUUID()
  typeIds.add(id)
  return database.query(
    'INSERT INTO app.matter_types (id, name, description) VALUES ($1, $2, $3) RETURNING id',
    [id, name, description],
  )
}

describe('matter type API against isolated PostgreSQL', { concurrency: false }, () => {
  before(async () => {
    const passwordHash = await hashPassword(fixturePassword)
    administrator = await insertUser(database, {
      username: `catalog_admin_${runId}`,
      fullName: 'Catalog Integration Administrator', passwordHash, systemRole: 'ADMIN',
    })
    userIds.add(administrator.id)
    member = await insertUser(database, {
      username: `catalog_member_${runId}`,
      fullName: 'Catalog Integration Member', passwordHash, systemRole: 'MEMBER',
    })
    userIds.add(member.id)
    temporaryMember = await insertUser(database, {
      username: `catalog_temp_${runId}`,
      fullName: 'Catalog Temporary Member', passwordHash, systemRole: 'MEMBER',
      mustChangePassword: true,
    })
    userIds.add(temporaryMember.id)
    server = createApp({ database }).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    adminSession = await signIn(administrator)
    memberSession = await signIn(member)
    temporarySession = await signIn(temporaryMember)
  })

  beforeEach(async () => {
    await database.query('DELETE FROM app.matter_types WHERE id = ANY($1::uuid[])', [[...typeIds]])
    typeIds.clear()
    await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])
  })

  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    try {
      await database.query('DELETE FROM app.matter_types WHERE id = ANY($1::uuid[])', [[...typeIds]])
      await database.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [[...userIds]])
      await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])
    } finally {
      await database.end()
    }
  })

  it('requires authentication on every catalog route', async () => {
    await request(server).get('/api/matter-types').expect(401)
    await request(server).get(`/api/matter-types/${randomUUID()}`).expect(401)
    const creation = await createType(newTypeInput(), null)
    assert.equal(creation.status, 401)
    const update = await updateType(randomUUID(), { name: 'New' }, null)
    assert.equal(update.status, 401)
    assert.equal(update.body.error.code, 'AUTHENTICATION_REQUIRED')
  })

  it('returns an empty catalog with a valid pagination envelope', async () => {
    const response = await request(server).get('/api/matter-types')
      .set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(response.body, {
      data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
    assert.equal(response.headers['cache-control'], 'no-store')
  })

  it('creates a cleaned type with UUID and dates without requiring template documents', async () => {
    const input = newTypeInput({ name: ` \tFamily\n\u00a0 Petition ${runId} `, description: '  Catalog info\nSecond line  ' })
    const response = await createType(input)
    assert.equal(response.status, 201)
    const created = response.body.data
    assertPublicType(created)
    assert.equal(created.name, `Family Petition ${runId}`)
    assert.equal(created.description, 'Catalog info\nSecond line')
    assert.equal(response.headers.location, `/api/matter-types/${created.id}`)
    assert.equal(response.headers['cache-control'], 'no-store')
    const stored = await database.query('SELECT name, description FROM app.matter_types WHERE id = $1', [created.id])
    assert.deepEqual(stored.rows[0], { name: created.name, description: created.description })
    const noDescription = await createType({ name: newTypeInput().name })
    assert.equal(noDescription.status, 201)
    assert.equal(noDescription.body.data.description, '')
  })

  it('allows ADMIN and MEMBER to read the same public catalog data', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    for (const session of [adminSession, memberSession]) {
      const item = await getType(creation.body.data.id, session)
      assert.deepEqual(item.body, creation.body)
      assertPublicType(item.body.data)
      assert.equal(item.headers['cache-control'], 'no-store')
      const list = await request(server).get('/api/matter-types').set('Cookie', session.cookie).expect(200)
      assert.deepEqual(list.body.data, [creation.body.data])
    }
  })

  it('rejects MEMBER writes and temporary-password access without changing the catalog', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const id = creation.body.data.id
    const deniedCreate = await createType(newTypeInput(), memberSession)
    assert.equal(deniedCreate.status, 403)
    assert.equal(deniedCreate.body.error.code, 'ADMIN_REQUIRED')
    const deniedUpdate = await updateType(id, { name: 'Unauthorized change' }, memberSession)
    assert.equal(deniedUpdate.status, 403)
    assert.equal(deniedUpdate.body.error.code, 'ADMIN_REQUIRED')
    const requests = [
      request(server).get('/api/matter-types').set('Cookie', temporarySession.cookie),
      request(server).get(`/api/matter-types/${id}`).set('Cookie', temporarySession.cookie),
      createType(newTypeInput(), temporarySession),
      updateType(id, { description: 'Unauthorized' }, temporarySession),
    ]
    for (const operation of requests) {
      const response = await operation
      assert.equal(response.status, 403)
      assert.equal(response.body.error.code, 'PASSWORD_CHANGE_REQUIRED')
    }
    assert.deepEqual((await getType(id)).body, creation.body)
  })

  it('requires matching CSRF, trusted origin and JSON for both write routes', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const id = creation.body.data.id
    for (const method of ['post', 'patch']) {
      const path = method === 'post' ? '/api/matter-types' : `/api/matter-types/${id}`
      for (const csrfToken of [undefined, createToken(), memberSession.csrfToken]) {
        const operation = request(server)[method](path).set('Origin', origin).set('Cookie', adminSession.cookie)
        if (csrfToken) operation.set('X-CSRF-Token', csrfToken)
        const response = await operation.send(newTypeInput()).expect(403)
        assert.equal(response.body.error.code, 'INVALID_CSRF_TOKEN')
      }
      for (const untrustedOrigin of [undefined, 'https://other.example']) {
        const operation = request(server)[method](path).set('Cookie', adminSession.cookie)
          .set('X-CSRF-Token', adminSession.csrfToken)
        if (untrustedOrigin) operation.set('Origin', untrustedOrigin)
        await operation.send(newTypeInput()).expect(403)
      }
      await request(server)[method](path).set('Origin', origin).set('Cookie', adminSession.cookie)
        .set('X-CSRF-Token', adminSession.csrfToken).type('text').send('plain text').expect(415)
    }
    assert.deepEqual((await getType(id)).body, creation.body)
  })

  it('rejects invalid fields and empty PATCH bodies without exposing their values', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const id = creation.body.data.id
    for (const input of [
      {}, { name: '  ' }, { name: 123 }, { name: 'N'.repeat(121) }, { name: 'Invalid\0Name' },
      { name: 'Valid', description: null }, { name: 'Valid', description: 'D'.repeat(1001) },
      { name: 'Valid', description: 'Invalid\0Description' },
      { name: 'Valid', id: randomUUID() }, { name: 'Valid', sections: [] },
      { name: 'Valid', documents: [] }, { name: 'Valid', isActive: true },
    ]) {
      const response = await createType(input)
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
      assert.doesNotMatch(JSON.stringify(response.body), /N{121}|D{1001}/)
    }
    for (const input of [
      {}, { name: '' }, { name: 'N'.repeat(121) }, { description: null },
      { name: 'Invalid\0Name' }, { description: 'Invalid\0Description' },
      { description: 'D'.repeat(1001) }, { name: 'Valid', id }, { createdAt: '2000-01-01' },
    ]) {
      const response = await updateType(id, input).expect(400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
    }
    assert.deepEqual((await getType(id)).body, creation.body)
  })

  it('accepts the maximum field lengths and one-character names', async () => {
    const maximum = await createType({ name: 'M'.repeat(120), description: 'D'.repeat(1000) })
    assert.equal(maximum.status, 201)
    assert.equal(maximum.body.data.name.length, 120)
    assert.equal(maximum.body.data.description.length, 1000)
    const minimum = await createType({ name: 'A' })
    assert.equal(minimum.status, 201)
  })

  it('stores quotes and SQL-like text as literal data through parameterized queries', async () => {
    const name = `O'Brien ${runId}; DROP TABLE app.users; --`
    const creation = await createType({ name, description: "Quoted ' description" })
    assert.equal(creation.status, 201)
    const item = await getType(creation.body.data.id)
    assert.equal(item.body.data.name, name)
    assert.equal(item.body.data.description, "Quoted ' description")
    const users = await database.query('SELECT id FROM app.users WHERE id = ANY($1::uuid[])', [[...userIds]])
    assert.equal(users.rowCount, userIds.size)
  })

  it('rejects equivalent names on create and edit while preserving existing records', async () => {
    const original = await createType({ name: `Family Petition ${runId}` })
    assert.equal(original.status, 201)
    for (const name of [`FAMILY PETITION ${runId}`, ` family   petition ${runId} `]) {
      const duplicate = await createType({ name })
      assert.equal(duplicate.status, 409)
      assert.equal(duplicate.body.error.code, 'MATTER_TYPE_NAME_ALREADY_EXISTS')
      assert.ok(duplicate.body.error.fields.name)
      assert.doesNotMatch(JSON.stringify(duplicate.body), /23505|matter_types_name_unique_ci_idx|Key \(/)
    }
    const other = await createType()
    assert.equal(other.status, 201)
    const collision = await updateType(other.body.data.id, {
      name: `family petition ${runId}`, description: 'Must not be saved',
    }).expect(409)
    assert.equal(collision.body.error.code, 'MATTER_TYPE_NAME_ALREADY_EXISTS')
    assert.deepEqual((await getType(other.body.data.id)).body, other.body)
  })

  it('enforces unique names under simultaneous creation and rename requests', async () => {
    const input = newTypeInput()
    const creations = await Promise.all([
      createType(input), createType({ name: ` ${input.name.toUpperCase()} ` }),
    ])
    assert.deepEqual(creations.map((response) => response.status).sort(), [201, 409])
    const first = await createType()
    const second = await createType()
    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    const sharedName = newTypeInput().name
    const renames = await Promise.all([
      updateType(first.body.data.id, { name: sharedName }),
      updateType(second.body.data.id, { name: sharedName.toUpperCase() }),
    ])
    assert.deepEqual(renames.map((response) => response.status).sort(), [200, 409])
  })

  it('edits only provided fields, keeps the UUID and creation date, and permits clearing descriptions', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const original = creation.body.data
    const rename = await updateType(original.id, { name: ` Renamed   Type ${runId} ` }).expect(200)
    assert.equal(rename.body.data.id, original.id)
    assert.equal(rename.body.data.name, `Renamed Type ${runId}`)
    assert.equal(rename.body.data.description, original.description)
    assert.equal(rename.body.data.createdAt, original.createdAt)
    assert.ok(Date.parse(rename.body.data.updatedAt) >= Date.parse(original.updatedAt))
    const description = await updateType(original.id, { description: '  New description  ' }).expect(200)
    assert.equal(description.body.data.name, rename.body.data.name)
    assert.equal(description.body.data.description, 'New description')
    const emptyDescription = await updateType(original.id, { description: '' }).expect(200)
    assert.equal(emptyDescription.body.data.description, '')
    const sameName = await updateType(original.id, { name: rename.body.data.name.toUpperCase() }).expect(200)
    assert.equal(sameName.body.data.id, original.id)
    assertPublicType(sameName.body.data)
  })

  it('retains both fields when separate partial updates arrive simultaneously', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const id = creation.body.data.id
    const name = `Concurrent Type ${runId}`
    const responses = await Promise.all([
      updateType(id, { name }), updateType(id, { description: 'Concurrent description' }),
    ])
    assert.deepEqual(responses.map((response) => response.status), [200, 200])
    const stored = await getType(id)
    assert.equal(stored.body.data.name, name)
    assert.equal(stored.body.data.description, 'Concurrent description')
  })

  it('paginates alphabetically with stable totals including out-of-range pages', async () => {
    for (const name of [`Zulu ${runId}`, `alpha ${runId}`, `Beta ${runId}`]) {
      assert.equal((await createType({ name })).status, 201)
    }
    const all = await request(server).get('/api/matter-types').set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(all.body.data.map((type) => type.name), [`alpha ${runId}`, `Beta ${runId}`, `Zulu ${runId}`])
    assert.deepEqual(all.body.pagination, { page: 1, limit: 20, total: 3, totalPages: 1 })
    const first = await request(server).get('/api/matter-types?limit=1').set('Cookie', memberSession.cookie).expect(200)
    const second = await request(server).get('/api/matter-types?page=2&limit=1').set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(first.body.data, [all.body.data[0]])
    assert.deepEqual(second.body.data, [all.body.data[1]])
    assert.equal(first.body.pagination.totalPages, 3)
    assert.equal(first.body.pagination.total, second.body.pagination.total)
    const empty = await request(server).get('/api/matter-types?page=100&limit=1')
      .set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(empty.body.data, [])
    assert.deepEqual(empty.body.pagination, { page: 100, limit: 1, total: 3, totalPages: 3 })
  })

  it('distinguishes invalid IDs, missing records and invalid pagination', async () => {
    const invalid = await getType('not-a-uuid', memberSession, 400)
    assert.equal(invalid.body.error.code, 'INVALID_INPUT')
    const missing = await getType(randomUUID(), memberSession, 404)
    assert.equal(missing.body.error.code, 'MATTER_TYPE_NOT_FOUND')
    const invalidUpdate = await updateType('not-a-uuid', { description: 'Info' }).expect(400)
    assert.equal(invalidUpdate.body.error.code, 'INVALID_INPUT')
    const missingUpdate = await updateType(randomUUID(), { description: 'Info' }).expect(404)
    assert.equal(missingUpdate.body.error.code, 'MATTER_TYPE_NOT_FOUND')
    for (const query of ['page=0', 'page=1.5', 'page=100001', 'limit=101', 'limit=-1', 'page=1&page=2', 'unknown=value']) {
      const response = await request(server).get(`/api/matter-types?${query}`)
        .set('Cookie', memberSession.cookie).expect(400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
    }
  })

  it('protects canonical names, uniqueness and description length directly in PostgreSQL', async () => {
    for (const name of ['', '  ', 'Trailing ', ' Leading', 'Two  Spaces', 'Tab\tName', 'NBSP\u00a0Name', 'Wide\u3000Name', 'BOM\ufeffName']) {
      await assert.rejects(insertDirect(name), { code: '23514', constraint: 'matter_types_name_format_check' })
    }
    await assert.rejects(insertDirect('L'.repeat(121)), { code: '22001' })
    await assert.rejects(insertDirect(`Long Description ${runId}`, 'D'.repeat(1001)), {
      code: '23514', constraint: 'matter_types_description_length_check',
    })
    await insertDirect(`Direct Name ${runId}`)
    await assert.rejects(insertDirect(`DIRECT NAME ${runId}`), {
      code: '23505', constraint: 'matter_types_name_unique_ci_idx',
    })
  })

  it('preserves stored catalog data when the app is recreated', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const restartedApp = createApp({ database })
    const response = await request(restartedApp).get(`/api/matter-types/${creation.body.data.id}`)
      .set('Cookie', memberSession.cookie).expect(200)
    assert.deepEqual(response.body, creation.body)
  })

  it('checks the current administrator role before catalog modifications', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    try {
      await database.query("UPDATE app.users SET system_role = 'MEMBER' WHERE id = $1", [administrator.id])
      const denied = await updateType(creation.body.data.id, { description: 'Not authorized anymore' }).expect(403)
      assert.equal(denied.body.error.code, 'ADMIN_REQUIRED')
      await getType(creation.body.data.id, adminSession)
    } finally {
      await database.query("UPDATE app.users SET system_role = 'ADMIN' WHERE id = $1", [administrator.id])
    }
    assert.deepEqual((await getType(creation.body.data.id)).body, creation.body)
  })

  it('does not expose private database errors or provide a deletion route', async () => {
    const creation = await createType()
    assert.equal(creation.status, 201)
    const id = creation.body.data.id
    const failingApp = createApp({ database: {
      query: (sql, params) => {
        if (sql.includes('FROM app.matter_type_template_summary')) throw new Error('Private catalog query detail')
        return database.query(sql, params)
      },
    } })
    const failure = await request(failingApp).get(`/api/matter-types/${id}`)
      .set('Cookie', memberSession.cookie).expect(500)
    assert.equal(failure.body.error.code, 'INTERNAL_SERVER_ERROR')
    assert.doesNotMatch(JSON.stringify(failure.body), /Private catalog query detail/)
    const deletion = await request(server).delete(`/api/matter-types/${id}`)
      .set('Origin', origin).set('Cookie', adminSession.cookie)
      .set('X-CSRF-Token', adminSession.csrfToken).expect(404)
    assert.equal(deletion.body.error.code, 'ROUTE_NOT_FOUND')
    assert.deepEqual((await getType(id)).body, creation.body)
  })
})
