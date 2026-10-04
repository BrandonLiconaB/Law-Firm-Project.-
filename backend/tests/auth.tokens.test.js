import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createToken,
  hashToken,
  loginLimitKeys,
  passwordLimitKey,
  tokensMatch,
} from '../src/modules/auth/auth.tokens.js'

test('session tokens are unpredictable 32-byte values stored through a hash', () => {
  const first = createToken()
  const second = createToken()
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, second)
  assert.notEqual(hashToken(first), first)
  assert.equal(hashToken(first), hashToken(first))
})

test('CSRF comparison rejects mismatches and malformed input safely', () => {
  const token = createToken()
  assert.equal(tokensMatch(token, token), true)
  for (const candidate of [createToken(), undefined, '', [], 'g'.repeat(64)]) {
    assert.equal(tokensMatch(token, candidate), false)
  }
})

test('login limit keys distinguish accounts and IPs without storing their text', () => {
  const first = loginLimitKeys('127.0.0.1', 'member')
  const second = loginLimitKeys('127.0.0.1', 'other')
  const third = loginLimitKeys('127.0.0.2', 'member')
  assert.equal(first.ip, second.ip)
  assert.notEqual(first.accountIp, second.accountIp)
  assert.notEqual(first.ip, third.ip)
  assert.match(first.ip, /^[a-f0-9]{64}$/)
})

test('password operation limit keys separate users, actions and login counters', () => {
  const key = passwordLimitKey('change', 'member')
  assert.match(key, /^[a-f0-9]{64}$/)
  assert.equal(key, passwordLimitKey('change', 'member'))
  assert.notEqual(key, passwordLimitKey('reset', 'member'))
  assert.notEqual(key, passwordLimitKey('change', 'other'))
  assert.notEqual(key, loginLimitKeys('127.0.0.1', 'member').accountIp)
})
