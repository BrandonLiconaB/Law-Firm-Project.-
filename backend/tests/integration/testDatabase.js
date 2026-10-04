import pg from 'pg'

export function prepareTestEnvironment() {
  const testConnection = process.env.TEST_DATABASE_URL
  if (!testConnection) throw new Error('TEST_DATABASE_URL is required.')
  const testUrl = new URL(testConnection)
  const developmentUrl = new URL(process.env.DATABASE_URL)
  if (
    !testUrl.pathname.endsWith('_test') ||
    (testUrl.hostname === developmentUrl.hostname &&
      testUrl.port === developmentUrl.port &&
      testUrl.pathname === developmentUrl.pathname)
  ) {
    throw new Error('Integration tests require a separate database ending in _test.')
  }

  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'silent'
  process.env.DATABASE_URL = testConnection
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
  process.env.SESSION_COOKIE_NAME = 'gestor_session'
  process.env.SESSION_TTL_HOURS = '12'
}

export function createTestDatabase() {
  return new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    max: 5,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : false,
  })
}
