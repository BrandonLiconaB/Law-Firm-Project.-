import { pool } from './pool.js'

export async function withTransaction(operation, database = pool) {
  const client = await database.connect()

  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      error.rollbackError = rollbackError
    }

    throw error
  } finally {
    client.release()
  }
}
