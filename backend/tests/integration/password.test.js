import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { createTestDatabase, prepareTestEnvironment } from './testDatabase.js'

prepareTestEnvironment()

const { createApp } = await import('../../src/app.js')
const { errorHandler } = await import('../../src/middleware/errorHandler.js')
const { createRequireAuth } = await import('../../src/modules/auth/auth.middleware.js')
const { login, resolveSession } = await import('../../src/modules/auth/auth.service.js')
const { hashPassword, verifyPassword } = await import('../../src/modules/auth/password.js')
const { changeOwnPassword, recoverAdministrator, resetMemberPassword } = await import(
  '../../src/modules/auth/password.service.js'
)
const { insertUser } = await import('../../src/modules/users/users.repository.js')
const { createToken, loginLimitKeys, passwordLimitKey } = await import(
  '../../src/modules/auth/auth.tokens.js'
)

const database = createTestDatabase()
const runId = randomUUID().replaceAll('-', '').slice(0, 18)
const fixturePassword = 'Learning-only password management!42'
const newPassword = 'Changed learning-only password!43'
const temporaryPassword = 'Temporary learning-only password!44'
const origin = 'http://localhost:5173'
const userIds = new Set()
const limitKeys = new Set()
let server
let administrator
let member
let initialHash

function trackLoginKeys(username) {
  for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
    const keys = loginLimitKeys(ip, username)
    limitKeys.add(keys.ip)
    limitKeys.add(keys.accountIp)
  }
}

async function signIn(user = member, password = fixturePassword) {
  trackLoginKeys(user.username)
  const response = await request(server).post('/api/auth/login')
    .set('Origin', origin).send({ username: user.username, password }).expect(200)
  return {
    cookie: response.headers['set-cookie'][0].split(';')[0],
    csrfToken: response.body.data.csrfToken,
    data: response.body.data,
  }
}

function changePassword(session, input = {}) {
  return request(server).post('/api/auth/change-password')
    .set('Origin', origin).set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrfToken)
    .send({ currentPassword: fixturePassword, newPassword, ...input })
}

function resetPassword(session, id = member.id, input = {}) {
  return request(server).post(`/api/users/${id}/reset-password`)
    .set('Origin', origin).set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrfToken)
    .send({ administratorPassword: fixturePassword, newPassword: temporaryPassword, ...input })
}

function me(session, status = 200) {
  return request(server).get('/api/auth/me').set('Cookie', session.cookie).expect(status)
}

async function storedCredentials(id = member.id) {
  const result = await database.query(
    'SELECT password_hash, must_change_password FROM app.users WHERE id = $1', [id],
  )
  return result.rows[0]
}

async function sessionCount(id = member.id) {
  const result = await database.query(
    'SELECT count(*)::integer AS count FROM app.auth_sessions WHERE user_id = $1', [id],
  )
  return result.rows[0].count
}

async function sessionAuth(session) {
  return resolveSession(database, session.cookie.split('=')[1])
}

// Intercept timing or inject a failure while still running every query on PostgreSQL.
function interceptedDatabase(intercept) {
  return {
    query: (...args) => database.query(...args),
    connect: async () => {
      const client = await database.connect()
      return {
        query: (sql, params) => intercept(sql, params, () => client.query(sql, params)),
        release: () => client.release(),
      }
    },
  }
}

describe('password lifecycle against isolated PostgreSQL', { concurrency: false, timeout: 60000 }, () => {
  before(async () => {
    initialHash = await hashPassword(fixturePassword)
    administrator = await insertUser(database, {
      username: `password_admin_${runId}`,
      fullName: 'Password Integration Administrator',
      passwordHash: initialHash,
      systemRole: 'ADMIN',
    })
    userIds.add(administrator.id)
    member = await insertUser(database, {
      username: `password_member_${runId}`,
      fullName: 'Password Integration Member',
      passwordHash: initialHash,
      systemRole: 'MEMBER',
    })
    userIds.add(member.id)
    for (const user of [administrator, member]) {
      trackLoginKeys(user.username)
      for (const action of ['change', 'reset']) limitKeys.add(passwordLimitKey(action, user.id))
    }
    server = createApp({ database }).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
  })

  beforeEach(async () => {
    await database.query(
      'UPDATE app.users SET password_hash = $2, must_change_password = false WHERE id = ANY($1::uuid[])',
      [[administrator.id, member.id], initialHash],
    )
    await database.query('DELETE FROM app.auth_sessions WHERE user_id = ANY($1::uuid[])', [[...userIds]])
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
      await database.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [[...userIds]])
      await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])
    } finally {
      await database.end()
    }
  })

  it('requires an active session, CSRF, trusted origin and JSON for password changes', async () => {
    await request(server).post('/api/auth/change-password').set('Origin', origin)
      .send({ currentPassword: fixturePassword, newPassword }).expect(401)
    const session = await signIn()
    for (const csrfToken of [undefined, createToken()]) {
      const operation = request(server).post('/api/auth/change-password')
        .set('Origin', origin).set('Cookie', session.cookie)
      if (csrfToken) operation.set('X-CSRF-Token', csrfToken)
      await operation.send({ currentPassword: fixturePassword, newPassword }).expect(403)
    }
    for (const untrustedOrigin of [undefined, 'https://other.example']) {
      const operation = request(server).post('/api/auth/change-password')
        .set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken)
      if (untrustedOrigin) operation.set('Origin', untrustedOrigin)
      await operation.send({ currentPassword: fixturePassword, newPassword }).expect(403)
    }
    await request(server).post('/api/auth/change-password').set('Origin', origin)
      .set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken)
      .type('text').send('plain text').expect(415)
    assert.equal((await storedCredentials()).password_hash, initialHash)
  })

  it('rejects incorrect proof, unchanged passwords and invalid input without revoking sessions', async () => {
    const session = await signIn()
    const incorrect = await changePassword(session, { currentPassword: 'incorrect proof' }).expect(400)
    assert.equal(incorrect.body.error.code, 'CURRENT_PASSWORD_INCORRECT')
    const unchanged = await changePassword(session, { newPassword: fixturePassword }).expect(400)
    assert.equal(unchanged.body.error.code, 'PASSWORD_UNCHANGED')
    for (const input of [{ newPassword: 'short' }, { newPassword: 'x'.repeat(129) }, { systemRole: 'ADMIN' }]) {
      const response = await changePassword(session, input).expect(400)
      assert.equal(response.body.error.code, 'INVALID_INPUT')
      assert.doesNotMatch(JSON.stringify(response.body), /learning-only|incorrect proof/)
    }
    assert.equal((await storedCredentials()).password_hash, initialHash)
    await me(session)
  })

  it('allows MEMBER and ADMIN to change their own password and revokes every device', async () => {
    for (const user of [member, administrator]) {
      const first = await signIn(user)
      const second = await signIn(user)
      const response = await changePassword(first).expect(204)
      assert.match(response.headers['set-cookie'][0], /Expires=.*1970/)
      assert.equal(response.headers['cache-control'], 'no-store')
      await me(first, 401)
      await me(second, 401)
      assert.equal(await sessionCount(user.id), 0)
      const stored = await storedCredentials(user.id)
      assert.equal(await verifyPassword(stored.password_hash, newPassword), true)
      assert.equal(stored.must_change_password, false)
      await request(server).post('/api/auth/login').set('Origin', origin)
        .send({ username: user.username, password: fixturePassword }).expect(401)
      assert.equal((await signIn(user, newPassword)).data.user.mustChangePassword, false)
    }
  })

  it('restricts a newly created temporary account until it chooses a personal password', async () => {
    const adminSession = await signIn(administrator)
    const username = `password_new_${runId}`
    const creation = await request(server).post('/api/users').set('Origin', origin)
      .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
      .send({ username, fullName: 'Temporary Integration Member', password: fixturePassword })
      .expect(201)
    const user = creation.body.data
    userIds.add(user.id)
    limitKeys.add(passwordLimitKey('change', user.id))
    assert.equal(user.mustChangePassword, true)
    const session = await signIn(user)
    assert.equal(session.data.user.mustChangePassword, true)
    assert.equal((await me(session)).body.data.user.mustChangePassword, true)
    const blocked = await request(server).get('/api/users').set('Cookie', session.cookie).expect(403)
    assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED')

    const protectedApp = express()
    protectedApp.use(cookieParser())
    protectedApp.get('/protected', createRequireAuth(database), (req, res) => res.status(204).end())
    protectedApp.use(errorHandler)
    await request(protectedApp).get('/protected').set('Cookie', session.cookie).expect(403)
    await changePassword(session).expect(204)
    const personalSession = await signIn(user, newPassword)
    assert.equal(personalSession.data.user.mustChangePassword, false)
    await request(protectedApp).get('/protected').set('Cookie', personalSession.cookie).expect(204)
    // Password completion removes only the temporary restriction, not role authorization.
    const stillMember = await request(server).get('/api/users')
      .set('Cookie', personalSession.cookie).expect(403)
    assert.equal(stillMember.body.error.code, 'ADMIN_REQUIRED')
  })

  it('allows logout while a temporary password is pending', async () => {
    await database.query('UPDATE app.users SET must_change_password = true WHERE id = $1', [member.id])
    const session = await signIn()
    await request(server).post('/api/auth/logout').set('Origin', origin)
      .set('Cookie', session.cookie).set('X-CSRF-Token', session.csrfToken).expect(204)
    await me(session, 401)
  })

  it('requires administrator permission, CSRF, origin and JSON for a member reset', async () => {
    await request(server).post(`/api/users/${member.id}/reset-password`)
      .set('Origin', origin).send({ administratorPassword: fixturePassword, newPassword }).expect(401)
    const memberSession = await signIn()
    const denied = await resetPassword(memberSession).expect(403)
    assert.equal(denied.body.error.code, 'ADMIN_REQUIRED')
    const adminSession = await signIn(administrator)
    await request(server).post(`/api/users/${member.id}/reset-password`)
      .set('Origin', origin).set('Cookie', adminSession.cookie)
      .send({ administratorPassword: fixturePassword, newPassword }).expect(403)
    await request(server).post(`/api/users/${member.id}/reset-password`)
      .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
      .send({ administratorPassword: fixturePassword, newPassword }).expect(403)
    await request(server).post(`/api/users/${member.id}/reset-password`).set('Origin', origin)
      .set('Cookie', adminSession.cookie).set('X-CSRF-Token', adminSession.csrfToken)
      .type('text').send('plain text').expect(415)
    assert.equal((await storedCredentials()).password_hash, initialHash)
  })

  it('rechecks administrator proof and rejects missing or non-MEMBER targets', async () => {
    const adminSession = await signIn(administrator)
    const memberSession = await signIn()
    const wrongProof = await resetPassword(adminSession, member.id, {
      administratorPassword: 'incorrect administrator proof',
    }).expect(400)
    assert.equal(wrongProof.body.error.code, 'ADMIN_PASSWORD_INCORRECT')
    const samePassword = await resetPassword(adminSession, member.id, {
      newPassword: fixturePassword,
    }).expect(400)
    assert.equal(samePassword.body.error.code, 'PASSWORD_UNCHANGED')
    const self = await resetPassword(adminSession, administrator.id).expect(400)
    assert.equal(self.body.error.code, 'PASSWORD_RESET_NOT_ALLOWED')
    const missing = await resetPassword(adminSession, randomUUID()).expect(404)
    assert.equal(missing.body.error.code, 'USER_NOT_FOUND')
    const invalid = await resetPassword(adminSession, 'not-a-uuid').expect(400)
    assert.equal(invalid.body.error.code, 'INVALID_INPUT')
    await resetPassword(adminSession, member.id, { newPassword: 'short' }).expect(400)
    await resetPassword(adminSession, member.id, { mustChangePassword: false }).expect(400)
    assert.equal((await storedCredentials()).password_hash, initialHash)
    await me(memberSession)
    await me(adminSession)
  })

  it('resets a MEMBER, revokes its sessions and keeps the administrator signed in', async () => {
    const adminSession = await signIn(administrator)
    const first = await signIn()
    const second = await signIn()
    const response = await resetPassword(adminSession).expect(204)
    assert.equal(response.headers['set-cookie'], undefined)
    await me(first, 401)
    await me(second, 401)
    await me(adminSession)
    assert.equal(await sessionCount(), 0)
    const stored = await storedCredentials()
    assert.equal(await verifyPassword(stored.password_hash, temporaryPassword), true)
    assert.equal(stored.must_change_password, true)
    await request(server).post('/api/auth/login').set('Origin', origin)
      .send({ username: member.username, password: fixturePassword }).expect(401)
    const temporarySession = await signIn(member, temporaryPassword)
    assert.equal(temporarySession.data.user.mustChangePassword, true)
    await changePassword(temporarySession, { currentPassword: temporaryPassword }).expect(204)
    assert.equal((await signIn(member, newPassword)).data.user.mustChangePassword, false)
    await me(adminSession)
  })

  it('persists the five-attempt personal limit across sessions and app recreation', async () => {
    const session = await signIn()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await changePassword(session, { currentPassword: 'incorrect proof' }).expect(400)
    }
    const otherDevice = await signIn()
    const restartedApp = createApp({ database })
    const blocked = await request(restartedApp).post('/api/auth/change-password')
      .set('Origin', origin).set('Cookie', otherDevice.cookie)
      .set('X-CSRF-Token', otherDevice.csrfToken)
      .send({ currentPassword: fixturePassword, newPassword }).expect(429)
    assert.equal(blocked.body.error.code, 'PASSWORD_RATE_LIMITED')
    assert.ok(Number(blocked.headers['retry-after']) > 0)
    await me(session)
    await database.query(
      "UPDATE app.auth_login_limits SET window_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE key_hash = $1",
      [passwordLimitKey('change', member.id)],
    )
    await changePassword(session).expect(204)
  })

  it('limits administrative resets separately from personal password changes', async () => {
    const adminSession = await signIn(administrator)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await resetPassword(adminSession, member.id, { administratorPassword: 'incorrect proof' }).expect(400)
    }
    const blocked = await resetPassword(adminSession).expect(429)
    assert.equal(blocked.body.error.code, 'PASSWORD_RATE_LIMITED')
    assert.ok(Number(blocked.headers['retry-after']) > 0)
    assert.equal((await storedCredentials()).password_hash, initialHash)
    await changePassword(adminSession).expect(204)
  })

  it('allows only one simultaneous password change from the same old sessions', async () => {
    const first = await signIn()
    const second = await signIn()
    const alternatePassword = 'Alternative learning-only password!45'
    const results = await Promise.all([
      changePassword(first),
      changePassword(second, { newPassword: alternatePassword }),
    ])
    assert.deepEqual(results.map((result) => result.status).sort(), [204, 401])
    const stored = await storedCredentials()
    const matches = await Promise.all([newPassword, alternatePassword].map(
      (password) => verifyPassword(stored.password_hash, password),
    ))
    assert.equal(matches.filter(Boolean).length, 1)
    assert.equal(await sessionCount(), 0)
  })

  it('rolls back the hash and flag when session revocation fails', async () => {
    const session = await signIn()
    const auth = await sessionAuth(session)
    const failingDatabase = interceptedDatabase((sql, params, runQuery) => {
      if (sql.startsWith('DELETE FROM app.auth_sessions WHERE user_id')) {
        throw new Error('Simulated session revocation failure')
      }
      return runQuery()
    })
    await assert.rejects(changeOwnPassword(auth, {
      currentPassword: fixturePassword, newPassword,
    }, failingDatabase), /Simulated session revocation failure/)
    assert.deepEqual(await storedCredentials(), {
      password_hash: initialHash, must_change_password: false,
    })
    await me(session)
  })

  it('rejects an old-password login if reset commits before its session transaction', async () => {
    const adminSession = await signIn(administrator)
    const arrived = Promise.withResolvers()
    const resume = Promise.withResolvers()
    const pausedDatabase = interceptedDatabase(async (sql, params, runQuery) => {
      if (sql.includes('FOR SHARE') && params[0] === member.id) {
        arrived.resolve()
        await resume.promise
      }
      return runQuery()
    })
    const pendingLogin = login(pausedDatabase, {
      username: member.username, password: fixturePassword,
    }).then((result) => ({ result }), (error) => ({ error }))
    try {
      await arrived.promise
      await resetPassword(adminSession).expect(204)
    } finally {
      resume.resolve()
    }
    const outcome = await pendingLogin
    assert.equal(outcome.error?.code, 'INVALID_CREDENTIALS')
    assert.equal(await sessionCount(), 0)
  })

  it('revokes a concurrent old-password login when its transaction commits first', async () => {
    const adminSession = await signIn(administrator)
    const auth = await sessionAuth(adminSession)
    const beforeCommit = Promise.withResolvers()
    const resume = Promise.withResolvers()
    const resetArrived = Promise.withResolvers()
    const pausedLoginDatabase = interceptedDatabase(async (sql, params, runQuery) => {
      if (sql === 'COMMIT') {
        beforeCommit.resolve()
        await resume.promise
      }
      return runQuery()
    })
    const resetDatabase = interceptedDatabase((sql, params, runQuery) => {
      if (sql.includes('FOR UPDATE') && params[0] === member.id) resetArrived.resolve()
      return runQuery()
    })
    const pendingLogin = login(pausedLoginDatabase, {
      username: member.username, password: fixturePassword,
    })
    let pendingReset
    try {
      await beforeCommit.promise
      pendingReset = resetMemberPassword(auth, member.id, {
        administratorPassword: fixturePassword, newPassword: temporaryPassword,
      }, resetDatabase)
      await resetArrived.promise
    } finally {
      resume.resolve()
    }
    const loginResult = await pendingLogin
    await pendingReset
    assert.equal(await resolveSession(database, loginResult.token), null)
    assert.equal(await sessionCount(), 0)
  })

  it('rejects a revoked session even if it was resolved before a password reset', async () => {
    const adminSession = await signIn(administrator)
    const oldSession = await signIn()
    const oldAuth = await sessionAuth(oldSession)
    await resetPassword(adminSession).expect(204)
    await assert.rejects(changeOwnPassword(oldAuth, {
      currentPassword: temporaryPassword, newPassword,
    }, database), { code: 'AUTHENTICATION_REQUIRED' })
    assert.equal((await storedCredentials()).must_change_password, true)
  })

  it('rejects an expired session inside the password transaction', async () => {
    const session = await signIn()
    const auth = await sessionAuth(session)
    await database.query(
      `UPDATE app.auth_sessions SET
         created_at = CURRENT_TIMESTAMP - INTERVAL '13 hours',
         expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
       WHERE id = $1`,
      [auth.sessionId],
    )
    await assert.rejects(changeOwnPassword(auth, {
      currentPassword: fixturePassword, newPassword,
    }, database), { code: 'AUTHENTICATION_REQUIRED' })
    assert.equal((await storedCredentials()).password_hash, initialHash)
  })

  it('rechecks the administrator session before performing a reset', async () => {
    const session = await signIn(administrator)
    const staleAuth = await sessionAuth(session)
    await changePassword(session).expect(204)
    await assert.rejects(resetMemberPassword(staleAuth, member.id, {
      administratorPassword: newPassword, newPassword: temporaryPassword,
    }, database), { code: 'AUTHENTICATION_REQUIRED' })
    assert.equal((await storedCredentials()).password_hash, initialHash)
  })

  it('recovers only an existing administrator and revokes all its sessions', async () => {
    const first = await signIn(administrator)
    const second = await signIn(administrator)
    const result = await recoverAdministrator({
      username: `  ${administrator.username.toUpperCase()}  `, newPassword,
    }, database)
    assert.deepEqual(result, { id: administrator.id, username: administrator.username })
    await me(first, 401)
    await me(second, 401)
    const stored = await storedCredentials(administrator.id)
    assert.equal(await verifyPassword(stored.password_hash, newPassword), true)
    assert.equal(stored.must_change_password, false)
    assert.equal((await signIn(administrator, newPassword)).data.user.mustChangePassword, false)
  })

  it('does not recover a MEMBER, a missing administrator or an unchanged password', async () => {
    for (const username of [member.username, `missing_${runId}`]) {
      await assert.rejects(recoverAdministrator({ username, newPassword }, database), { code: 'ADMIN_NOT_FOUND' })
    }
    await assert.rejects(recoverAdministrator({
      username: administrator.username, newPassword: fixturePassword,
    }, database), { code: 'PASSWORD_UNCHANGED' })
    assert.equal((await storedCredentials(administrator.id)).password_hash, initialHash)
    assert.equal((await storedCredentials()).password_hash, initialHash)
  })
})
