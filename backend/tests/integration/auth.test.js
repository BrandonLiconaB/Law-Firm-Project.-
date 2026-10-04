import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { createTestDatabase, prepareTestEnvironment } from './testDatabase.js'

// Fail before writing if the test configuration points to the development DB.
prepareTestEnvironment()

const { createApp } = await import('../../src/app.js')
const { errorHandler } = await import('../../src/middleware/errorHandler.js')
const { createRequireAuth, requireAdmin } = await import(
  '../../src/modules/auth/auth.middleware.js'
)
const { hashPassword } = await import('../../src/modules/auth/password.js')
const { insertUser } = await import('../../src/modules/users/users.repository.js')
const { consumeLoginAttempt, deleteExpiredAuthenticationData } = await import(
  '../../src/modules/auth/auth.repository.js'
)
const { createToken, hashToken, loginLimitKeys } = await import(
  '../../src/modules/auth/auth.tokens.js'
)
const { LOGIN_WINDOW_SECONDS } = await import(
  '../../src/modules/auth/auth.constants.js'
)

const database = createTestDatabase()
const runId = randomUUID().replaceAll('-', '').slice(0, 18)
const memberUsername = `auth_m_${runId}`
const adminUsername = `auth_a_${runId}`
const missingUsername = `auth_x_${runId}`
const fixturePassword = 'Learning-only password!42'
const origin = 'http://localhost:5173'
const limitKeys = new Set()
const createdUserIds = []
let server
let member
let administrator

for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
  for (const username of [memberUsername, adminUsername, missingUsername]) {
    const keys = loginLimitKeys(ip, username)
    limitKeys.add(keys.ip)
    limitKeys.add(keys.accountIp)
  }
}

function loginRequest(username = memberUsername, password = fixturePassword, cookie) {
  const operation = request(server).post('/api/auth/login').set('Origin', origin)
  if (cookie) operation.set('Cookie', cookie)
  return operation.send({ username, password })
}

function sessionCookie(response) {
  return response.headers['set-cookie'][0].split(';')[0]
}

async function successfulLogin(username = memberUsername, cookie) {
  const response = await loginRequest(username, fixturePassword, cookie)
  assert.equal(response.status, 200)
  return response
}

async function expireSession(token) {
  await database.query(
    `UPDATE app.auth_sessions SET
       created_at = CURRENT_TIMESTAMP - INTERVAL '13 hours',
       expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
     WHERE token_hash = $1`,
    [hashToken(token)],
  )
}

describe('authentication against isolated PostgreSQL', { concurrency: false }, () => {
  before(async () => {
    const passwordHash = await hashPassword(fixturePassword)
    member = await insertUser(database, {
      username: memberUsername,
      fullName: 'Integration Member',
      passwordHash,
      systemRole: 'MEMBER',
    })
    createdUserIds.push(member.id)
    administrator = await insertUser(database, {
      username: adminUsername,
      fullName: 'Integration Admin',
      passwordHash,
      systemRole: 'ADMIN',
    })
    createdUserIds.push(administrator.id)

    server = createApp({ database }).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
  })

  beforeEach(async () => {
    await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [
      [...limitKeys],
    ])
  })

  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    try {
      await database.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [
        createdUserIds,
      ])
      await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [
        [...limitKeys],
      ])
    } finally {
      await database.end()
    }
  })

  it('logs in with a normalized username and stores only the token hash', async () => {
    const response = await successfulLogin(`  ${memberUsername.toUpperCase()}  `)
    const cookie = sessionCookie(response)
    const token = cookie.split('=')[1]
    const stored = await database.query(
      'SELECT token_hash, csrf_token, created_at, expires_at FROM app.auth_sessions WHERE user_id = $1 AND token_hash = $2',
      [member.id, hashToken(token)],
    )
    assert.equal(stored.rowCount, 1)
    assert.notEqual(stored.rows[0].token_hash, token)
    assert.equal(stored.rows[0].csrf_token, response.body.data.csrfToken)
    assert.equal(
      stored.rows[0].expires_at - stored.rows[0].created_at,
      12 * 60 * 60 * 1000,
    )
    assert.deepEqual(response.body.data.user, {
      id: member.id,
      username: memberUsername,
      fullName: 'Integration Member',
      systemRole: 'MEMBER',
      mustChangePassword: false,
    })
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.match(response.headers['set-cookie'][0], /HttpOnly; SameSite=Lax/)
    assert.doesNotMatch(response.headers['set-cookie'][0], /Secure/)
    assert.equal(response.body.data.token, undefined)
    assert.equal(response.body.data.user.passwordHash, undefined)
  })

  it('returns identical errors for incorrect passwords and unknown users', async () => {
    const incorrect = await loginRequest(memberUsername, 'wrong password')
    const unknown = await loginRequest(missingUsername)
    assert.equal(incorrect.status, 401)
    assert.equal(unknown.status, 401)
    assert.deepEqual(incorrect.body, unknown.body)
    assert.equal(incorrect.body.error.code, 'INVALID_CREDENTIALS')
    assert.equal(incorrect.headers['set-cookie'], undefined)
  })

  it('rejects missing origins, foreign origins, unsupported content types and invalid bodies', async () => {
    await request(server).post('/api/auth/login')
      .send({ username: memberUsername, password: fixturePassword }).expect(403)
    await request(server).post('/api/auth/login').set('Origin', 'https://other.example')
      .send({ username: memberUsername, password: fixturePassword }).expect(403)
    await request(server).post('/api/auth/login').set('Origin', origin)
      .type('text').send('plain text').expect(415)
    await request(server).post('/api/auth/login').set('Origin', origin)
      .send({ username: memberUsername }).expect(400)
  })

  it('requires a valid session and clears invalid cookies', async () => {
    const missing = await request(server).get('/api/auth/me').expect(401)
    assert.equal(missing.body.error.code, 'AUTHENTICATION_REQUIRED')
    assert.match(missing.headers['set-cookie'][0], /Expires=.*1970/)
    await request(server).get('/api/auth/me')
      .set('Cookie', 'gestor_session=invalid').expect(401)
  })

  it('keeps sessions after recreating the app without renewing their expiry', async () => {
    const response = await successfulLogin()
    const cookie = sessionCookie(response)
    const restartedApp = createApp({ database })
    const me = await request(restartedApp).get('/api/auth/me').set('Cookie', cookie).expect(200)
    assert.deepEqual(me.body, response.body)
    assert.equal(me.headers['set-cookie'], undefined)
    assert.equal(me.headers['cache-control'], 'no-store')
  })

  it('requires the correct CSRF token and logout revokes only the current device', async () => {
    const first = await successfulLogin()
    const second = await successfulLogin()
    const firstCookie = sessionCookie(first)
    const secondCookie = sessionCookie(second)
    for (const csrfToken of [undefined, createToken(), second.body.data.csrfToken]) {
      const operation = request(server).post('/api/auth/logout')
        .set('Origin', origin).set('Cookie', firstCookie)
      if (csrfToken) operation.set('X-CSRF-Token', csrfToken)
      const response = await operation.expect(403)
      assert.equal(response.body.error.code, 'INVALID_CSRF_TOKEN')
    }
    await request(server).post('/api/auth/logout')
      .set('Origin', origin).set('Cookie', firstCookie)
      .set('X-CSRF-Token', first.body.data.csrfToken).expect(204)
    await request(server).get('/api/auth/me').set('Cookie', firstCookie).expect(401)
    await request(server).get('/api/auth/me').set('Cookie', secondCookie).expect(200)
  })

  it('rotates a previous browser session on successful login', async () => {
    const first = await successfulLogin()
    const second = await successfulLogin(memberUsername, sessionCookie(first))
    assert.notEqual(sessionCookie(first), sessionCookie(second))
    assert.notEqual(first.body.data.csrfToken, second.body.data.csrfToken)
    await request(server).get('/api/auth/me').set('Cookie', sessionCookie(first)).expect(401)
    await request(server).get('/api/auth/me').set('Cookie', sessionCookie(second)).expect(200)
  })

  it('rejects expired sessions even before their database rows are cleaned', async () => {
    const response = await successfulLogin()
    const cookie = sessionCookie(response)
    await expireSession(cookie.split('=')[1])
    await request(server).get('/api/auth/me').set('Cookie', cookie).expect(401)
  })

  it('checks administrator permissions from the current database role', async () => {
    const adminLogin = await successfulLogin(adminUsername)
    const memberLogin = await successfulLogin()
    const permissionApp = express()
    permissionApp.use(cookieParser())
    permissionApp.get('/admin', createRequireAuth(database), requireAdmin,
      (req, res) => res.status(204).end())
    permissionApp.use(errorHandler)

    await request(permissionApp).get('/admin').set('Cookie', sessionCookie(adminLogin)).expect(204)
    await request(permissionApp).get('/admin').set('Cookie', sessionCookie(memberLogin)).expect(403)
    try {
      await database.query("UPDATE app.users SET system_role = 'MEMBER' WHERE id = $1", [administrator.id])
      await request(permissionApp).get('/admin').set('Cookie', sessionCookie(adminLogin)).expect(403)
    } finally {
      await database.query("UPDATE app.users SET system_role = 'ADMIN' WHERE id = $1", [administrator.id])
    }
  })

  it('enforces the account/IP limit atomically under simultaneous attempts and app restarts', async () => {
    const results = await Promise.all(
      Array.from({ length: 11 }, () => loginRequest(missingUsername)),
    )
    assert.equal(results.filter((response) => response.status === 401).length, 10)
    assert.equal(results.filter((response) => response.status === 429).length, 1)
    const rateLimited = results.find((response) => response.status === 429)
    assert.equal(rateLimited.body.error.code, 'LOGIN_RATE_LIMITED')
    assert.ok(Number(rateLimited.headers['retry-after']) > 0)

    const restartedServer = createApp({ database }).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
      restartedServer.once('listening', resolve)
      restartedServer.once('error', reject)
    })
    try {
      await request(restartedServer).post('/api/auth/login')
        .set('Origin', origin)
        .send({ username: missingUsername, password: fixturePassword }).expect(429)
    } finally {
      restartedServer.closeAllConnections()
      await new Promise((resolve, reject) => {
        restartedServer.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('enforces the shared IP limit and resets expired windows', async () => {
    const keys = loginLimitKeys('127.0.0.1', memberUsername)
    await Promise.all(Array.from({ length: 50 }, () =>
      consumeLoginAttempt(database, keys.ip, 50, LOGIN_WINDOW_SECONDS)))
    const blocked = await loginRequest()
    assert.equal(blocked.status, 429)

    await database.query(
      "UPDATE app.auth_login_limits SET window_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE key_hash = $1",
      [keys.ip],
    )
    await successfulLogin()
    const reset = await database.query('SELECT attempts FROM app.auth_login_limits WHERE key_hash = $1', [keys.ip])
    assert.equal(reset.rows[0].attempts, 1)
  })

  it('cleans expired sessions and login counters while preserving valid sessions', async () => {
    const expired = await successfulLogin()
    const valid = await successfulLogin()
    await expireSession(sessionCookie(expired).split('=')[1])
    const cleanupKey = hashToken(`cleanup-${runId}`)
    limitKeys.add(cleanupKey)
    await database.query(
      `INSERT INTO app.auth_login_limits (key_hash, attempts, window_expires_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP - INTERVAL '1 second')`,
      [cleanupKey],
    )
    const removed = await deleteExpiredAuthenticationData(database)
    assert.ok(removed.sessions >= 1)
    assert.ok(removed.loginLimits >= 1)
    await request(server).get('/api/auth/me').set('Cookie', sessionCookie(expired)).expect(401)
    await request(server).get('/api/auth/me').set('Cookie', sessionCookie(valid)).expect(200)
    const counter = await database.query('SELECT key_hash FROM app.auth_login_limits WHERE key_hash = $1', [cleanupKey])
    assert.equal(counter.rowCount, 0)
  })
})
