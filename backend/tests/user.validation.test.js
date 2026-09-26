import assert from 'node:assert/strict'
import test from 'node:test'
import { initialAdminSchema } from '../src/modules/users/user.validation.js'

test('administrator input is trimmed and its username is normalized', () => {
  const result = initialAdminSchema.parse({
    username: '  Main.Admin_1  ',
    fullName: '  Manuel Diaz  ',
    password: 'a secure password',
  })

  assert.deepEqual(result, {
    username: 'main.admin_1',
    fullName: 'Manuel Diaz',
    password: 'a secure password',
  })
})

test('administrator input rejects unsupported usernames', () => {
  const result = initialAdminSchema.safeParse({
    username: 'admin account',
    fullName: 'Manuel Diaz',
    password: 'a secure password',
  })

  assert.equal(result.success, false)
})

test('administrator input rejects passwords shorter than 12 characters', () => {
  const result = initialAdminSchema.safeParse({
    username: 'admin',
    fullName: 'Manuel Diaz',
    password: 'too-short',
  })

  assert.equal(result.success, false)
})
