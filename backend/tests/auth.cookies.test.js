import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import request from 'supertest'

process.env.NODE_ENV = 'production'
process.env.LOG_LEVEL = 'silent'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.SESSION_COOKIE_NAME = 'gestor_session'

const { clearSessionCookie, setSessionCookie } = await import(
  '../src/modules/auth/auth.cookies.js'
)

test('production session cookies are secure and cleared with matching attributes', async () => {
  const app = express()
  app.get('/set', (req, res) => {
    setSessionCookie(res, 'a'.repeat(64), new Date(Date.now() + 60_000))
    res.status(204).end()
  })
  app.get('/clear', (req, res) => {
    clearSessionCookie(res)
    res.status(204).end()
  })

  const setResponse = await request(app).get('/set').expect(204)
  const clearResponse = await request(app).get('/clear').expect(204)
  for (const response of [setResponse, clearResponse]) {
    const cookie = response.headers['set-cookie'][0]
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /Secure/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Path=\//)
    assert.doesNotMatch(cookie, /Domain=/)
  }
  assert.match(clearResponse.headers['set-cookie'][0], /Expires=.*1970/)
})
