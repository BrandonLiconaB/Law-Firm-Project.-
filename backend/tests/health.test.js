import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

const { createApp } = await import('../src/app.js')
const connectedDatabase = {
  query: async () => ({ rows: [{ connection_check: 1 }] }),
}
const app = createApp({ database: connectedDatabase })
const server = app.listen()

after(
  () =>
    new Promise((resolve, reject) => {
      server.closeAllConnections()
      server.close((error) => (error ? reject(error) : resolve()))
    }),
)

test('GET /api/health reports that the API is available', async () => {
  const response = await request(server).get('/api/health').expect(200)

  assert.match(response.headers['content-type'], /json/)
  assert.deepEqual(response.body, {
    data: {
      status: 'ok',
      service: 'gestor-documental-api',
      database: 'connected',
    },
  })
})

test('the API includes security headers and hides its framework', async () => {
  const response = await request(server).get('/api/health').expect(200)

  assert.equal(response.headers['x-powered-by'], undefined)
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN')
})

test('requests from the configured frontend origin are allowed', async () => {
  const response = await request(server)
    .get('/api/health')
    .set('Origin', 'http://localhost:5173')
    .expect(200)

  assert.equal(
    response.headers['access-control-allow-origin'],
    'http://localhost:5173',
  )
  assert.equal(response.headers['access-control-allow-credentials'], 'true')
})

test('requests from another browser origin are rejected', async () => {
  const response = await request(server)
    .get('/api/health')
    .set('Origin', 'https://untrusted.example')
    .expect(403)

  assert.deepEqual(response.body, {
    error: {
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'This origin is not allowed to access the API.',
    },
  })
})

test('unknown routes return the standard error format', async () => {
  const response = await request(server).get('/api/unknown').expect(404)

  assert.deepEqual(response.body, {
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route GET /api/unknown was not found.',
    },
  })
})

test('invalid JSON does not expose an internal parsing error', async () => {
  const response = await request(server)
    .post('/api/unknown')
    .set('Content-Type', 'application/json')
    .send('{ invalid json')
    .expect(400)

  assert.deepEqual(response.body, {
    error: {
      code: 'INVALID_JSON',
      message: 'The request body contains invalid JSON.',
    },
  })
})

test('GET /api/health reports a database outage without exposing details', async () => {
  const unavailableApp = createApp({
    database: {
      query: async () => {
        throw new Error('Private connection details')
      },
    },
  })

  const response = await request(unavailableApp).get('/api/health').expect(503)

  assert.deepEqual(response.body, {
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database is not available.',
    },
  })
  assert.doesNotMatch(JSON.stringify(response.body), /Private connection details/)
})
