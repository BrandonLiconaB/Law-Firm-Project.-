import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import { createTestDatabase, prepareTestEnvironment } from './testDatabase.js'

prepareTestEnvironment()

const { createApp } = await import('../../src/app.js')
const { hashPassword, verifyPassword } = await import('../../src/modules/auth/password.js')
const { insertUser } = await import('../../src/modules/users/users.repository.js')
const { createToken, loginLimitKeys } = await import('../../src/modules/auth/auth.tokens.js')

const database = createTestDatabase()
const runId = randomUUID().replaceAll('-', '').slice(0, 18)
const fixturePassword = 'Learning-only users password!42'
const origin = 'http://localhost:5173'
const userIds = new Set()
const limitKeys = new Set()
const publicFields = ['createdAt', 'fullName', 'id', 'systemRole', 'updatedAt', 'username']
let server
let administrator
let member
let adminSession
let memberSession
let sequence = 0

function newUserInput(overrides = {}) {
  sequence += 1
  return {
    username: `users_${runId}_${sequence}`,
    fullName: `Created Member ${sequence}`,
    password: fixturePassword,
    ...overrides,
  }
}

function trackLoginKeys(username) {
  for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
    const keys = loginLimitKeys(ip, username)
    limitKeys.add(keys.ip)
    limitKeys.add(keys.accountIp)
  }
}

async function signIn(username) {
  trackLoginKeys(username)
  const response = await request(server).post('/api/auth/login')
    .set('Origin', origin).send({ username, password: fixturePassword }).expect(200)
  return {
    cookie: response.headers['set-cookie'][0].split(';')[0],
    csrfToken: response.body.data.csrfToken,
  }
}

async function createUser(input, session = adminSession) {
  const operation = request(server).post('/api/users').set('Origin', origin)
  if (session) {
    operation.set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken)
  }
  const response = await operation.send(input)
  if (response.status === 201) userIds.add(response.body.data.id)
  return response
}

function assertPublicUser(user) {
  assert.deepEqual(Object.keys(user).sort(), publicFields)
  assert.equal(typeof user.id, 'string')
  assert.equal(Number.isNaN(Date.parse(user.createdAt)), false)
}

describe('administrator user API against isolated PostgreSQL', { concurrency: false }, () => {
  before(async () => {
    const passwordHash = await hashPassword(fixturePassword)
    administrator = await insertUser(database, {
      username: `users_admin_${runId}`,
      fullName: 'Users Integration Administrator',
      passwordHash,
      systemRole: 'ADMIN',
    })
    userIds.add(administrator.id)
    member = await insertUser(database, {
      username: `users_member_${runId}`,
      fullName: 'Users Integration Member',
      passwordHash,
      systemRole: 'MEMBER',
    })
    userIds.add(member.id)

    server = createApp({ database }).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    adminSession = await signIn(administrator.username)
    memberSession = await signIn(member.username)
  })

  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    try {
      await database.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [[...userIds]])
      await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])
    } finally {
      await database.end()
    }
  })

  it('requires authentication on creation, listing and individual queries', async () => {
    await request(server).get('/api/users').expect(401)
    await request(server).get(`/api/users/${member.id}`).expect(401)
    const creation = await createUser(newUserInput(), null)
    assert.equal(creation.status, 401)
    assert.equal(creation.body.error.code, 'AUTHENTICATION_REQUIRED')
  })

  it('rejects MEMBER users for all user management routes, including their own record', async () => {
    await request(server).get('/api/users').set('Cookie', memberSession.cookie).expect(403)
    await request(server).get(`/api/users/${member.id}`)
      .set('Cookie', memberSession.cookie).expect(403)
    const creation = await createUser(newUserInput(), memberSession)
    assert.equal(creation.status, 403)
    assert.equal(creation.body.error.code, 'ADMIN_REQUIRED')
  })

  it('creates a normalized MEMBER with a hash and allows that account to sign in', async () => {
    const input = newUserInput()
    const response = await createUser({
      ...input,
      username: `  ${input.username.toUpperCase()}  `,
      fullName: '  Created Member  ',
    })
    assert.equal(response.status, 201)
    assertPublicUser(response.body.data)
    assert.equal(response.body.data.username, input.username)
    assert.equal(response.body.data.fullName, 'Created Member')
    assert.equal(response.body.data.systemRole, 'MEMBER')
    assert.equal(response.headers.location, `/api/users/${response.body.data.id}`)
    assert.equal(response.headers['cache-control'], 'no-store')

    const stored = await database.query('SELECT password_hash FROM app.users WHERE id = $1', [response.body.data.id])
    assert.match(stored.rows[0].password_hash, /^\$argon2id\$/)
    assert.equal(await verifyPassword(stored.rows[0].password_hash, input.password), true)
    const session = await signIn(input.username)
    await request(server).get('/api/auth/me').set('Cookie', session.cookie).expect(200)
    await request(server).get('/api/users').set('Cookie', session.cookie).expect(403)
  })

  it('returns only public account fields when reading individual users', async () => {
    const creation = await createUser(newUserInput())
    assert.equal(creation.status, 201)
    const response = await request(server).get(`/api/users/${creation.body.data.id}`)
      .set('Cookie', adminSession.cookie).expect(200)
    assert.deepEqual(response.body, creation.body)
    assertPublicUser(response.body.data)
    assert.equal(response.headers['cache-control'], 'no-store')

    const adminResponse = await request(server).get(`/api/users/${administrator.id}`)
      .set('Cookie', adminSession.cookie).expect(200)
    assert.equal(adminResponse.body.data.systemRole, 'ADMIN')
  })

  it('handles case-insensitive duplicate usernames under simultaneous requests', async () => {
    const input = newUserInput()
    const responses = await Promise.all([
      createUser(input),
      createUser({ ...input, username: input.username.toUpperCase() }),
    ])
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
    const duplicate = responses.find((response) => response.status === 409)
    assert.equal(duplicate.body.error.code, 'USERNAME_ALREADY_EXISTS')
    assert.doesNotMatch(JSON.stringify(duplicate.body), /password_hash|argon2id/)
    const count = await database.query('SELECT count(*)::integer AS count FROM app.users WHERE username = $1', [input.username])
    assert.equal(count.rows[0].count, 1)
  })

  it('rejects role changes and unsupported or invalid fields without creating accounts', async () => {
    for (const override of [
      { systemRole: 'ADMIN' },
      { email: 'learning@example.com' },
      { isActive: true },
      { username: 'invalid username' },
      { password: 'too-short' },
      { fullName: ' ' },
    ]) {
      const response = await createUser(newUserInput(override))
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
      assert.doesNotMatch(JSON.stringify(response.body), /Learning-only users password|too-short/)
    }
    const administrators = await database.query("SELECT count(*)::integer AS count FROM app.users WHERE system_role = 'ADMIN'")
    assert.equal(administrators.rows[0].count, 1)
  })

  it('requires matching CSRF, trusted origin and JSON before creating a user', async () => {
    for (const csrfToken of [undefined, createToken(), memberSession.csrfToken]) {
      const operation = request(server).post('/api/users')
        .set('Origin', origin).set('Cookie', adminSession.cookie)
      if (csrfToken) operation.set('X-CSRF-Token', csrfToken)
      const response = await operation.send(newUserInput()).expect(403)
      assert.equal(response.body.error.code, 'INVALID_CSRF_TOKEN')
    }
    await request(server).post('/api/users').set('Cookie', adminSession.cookie)
      .set('X-CSRF-Token', adminSession.csrfToken).send(newUserInput()).expect(403)
    await request(server).post('/api/users').set('Origin', 'https://other.example')
      .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
      .send(newUserInput()).expect(403)
    await request(server).post('/api/users').set('Origin', origin)
      .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
      .type('text').send('plain text').expect(415)
  })

  it('returns bounded, stable pages with correct totals, including empty pages', async () => {
    const first = await request(server).get('/api/users?limit=1')
      .set('Cookie', adminSession.cookie).expect(200)
    const second = await request(server).get('/api/users?page=2&limit=1')
      .set('Cookie', adminSession.cookie).expect(200)
    assert.equal(first.body.data.length, 1)
    assert.equal(second.body.data.length, 1)
    assert.notEqual(first.body.data[0].id, second.body.data[0].id)
    assertPublicUser(first.body.data[0])
    assert.equal(first.body.pagination.total, second.body.pagination.total)
    assert.equal(first.body.pagination.totalPages, first.body.pagination.total)
    assert.equal(first.headers['cache-control'], 'no-store')

    const empty = await request(server).get('/api/users?page=100&limit=1')
      .set('Cookie', adminSession.cookie).expect(200)
    assert.deepEqual(empty.body.data, [])
    assert.equal(empty.body.pagination.total, first.body.pagination.total)
    assert.equal(empty.body.pagination.page, 100)

    const defaults = await request(server).get('/api/users')
      .set('Cookie', adminSession.cookie).expect(200)
    assert.equal(defaults.body.pagination.page, 1)
    assert.equal(defaults.body.pagination.limit, 20)
    assert.ok(defaults.body.data.length <= 20)
  })

  it('distinguishes invalid identifiers, missing users and invalid pagination', async () => {
    const invalid = await request(server).get('/api/users/not-a-uuid')
      .set('Cookie', adminSession.cookie).expect(400)
    assert.equal(invalid.body.error.code, 'INVALID_INPUT')
    const missing = await request(server).get(`/api/users/${randomUUID()}`)
      .set('Cookie', adminSession.cookie).expect(404)
    assert.equal(missing.body.error.code, 'USER_NOT_FOUND')
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'limit=-1', 'page=1&page=2']) {
      await request(server).get(`/api/users?${query}`)
        .set('Cookie', adminSession.cookie).expect(400)
    }
  })
})
