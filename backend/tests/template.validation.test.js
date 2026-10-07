import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTemplateDocumentSchema, documentParamsSchema, moveTemplateItemSchema,
  sectionParamsSchema, sectionSchema, templateParamsSchema, updateTemplateDocumentSchema,
} from '../src/modules/templates/template.validation.js'

const typeId = '550e8400-e29b-41d4-a716-446655440000'
const itemId = '550e8400-e29b-41d4-a716-446655440001'

test('template sections clean display names and reject unsupported fields', () => {
  assert.deepEqual(sectionSchema.parse({ name: ' \tPetitioner\u00a0  Records ' }), { name: 'Petitioner Records' })
  assert.equal(sectionSchema.parse({ name: 'A'.repeat(120) }).name.length, 120)
  for (const input of [{}, { name: ' ' }, { name: 'x'.repeat(121) }, { name: 'X\0' }, { name: 'Valid', position: 1 }]) {
    assert.equal(sectionSchema.safeParse(input).success, false)
  }
})

test('document requirements apply defaults without adding matter tracking fields', () => {
  assert.deepEqual(createTemplateDocumentSchema.parse({ name: '  Passport   copy ' }), {
    name: 'Passport copy', description: '', isKey: false, expectedQuantity: null, sectionId: null,
  })
  const result = createTemplateDocumentSchema.parse({
    name: 'Letters', description: '  Instructions  ', isKey: true, expectedQuantity: 5, sectionId: itemId,
  })
  assert.equal(result.description, 'Instructions')
  assert.equal(result.sectionId, itemId)
})

test('expected quantity must be null or a positive PostgreSQL integer', () => {
  for (const quantity of [null, 1, 2_147_483_647]) {
    assert.equal(createTemplateDocumentSchema.safeParse({ name: 'Letters', expectedQuantity: quantity }).success, true)
  }
  for (const quantity of [0, -1, 1.5, '5', 2_147_483_648, Infinity, NaN]) {
    assert.equal(createTemplateDocumentSchema.safeParse({ name: 'Letters', expectedQuantity: quantity }).success, false)
  }
})

test('documents reject invalid fields, non-boolean key flags and unsupported tracking data', () => {
  for (const input of [
    {}, { name: '' }, { name: 'x'.repeat(121) }, { name: 'X\0' },
    { name: 'Valid', description: null }, { name: 'Valid', description: 'x'.repeat(1001) },
    { name: 'Valid', description: 'X\0' }, { name: 'Valid', isKey: 'true' },
    { name: 'Valid', sectionId: 'petitioner' }, { name: 'Valid', status: 'Received' },
    { name: 'Valid', receivedQuantity: 5 }, { name: 'Valid', comment: 'Private note' },
  ]) assert.equal(createTemplateDocumentSchema.safeParse(input).success, false)
})

test('document PATCH distinguishes omitted fields, false values and explicit nulls', () => {
  assert.deepEqual(updateTemplateDocumentSchema.parse({ isKey: false }), { isKey: false })
  assert.deepEqual(updateTemplateDocumentSchema.parse({ expectedQuantity: null, sectionId: null, description: '' }), {
    expectedQuantity: null, sectionId: null, description: '',
  })
  for (const input of [{}, { name: undefined }, { position: 2 }, { retiredAt: '2026-01-01' }]) {
    assert.equal(updateTemplateDocumentSchema.safeParse(input).success, false)
  }
})

test('movement accepts only up or down and does not accept arbitrary positions', () => {
  for (const direction of ['up', 'down']) assert.deepEqual(moveTemplateItemSchema.parse({ direction }), { direction })
  for (const input of [{}, { direction: 'left' }, { direction: 'up', position: 2 }]) {
    assert.equal(moveTemplateItemSchema.safeParse(input).success, false)
  }
})

test('nested template route parameters require the appropriate UUID identifiers', () => {
  assert.deepEqual(templateParamsSchema.parse({ matterTypeId: typeId }), { matterTypeId: typeId })
  assert.equal(sectionParamsSchema.safeParse({ matterTypeId: typeId, sectionId: itemId }).success, true)
  assert.equal(documentParamsSchema.safeParse({ matterTypeId: typeId, documentId: itemId }).success, true)
  assert.equal(sectionParamsSchema.safeParse({ matterTypeId: typeId, sectionId: 'wrong' }).success, false)
  assert.equal(documentParamsSchema.safeParse({ matterTypeId: 'wrong', documentId: itemId }).success, false)
})
