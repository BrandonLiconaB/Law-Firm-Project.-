import test from 'node:test'
import assert from 'node:assert/strict'
import { createUsersStore, USERS_PAGE_SIZE } from '../src/features/users/services/usersStore.js'
import { ApiError } from '../src/api/apiClient.js'
import { getUserFieldErrors, getUsersPage, normalizeUsername, validateNewUser, validatePasswordReset } from '../src/features/users/utils/userValidation.js'

const user = { id: 'user-1', fullName: 'Team User', username: 'team.user', systemRole: 'MEMBER', mustChangePassword: true,
  createdAt: '2026-10-06T15:00:00.000Z', updatedAt: '2026-10-06T15:00:00.000Z' }
const list = (page = 1, data = [user]) => ({ data, pagination: { page, limit: USERS_PAGE_SIZE, total: 22, totalPages: 2 } })
const input = { fullName: user.fullName, username: user.username, password: 'Fictitious users password!42', confirmation: 'Fictitious users password!42' }

test('the user directory requests only the selected page, with server pagination', async () => {
  const calls = []
  const store = createUsersStore({ request: async (path) => { calls.push(path); return list(2) } })
  await store.loadUsers(2)
  assert.deepEqual(calls, ['/users?page=2&limit=20'])
  assert.equal(store.getSnapshot().list.pagination.total, 22)
  assert.equal(store.getSnapshot().list.status, 'Ready')
})

test('duplicate reads share their request and an older page cannot replace a newer one', async () => {
  const first = Promise.withResolvers()
  let calls = 0
  const store = createUsersStore({ request: (path) => { calls += 1; return path.includes('page=1') ? first.promise : Promise.resolve(list(2)) } })
  const one = store.loadUsers(1)
  const duplicate = store.loadUsers(1)
  await store.loadUsers(2)
  first.resolve(list())
  await Promise.all([one, duplicate])
  assert.equal(calls, 2)
  assert.equal(store.getSnapshot().list.page, 2)
})

test('failed reads are explicit and retry clears the error', async () => {
  let offline = true
  const store = createUsersStore({ request: async () => { if (offline) throw new ApiError('Offline'); return list() } })
  await store.loadUsers()
  assert.equal(store.getSnapshot().list.status, 'Error')
  offline = false
  await store.loadUsers()
  assert.equal(store.getSnapshot().list.error, null)
})

test('creation is non-optimistic, blocks duplicate writes, and never caches credentials', async () => {
  const deferred = Promise.withResolvers()
  let options
  const store = createUsersStore({ request: (path, request) => { options = request; return deferred.promise } })
  const saving = store.createUser(input)
  assert.deepEqual(store.getSnapshot().details, {})
  await assert.rejects(store.createUser(input), { code: 'SAVE_IN_PROGRESS' })
  deferred.resolve({ data: user })
  assert.deepEqual(await saving, user)
  assert.deepEqual(options.body, { fullName: input.fullName, username: input.username, password: input.password })
  assert.equal(store.getSnapshot().details[user.id].data, user)
  assert.doesNotMatch(JSON.stringify(store.getSnapshot()), /Fictitious users password|confirmation|passwordHash/)
})

test('a username conflict does not add a user and is mapped to its field', async () => {
  const conflict = new ApiError('Duplicate', { code: 'USERNAME_ALREADY_EXISTS', status: 409 })
  const store = createUsersStore({ request: async () => { throw conflict } })
  await assert.rejects(store.createUser(input), (error) => error === conflict)
  assert.deepEqual(store.getSnapshot().details, {})
  assert.equal(store.getSnapshot().isMutating, false)
  assert.match(getUserFieldErrors(conflict).username, /already in use/)
})

test('a confirmed creation invalidates older list reads instead of inventing pagination totals', async () => {
  const deferred = Promise.withResolvers()
  const store = createUsersStore({ request: async (path, options) => options ? { data: user } : deferred.promise })
  const loading = store.loadUsers()
  await store.createUser(input)
  deferred.resolve(list(1, []))
  await loading
  assert.equal(store.getSnapshot().list.status, 'Idle')
  assert.equal(store.getSnapshot().list.pagination, null)
})

test('reset uses the administrator password and new password, then reloads the public account', async () => {
  const calls = []
  const store = createUsersStore({ request: async (path, options) => { calls.push([path, options]); return options ? null : { data: user } } })
  await store.resetPassword(user.id, { administratorPassword: 'Private admin input', newPassword: input.password, confirmation: 'not sent' })
  assert.deepEqual(calls, [
    [`/users/${user.id}/reset-password`, { method: 'POST', body: { administratorPassword: 'Private admin input', newPassword: input.password } }],
    [`/users/${user.id}`, undefined],
  ])
  assert.equal(store.getSnapshot().details[user.id].data.mustChangePassword, true)
  assert.doesNotMatch(JSON.stringify(store.getSnapshot()), /Private admin input|Fictitious users password/)
})

test('a rejected reset preserves the previous account and does not perform a success refresh', async () => {
  let reject = false
  let reads = 0
  const store = createUsersStore({ request: async (path, options) => {
    if (options && reject) throw new ApiError('Incorrect', { code: 'ADMIN_PASSWORD_INCORRECT' })
    reads += 1
    return { data: user }
  } })
  await store.loadUser(user.id)
  reject = true
  await assert.rejects(store.resetPassword(user.id, {}), { code: 'ADMIN_PASSWORD_INCORRECT' })
  assert.equal(reads, 1)
  assert.equal(store.getSnapshot().details[user.id].data, user)
})

test('a failed refresh after a confirmed reset does not reject or repeat the reset', async () => {
  let writes = 0
  const store = createUsersStore({ request: async (path, options) => {
    if (options) { writes += 1; return null }
    throw new ApiError('Offline')
  } })
  await store.resetPassword(user.id, {})
  assert.equal(writes, 1)
  assert.equal(store.getSnapshot().details[user.id].error.code, 'SAVED_REFRESH_FAILED')
  assert.match(store.getSnapshot().details[user.id].error.message, /password was reset/)
})

test('a late individual read cannot overwrite the account refreshed after reset', async () => {
  const deferred = Promise.withResolvers()
  let reads = 0
  const store = createUsersStore({ request: async (path, options) => {
    if (options) return null
    if (++reads === 1) return deferred.promise
    return { data: user }
  } })
  const loading = store.loadUser(user.id)
  await store.resetPassword(user.id, {})
  deferred.resolve({ data: { ...user, mustChangePassword: false } })
  await loading
  assert.equal(store.getSnapshot().details[user.id].data.mustChangePassword, true)
})

test('unmount and StrictMode reactivation reject stale responses from the previous lifecycle', async () => {
  const deferred = Promise.withResolvers()
  let calls = 0
  const store = createUsersStore({ request: async () => ++calls === 1 ? deferred.promise : list(2) })
  const loading = store.loadUsers()
  store.dispose()
  await assert.rejects(store.createUser(input), { code: 'WORKSPACE_CLOSED' })
  store.activate()
  await store.loadUsers(2)
  deferred.resolve(list())
  await loading
  assert.equal(store.getSnapshot().list.page, 2)
})

test('a write completed after workspace disposal cannot publish or trigger successful navigation', async () => {
  const deferred = Promise.withResolvers()
  const store = createUsersStore({ request: () => deferred.promise })
  const saving = store.createUser(input)
  store.dispose()
  deferred.resolve({ data: user })
  await assert.rejects(saving, { code: 'WORKSPACE_CLOSED' })
  assert.deepEqual(store.getSnapshot().details, {})
})

test('new user validation matches username, name, password and confirmation constraints', () => {
  assert.deepEqual(validateNewUser(input), {})
  assert.equal(normalizeUsername(' TEAM.USER '), 'team.user')
  assert.deepEqual(validateNewUser({ ...input, username: ' TEAM.USER ' }), {})
  for (const username of ['a', 'name@example.com', 'name space', 'équipe', 'a'.repeat(51)]) {
    assert.ok(validateNewUser({ ...input, username }).username)
  }
  assert.ok(validateNewUser({ ...input, fullName: ' ' }).fullName)
  assert.ok(validateNewUser({ ...input, fullName: 'n'.repeat(121) }).fullName)
  assert.ok(validateNewUser({ ...input, password: 'short' }).password)
  assert.ok(validateNewUser({ ...input, password: 'p'.repeat(129) }).password)
  assert.ok(validateNewUser({ ...input, confirmation: 'different' }).confirmation)
  const spaced = '  password with spaces  '
  assert.deepEqual(validateNewUser({ ...input, password: spaced, confirmation: spaced }), {})
})

test('reset validation and backend errors use the correct fields without trimming passwords', () => {
  assert.deepEqual(validatePasswordReset({ ...input, administratorPassword: ' ' }), {})
  assert.ok(validatePasswordReset({ ...input, administratorPassword: '' }).administratorPassword)
  assert.ok(validatePasswordReset({ ...input, administratorPassword: 'a'.repeat(129) }).administratorPassword)
  assert.deepEqual(getUserFieldErrors({ fields: { newPassword: 'Too short' } }, {}, { reset: true }), { password: 'Too short' })
  assert.match(getUserFieldErrors({ code: 'ADMIN_PASSWORD_INCORRECT' }).administratorPassword, /incorrect/)
  assert.match(getUserFieldErrors({ code: 'PASSWORD_UNCHANGED' }, {}, { reset: true }).password, /different/)
})

test('pagination accepts valid backend page numbers and falls back safely for malformed URLs', () => {
  assert.equal(getUsersPage('2'), 2)
  assert.equal(getUsersPage('100000'), 100000)
  for (const value of [null, '', '0', '-1', '01', '1.2', '1e2', '100001', '9999999', 'Infinity', 'abc']) {
    assert.equal(getUsersPage(value), 1)
  }
})
