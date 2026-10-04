import assert from 'node:assert/strict'
import test from 'node:test'
import {
  changePasswordSchema,
  recoverAdministratorSchema,
  resetPasswordSchema,
} from '../src/modules/auth/password.validation.js'

test('password changes preserve exact characters and require both credentials', () => {
  const input = { currentPassword: ' old password! ', newPassword: ' new password! ' }
  assert.deepEqual(changePasswordSchema.parse(input), input)
  for (const invalid of [
    { newPassword: input.newPassword },
    { ...input, currentPassword: '' },
    { ...input, currentPassword: 'x'.repeat(129) },
    { ...input, newPassword: 'short' },
    { ...input, newPassword: 'x'.repeat(129) },
    { ...input, mustChangePassword: false },
  ]) {
    assert.equal(changePasswordSchema.safeParse(invalid).success, false)
  }
})

test('administrator reset requires administrator proof and rejects extra fields', () => {
  const input = { administratorPassword: 'admin password!', newPassword: 'temporary password!' }
  assert.deepEqual(resetPasswordSchema.parse(input), input)
  assert.equal(resetPasswordSchema.safeParse({ newPassword: input.newPassword }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ ...input, systemRole: 'ADMIN' }).success, false)
})

test('administrator recovery normalizes only the username', () => {
  assert.deepEqual(recoverAdministratorSchema.parse({
    username: '  Main.ADMIN  ',
    newPassword: ' private password! ',
  }), { username: 'main.admin', newPassword: ' private password! ' })
})
