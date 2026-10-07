import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { createTestDatabase, prepareTestEnvironment } from '../../../backend/tests/integration/testDatabase.js'

export async function createBackendFixture({ port = 0, origin = 'http://localhost:5173' } = {}) {
  prepareTestEnvironment()
  process.env.FRONTEND_ORIGIN = origin
  const { createApp } = await import('../../../backend/src/app.js')
  const { hashPassword } = await import('../../../backend/src/modules/auth/password.js')
  const { insertUser } = await import('../../../backend/src/modules/users/users.repository.js')
  const { loginLimitKeys, passwordLimitKey } = await import('../../../backend/src/modules/auth/auth.tokens.js')
  const database = createTestDatabase()
  const users = {}
  const userIds = new Set()
  const typeIds = new Set()
  const limitKeys = new Set()
  let preexistingKeys = new Set()
  let server
  let closed = false
  const password = 'Fictitious frontend QA password!42'
  async function close() {
    if (closed) return
    closed = true
    if (server?.listening) {
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
    try {
      await database.query('DELETE FROM app.template_documents WHERE matter_type_id = ANY($1::uuid[])', [[...typeIds]])
      await database.query('DELETE FROM app.template_sections WHERE matter_type_id = ANY($1::uuid[])', [[...typeIds]])
      await database.query('DELETE FROM app.matter_types WHERE id = ANY($1::uuid[])', [[...typeIds]])
      await database.query('DELETE FROM app.users WHERE id = ANY($1::uuid[])', [[...userIds]])
      await database.query('DELETE FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys].filter((key) => !preexistingKeys.has(key))])
    } finally { await database.end() }
  }
  try {
    const admin = await database.query("SELECT id FROM app.users WHERE system_role = 'ADMIN'")
    if (admin.rowCount) throw new Error('The isolated test database already has an administrator. No existing account will be changed.')
    const passwordHash = await hashPassword(password)
    const run = randomUUID().replaceAll('-', '').slice(0, 12)
    for (const [label, systemRole, temporary] of [['admin', 'ADMIN', false], ['member', 'MEMBER', false], ['temporary', 'MEMBER', true]]) {
      const user = await insertUser(database, { username: `front_${label}_${run}`, fullName: `Frontend QA ${label}`,
        passwordHash, systemRole, mustChangePassword: temporary })
      users[label] = user
      userIds.add(user.id)
      limitKeys.add(passwordLimitKey('change', user.id))
      limitKeys.add(passwordLimitKey('reset', user.id))
      for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
        const keys = loginLimitKeys(ip, user.username)
        limitKeys.add(keys.ip); limitKeys.add(keys.accountIp)
      }
    }
    preexistingKeys = new Set((await database.query('SELECT key_hash FROM app.auth_login_limits WHERE key_hash = ANY($1::text[])', [[...limitKeys]])).rows.map((row) => row.key_hash))
    const app = createApp({ database })
    server = createServer((req, res) => {
      // Track only records created through this fixture's server for cleanup.
      const end = res.end
      res.end = function (chunk, ...args) {
        if (req.method === 'POST' && req.originalUrl === '/api/matter-types' && this.statusCode === 201) {
          const id = JSON.parse(chunk.toString()).data.id
          typeIds.add(id)
        }
        if (req.method === 'POST' && req.originalUrl === '/api/users' && this.statusCode === 201) {
          const user = JSON.parse(chunk.toString()).data
          userIds.add(user.id)
          limitKeys.add(passwordLimitKey('change', user.id))
          limitKeys.add(passwordLimitKey('reset', user.id))
          for (const ip of ['127.0.0.1', '::ffff:127.0.0.1']) {
            const keys = loginLimitKeys(ip, user.username)
            limitKeys.add(keys.ip); limitKeys.add(keys.accountIp)
          }
        }
        return end.call(this, chunk, ...args)
      }
      app(req, res)
    })
    server.listen(port, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    return { database, users, password, typeIds, origin, baseUrl: `http://127.0.0.1:${server.address().port}`, close,
      revokeSessions: () => database.query('DELETE FROM app.auth_sessions WHERE user_id = ANY($1::uuid[])', [[...userIds]]) }
  } catch (error) { await close(); throw error }
}

// Node does not have a browser cookie jar; this adapter emulates only the test jar.
export function createCookieFetch(origin) {
  const cookies = new Map()
  return async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...options.headers, Origin: origin,
      ...(cookies.size ? { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } : {}) } })
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';')
      const separator = pair.indexOf('=')
      const key = pair.slice(0, separator)
      const value = pair.slice(separator + 1)
      if (value) cookies.set(key, value)
      else cookies.delete(key)
    }
    return response
  }
}
