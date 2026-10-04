import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createUserSchema,
  initialAdminSchema,
  listUsersQuerySchema,
} from '../src/modules/users/user.validation.js'

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

test('user creation rejects attempts to provide a role or unsupported account fields', () => {
  for (const extra of [
    { systemRole: 'ADMIN' },
    { email: 'test@example.com' },
    { isActive: true },
  ]) {
    const result = createUserSchema.safeParse({
      username: 'member',
      fullName: 'Team Member',
      password: 'a secure password',
      ...extra,
    })
    assert.equal(result.success, false)
  }
})

test('user pagination accepts bounded integers and applies defaults', () => {
  assert.deepEqual(listUsersQuerySchema.parse({}), { page: 1, limit: 20 })
  assert.deepEqual(listUsersQuerySchema.parse({ page: '2', limit: '5' }), {
    page: 2,
    limit: 5,
  })
  for (const query of [
    { page: '0' },
    { page: '1.5' },
    { limit: '101' },
    { limit: ['1', '2'] },
    { unexpected: 'field' },
  ]) {
    assert.equal(listUsersQuerySchema.safeParse(query).success, false)
  }
})
