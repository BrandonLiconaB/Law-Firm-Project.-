import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient, ApiError } from '../src/api/apiClient.js'
import { createAuthSession } from '../src/features/auth/services/authSession.js'

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers })
const identity = (extra = {}) => ({ user: { id: 'user-1', username: 'team', fullName: 'Team Member', systemRole: 'MEMBER', mustChangePassword: false, ...extra }, csrfToken: 'test-csrf', expiresAt: '2030-01-01' })

test('a protected 401 ends the session even if a proxy returns a non-JSON response', async () => {
  let ended = false
  const api = createApiClient({ onUnauthorized: () => { ended = true }, fetchImpl: async () => new Response('Unauthorized', { status: 401 }) })
  await assert.rejects(api.request('/auth/me'), { code: 'INVALID_RESPONSE' })
  assert.equal(ended, true)
})

test('the announced absolute expiry clears the frontend session without extending it', async () => {
  let expire
  let delay
  const session = createAuthSession({ now: () => 0, setTimeoutImpl: (callback, milliseconds) => { expire = callback; delay = milliseconds }, clearTimeoutImpl: () => {},
    fetchImpl: async () => json({ data: { ...identity(), expiresAt: '1970-01-01T00:00:02.000Z' } }) })
  await session.login({})
  assert.equal(delay, 2000)
  expire()
  assert.equal(session.getSnapshot().status, 'Anonymous')
  assert.match(session.getSnapshot().notice, /session ended/)
})

test('HTTP client includes cookies, encodes JSON, and adds CSRF only on writes', async () => {
  const calls = []
  const api = createApiClient({ baseUrl: '/api/', getCsrfToken: () => 'csrf', fetchImpl: async (...args) => { calls.push(args); return json({ data: [] }) } })
  await api.request('/matter-types')
  await api.request('/matter-types', { method: 'POST', body: { name: 'Family' } })
  await api.request('/auth/login', { method: 'POST', body: { username: 'qa', password: 'fixture' } })
  assert.equal(calls[0][0], '/api/matter-types')
  assert.equal(calls[0][1].credentials, 'include')
  assert.equal(calls[0][1].headers['X-CSRF-Token'], undefined)
  assert.equal(calls[0][1].headers['Content-Type'], undefined)
  assert.equal(calls[1][1].headers['X-CSRF-Token'], 'csrf')
  assert.deepEqual(JSON.parse(calls[1][1].body), { name: 'Family' })
  assert.equal(calls[2][1].headers['X-CSRF-Token'], undefined)
})

test('HTTP client handles 204 and bodyless DELETE without claiming JSON content', async () => {
  const api = createApiClient({ getCsrfToken: () => 'csrf', fetchImpl: async (url, options) => {
    assert.equal(options.body, undefined)
    assert.equal(options.headers['Content-Type'], undefined)
    assert.equal(options.headers['X-CSRF-Token'], 'csrf')
    return new Response(null, { status: 204 })
  } })
  assert.equal(await api.request('/documents/1', { method: 'DELETE' }), null)
})

test('HTTP errors preserve safe field messages and retry timing', async () => {
  const api = createApiClient({ fetchImpl: async () => json({ error: { code: 'DUPLICATE', message: 'Already exists.', fields: { name: 'Choose another name.' } } }, 409, { 'Retry-After': '12' }) })
  await assert.rejects(api.request('/matter-types'), (error) => error instanceof ApiError && error.status === 409 && error.fields.name === 'Choose another name.' && error.retryAfter === '12')
})

test('network, invalid responses and cancellation are distinguishable', async () => {
  await assert.rejects(createApiClient({ fetchImpl: async () => { throw new Error('private transport details') } }).request('/x'), { code: 'NETWORK_ERROR' })
  await assert.rejects(createApiClient({ fetchImpl: async () => new Response('<html>') }).request('/x'), { code: 'INVALID_RESPONSE' })
  const aborted = new DOMException('Stopped', 'AbortError')
  await assert.rejects(createApiClient({ fetchImpl: async () => { throw aborted } }).request('/x'), (error) => error === aborted)
})

test('restoring a missing session becomes anonymous and concurrent checks share one request', async () => {
  let count = 0
  const deferred = Promise.withResolvers()
  const session = createAuthSession({ fetchImpl: () => { count += 1; return deferred.promise } })
  const first = session.restore()
  const second = session.restore()
  assert.equal(count, 1)
  deferred.resolve(json({ error: { code: 'AUTHENTICATION_REQUIRED' } }, 401))
  await Promise.all([first, second])
  assert.equal(session.getSnapshot().status, 'Anonymous')
})

test('unavailable session checks can be retried without showing a false login state', async () => {
  let unavailable = true
  const session = createAuthSession({ fetchImpl: async () => {
    if (unavailable) throw new Error('offline')
    return json({ data: identity() })
  } })
  await session.restore()
  assert.equal(session.getSnapshot().status, 'Unavailable')
  unavailable = false
  await session.restore()
  assert.equal(session.getSnapshot().user.username, 'team')
  assert.equal('csrfToken' in session.getSnapshot(), false)
})

test('login preserves temporary-password requirement and failed credentials do not create a session', async () => {
  let valid = false
  const session = createAuthSession({ fetchImpl: async () => valid ? json({ data: identity({ mustChangePassword: true }) }) : json({ error: { code: 'INVALID_CREDENTIALS' } }, 401) })
  await assert.rejects(session.login({ username: 'fixture', password: 'fixture' }), { code: 'INVALID_CREDENTIALS' })
  assert.equal(session.getSnapshot().user, null)
  valid = true
  await session.login({ username: 'fixture', password: 'fixture' })
  assert.equal(session.getSnapshot().user.mustChangePassword, true)
})

test('expired protected requests clear the session and the CSRF token', async () => {
  const options = []
  const session = createAuthSession({ fetchImpl: async (url, request) => {
    options.push(request)
    return url.endsWith('/auth/login') ? json({ data: identity() }) : json({ error: { code: 'AUTHENTICATION_REQUIRED' } }, 401)
  } })
  await session.login({})
  await assert.rejects(session.api.request('/matter-types'), { status: 401 })
  assert.equal(session.getSnapshot().status, 'Anonymous')
  await assert.rejects(session.api.request('/matter-types', { method: 'POST', body: {} }))
  assert.equal(options.at(-1).headers['X-CSRF-Token'], undefined)
})

test('a late unauthorized request cannot sign out a newer login', async () => {
  const deferred = Promise.withResolvers()
  const session = createAuthSession({ fetchImpl: async (url) => url.endsWith('/slow') ? deferred.promise : json({ data: identity() }) })
  await session.login({})
  const oldRequest = session.api.request('/slow')
  await session.login({})
  deferred.resolve(json({ error: { code: 'AUTHENTICATION_REQUIRED' } }, 401))
  await assert.rejects(oldRequest)
  assert.equal(session.getSnapshot().status, 'Authenticated')
})

test('a late session check cannot replace a newly signed-in user', async () => {
  const deferred = Promise.withResolvers()
  const session = createAuthSession({ fetchImpl: async (url) => url.endsWith('/auth/me') ? deferred.promise : json({ data: identity({ id: 'new-user' }) }) })
  const restoring = session.restore()
  await session.login({})
  deferred.resolve(json({ data: identity({ id: 'old-user' }) }))
  await restoring
  assert.equal(session.getSnapshot().user.id, 'new-user')
})

test('password-required responses redirect an existing identity without treating other 403s as logout', async () => {
  let code = 'ADMIN_REQUIRED'
  const session = createAuthSession({ fetchImpl: async (url) => url.endsWith('/auth/login') ? json({ data: identity() }) : json({ error: { code } }, 403) })
  await session.login({})
  await assert.rejects(session.api.request('/restricted'))
  assert.equal(session.getSnapshot().user.mustChangePassword, false)
  code = 'PASSWORD_CHANGE_REQUIRED'
  await assert.rejects(session.api.request('/restricted'))
  assert.equal(session.getSnapshot().user.mustChangePassword, true)
})

test('logout and successful password changes clear credentials only after server confirmation', async () => {
  let failure = true
  const session = createAuthSession({ fetchImpl: async (url) => {
    if (url.endsWith('/auth/login')) return json({ data: identity() })
    if (failure) throw new Error('offline')
    return new Response(null, { status: 204 })
  } })
  await session.login({})
  await assert.rejects(session.logout())
  assert.equal(session.getSnapshot().status, 'Authenticated')
  failure = false
  await session.logout()
  assert.equal(session.getSnapshot().status, 'Anonymous')
  await session.login({})
  await session.changePassword({ currentPassword: 'fixture', newPassword: 'another fixture' })
  assert.match(session.getSnapshot().notice, /Password changed/)
})
