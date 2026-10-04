import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMatterTypeSchema,
  listMatterTypesQuerySchema,
  matterTypeIdParamsSchema,
  updateMatterTypeSchema,
} from '../src/modules/matterTypes/matterType.validation.js'

test('matter type creation cleans whitespace while preserving display capitalization', () => {
  assert.deepEqual(createMatterTypeSchema.parse({
    name: ' \tFamily\n\u00a0 Petition\u3000 ',
    description: '  First line\nSecond line  ',
  }), { name: 'Family Petition', description: 'First line\nSecond line' })
  assert.deepEqual(createMatterTypeSchema.parse({ name: 'A' }), { name: 'A', description: '' })
})

test('matter type creation accepts exact field limits after cleaning', () => {
  const value = { name: 'A'.repeat(120), description: 'D'.repeat(1000) }
  assert.deepEqual(createMatterTypeSchema.parse(value), value)
  assert.equal(createMatterTypeSchema.parse({ name: ` ${value.name} ` }).name.length, 120)
})

test('matter type creation rejects invalid, oversized and unsupported fields', () => {
  for (const input of [
    {},
    { name: ' \t\n ' },
    { name: 'A'.repeat(121) },
    { name: 123 },
    { name: 'Invalid\0Name' },
    { name: 'Valid', description: null },
    { name: 'Valid', description: 'Invalid\0Description' },
    { name: 'Valid', description: 'D'.repeat(1001) },
    { name: 'Valid', id: 'chosen-id' },
    { name: 'Valid', documents: [] },
    { name: 'Valid', isActive: true },
  ]) {
    assert.equal(createMatterTypeSchema.safeParse(input).success, false)
  }
})

test('matter type updates accept partial changes and intentional empty descriptions', () => {
  assert.deepEqual(updateMatterTypeSchema.parse({ name: '  New   Name ' }), { name: 'New Name' })
  assert.deepEqual(updateMatterTypeSchema.parse({ description: '  ' }), { description: '' })
  assert.deepEqual(updateMatterTypeSchema.parse({ name: 'New', description: 'Info' }), {
    name: 'New', description: 'Info',
  })
})

test('matter type updates reject empty bodies, invalid values and field injection', () => {
  for (const input of [
    {}, { name: undefined }, { name: '' }, { description: null },
    { name: 'Invalid\0Name' }, { description: 'Invalid\0Description' },
    { name: 'A'.repeat(121) }, { description: 'D'.repeat(1001) },
    { name: 'Valid', createdAt: '2026-01-01' }, { description: 'Info', sections: [] },
  ]) {
    assert.equal(updateMatterTypeSchema.safeParse(input).success, false)
  }
})

test('matter type pagination requires bounded integer query strings', () => {
  assert.deepEqual(listMatterTypesQuerySchema.parse({}), { page: 1, limit: 20 })
  assert.deepEqual(listMatterTypesQuerySchema.parse({ page: '2', limit: '100' }), { page: 2, limit: 100 })
  for (const input of [
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: '100001' },
    { limit: '101' }, { limit: '0' }, { limit: ['1', '2'] }, { unknown: 'value' },
  ]) {
    assert.equal(listMatterTypesQuerySchema.safeParse(input).success, false)
  }
})

test('matter type identifiers must be UUIDs', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000'
  assert.deepEqual(matterTypeIdParamsSchema.parse({ id }), { id })
  assert.equal(matterTypeIdParamsSchema.safeParse({ id: 'family-petition' }).success, false)
  assert.equal(matterTypeIdParamsSchema.safeParse({ id, unknown: true }).success, false)
})
