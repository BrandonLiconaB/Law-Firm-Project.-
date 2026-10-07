import { before, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createAuthSession } from '../../src/features/auth/services/authSession.js'
import { createUsersStore } from '../../src/features/users/services/usersStore.js'
import { createBackendFixture, createCookieFetch } from '../support/backendFixture.mjs'
import { createTestDatabase } from '../../../backend/tests/integration/testDatabase.js'

let fixture
let admin
let store
let user
let memberSession
const createdIds = []
const temporaryPassword = 'Fictitious assigned password!42'
const personalPassword = 'Fictitious personal password!43'
const resetPassword = 'Fictitious reset password!44'
const sessionFor = () => createAuthSession({ baseUrl: `${fixture.baseUrl}/api`, fetchImpl: createCookieFetch(fixture.origin) })

describe('user management frontend connected to Express and isolated PostgreSQL', { concurrency: false, timeout: 120000 }, () => {
  before(async () => {
    fixture = await createBackendFixture()
    admin = sessionFor()
    await admin.login({ username: fixture.users.admin.username, password: fixture.password })
    store = createUsersStore(admin.api)
  })
  after(async () => {
    await fixture?.close()
    const database = createTestDatabase()
    try {
      const remaining = await database.query('SELECT id FROM app.users WHERE id = ANY($1::uuid[])', [createdIds])
      assert.equal(remaining.rowCount, 0, 'The fixture must remove every account created by its API.')
    } finally { await database.end() }
  })

  it('creates a MEMBER with a temporary password and reloads only public fields', async () => {
    user = await store.createUser({ fullName: '  Connected Team User  ', username: ` QA_${randomUUID().slice(0, 8).toUpperCase()} `, password: temporaryPassword })
    createdIds.push(user.id)
    assert.equal(user.fullName, 'Connected Team User')
    assert.equal(user.username, user.username.toLowerCase())
    assert.equal(user.systemRole, 'MEMBER')
    assert.equal(user.mustChangePassword, true)
    const reloaded = createUsersStore(admin.api)
    const account = await reloaded.loadUser(user.id)
    assert.equal(account.id, user.id)
    assert.doesNotMatch(JSON.stringify(reloaded.getSnapshot()), /Fictitious assigned|passwordHash|password_hash/)
    memberSession = sessionFor()
    await memberSession.login({ username: user.username, password: temporaryPassword })
    await assert.rejects(memberSession.api.request('/matter-types'), { code: 'PASSWORD_CHANGE_REQUIRED' })
    await memberSession.changePassword({ currentPassword: temporaryPassword, newPassword: personalPassword })
    await memberSession.login({ username: user.username, password: personalPassword })
    assert.equal(memberSession.getSnapshot().user.mustChangePassword, false)
    const refreshed = await store.loadUser(user.id)
    assert.equal(refreshed.mustChangePassword, false)
  })

  it('rejects duplicate usernames without changing stored accounts', async () => {
    await assert.rejects(store.createUser({ fullName: 'Duplicate', username: user.username.toUpperCase(), password: temporaryPassword }), { code: 'USERNAME_ALREADY_EXISTS', status: 409 })
    const rows = await fixture.database.query('SELECT id FROM app.users WHERE username = $1', [user.username])
    assert.equal(rows.rowCount, 1)
  })

  it('reads separate pages and server totals without fetching the whole directory', async () => {
    for (let index = 0; index < 18; index += 1) {
      const account = await store.createUser({ fullName: `Paged User ${index}`, username: `page_${randomUUID().slice(0, 8)}_${index}`, password: temporaryPassword })
      createdIds.push(account.id)
    }
    const first = await store.loadUsers(1)
    assert.equal(first.data.length, 20)
    assert.equal(first.pagination.total, 22)
    assert.equal(first.pagination.totalPages, 2)
    const second = await store.loadUsers(2)
    assert.equal(second.data.length, 2)
    assert.equal(new Set([...first.data, ...second.data].map((account) => account.id)).size, 22)
    const empty = await store.loadUsers(100)
    assert.equal(empty.data.length, 0)
    assert.equal(empty.pagination.total, 22)
  })

  it('rejects an incorrect administrator password and keeps the user session active', async () => {
    await assert.rejects(store.resetPassword(user.id, { administratorPassword: 'Incorrect fictitious password', newPassword: resetPassword }), { code: 'ADMIN_PASSWORD_INCORRECT' })
    await memberSession.restore()
    assert.equal(memberSession.getSnapshot().status, 'Authenticated')
    const account = await store.loadUser(user.id)
    assert.equal(account.mustChangePassword, false)
  })

  it('resets the MEMBER, revokes sessions, and requires replacement of the new temporary password', async () => {
    await store.resetPassword(user.id, { administratorPassword: fixture.password, newPassword: resetPassword })
    assert.equal(store.getSnapshot().details[user.id].data.mustChangePassword, true)
    await memberSession.restore()
    assert.equal(memberSession.getSnapshot().status, 'Anonymous')
    await assert.rejects(memberSession.login({ username: user.username, password: personalPassword }), { status: 401 })
    await memberSession.login({ username: user.username, password: resetPassword })
    assert.equal(memberSession.getSnapshot().user.mustChangePassword, true)
    await assert.rejects(memberSession.api.request('/matter-types'), { code: 'PASSWORD_CHANGE_REQUIRED' })
    await memberSession.changePassword({ currentPassword: resetPassword, newPassword: personalPassword })
    await memberSession.login({ username: user.username, password: personalPassword })
    assert.equal(memberSession.getSnapshot().user.mustChangePassword, false)
  })

  it('MEMBER cannot list, inspect, create or reset users, even through direct API calls', async () => {
    const forbidden = createUsersStore(memberSession.api)
    await forbidden.loadUsers()
    assert.equal(forbidden.getSnapshot().list.error.code, 'ADMIN_REQUIRED')
    await forbidden.loadUser(user.id)
    assert.equal(forbidden.getSnapshot().details[user.id].error.code, 'ADMIN_REQUIRED')
    await assert.rejects(forbidden.createUser({ fullName: 'Forbidden', username: 'forbidden', password: temporaryPassword }), { code: 'ADMIN_REQUIRED' })
    await assert.rejects(forbidden.resetPassword(user.id, { administratorPassword: fixture.password, newPassword: resetPassword }), { code: 'ADMIN_REQUIRED' })
    assert.equal(memberSession.getSnapshot().status, 'Authenticated')
  })

  it('handles missing users and the backend rejects administrator password reset', async () => {
    const missingId = randomUUID()
    await store.loadUser(missingId)
    assert.equal(store.getSnapshot().details[missingId].error.code, 'USER_NOT_FOUND')
    await assert.rejects(store.resetPassword(fixture.users.admin.id, { administratorPassword: fixture.password, newPassword: resetPassword }), { code: 'PASSWORD_RESET_NOT_ALLOWED' })
  })
})
