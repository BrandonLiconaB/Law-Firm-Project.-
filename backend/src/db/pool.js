import pg from 'pg'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'gestor-documental-api',
  ssl: env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : false,
})

pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected error from an idle database client')
})

export function closeDatabasePool() {
  return pool.end()
}
