import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, verifyPassword } from '../src/modules/auth/password.js'

test('passwords are stored as Argon2id hashes and can be verified', async () => {
  const password = 'a secure learning password'
  const passwordHash = await hashPassword(password)

  assert.match(passwordHash, /^\$argon2id\$v=19\$m=65536,p=1,t=3\$/)
  assert.notEqual(passwordHash, password)
  assert.equal(await verifyPassword(passwordHash, password), true)
  assert.equal(await verifyPassword(passwordHash, 'a different password'), false)
})

test('an invalid stored hash is treated as a failed verification', async () => {
  assert.equal(await verifyPassword('not-an-argon2-hash', 'any password'), false)
})
