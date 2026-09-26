import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

const { withTransaction } = await import('../src/db/transaction.js')

function createFakeDatabase() {
  const operations = []
  const client = {
    query: async (sql) => {
      operations.push(sql)
      return { rows: [] }
    },
    release: () => operations.push('RELEASE'),
  }

  return {
    operations,
    database: { connect: async () => client },
  }
}

test('withTransaction commits a successful operation and releases the client', async () => {
  const { database, operations } = createFakeDatabase()

  const result = await withTransaction(async (client) => {
    await client.query('INSERT EXAMPLE')
    return 'created'
  }, database)

  assert.equal(result, 'created')
  assert.deepEqual(operations, [
    'BEGIN',
    'INSERT EXAMPLE',
    'COMMIT',
    'RELEASE',
  ])
})

test('withTransaction rolls back a failed operation and releases the client', async () => {
  const { database, operations } = createFakeDatabase()
  const expectedError = new Error('Operation failed')

  await assert.rejects(
    withTransaction(async () => {
      throw expectedError
    }, database),
    expectedError,
  )

  assert.deepEqual(operations, ['BEGIN', 'ROLLBACK', 'RELEASE'])
})
