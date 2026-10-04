import pg from 'pg'

const { Client } = pg
const databases = [
  ['development', process.env.DATABASE_URL],
  ['test', process.env.TEST_DATABASE_URL],
]

for (const [databaseName, connectionString] of databases) {
  if (!connectionString) {
    throw new Error(`Missing connection URL for the ${databaseName} database.`)
  }

  const client = new Client({ connectionString })

  try {
    await client.connect()

    const schemas = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('app', 'app_migrations')
      ORDER BY schema_name
    `)
    const functions = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'app'
      ORDER BY routine_name
    `)
    const migrations = await client.query(`
      SELECT name
      FROM app_migrations.pgmigrations
      ORDER BY run_on
    `)
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app'
      ORDER BY table_name
    `)
    const userIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'app' AND tablename = 'users'
      ORDER BY indexname
    `)
    const userConstraints = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'app' AND table_name = 'users'
      ORDER BY constraint_name
    `)
    const userTriggers = await client.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_schema = 'app' AND event_object_table = 'users'
      ORDER BY trigger_name
    `)
    const userCount = await client.query(`
      SELECT count(*)::integer AS count
      FROM app.users
    `)
    const authIndexes = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'app'
        AND tablename IN ('auth_sessions', 'auth_login_limits')
      ORDER BY tablename, indexname
    `)
    const authCounts = await client.query(`
      SELECT
        (SELECT count(*)::integer FROM app.auth_sessions) AS sessions,
        (SELECT count(*)::integer FROM app.auth_login_limits) AS "loginLimits"
    `)

    console.log(
      JSON.stringify({
        database: databaseName,
        schemas: schemas.rows.map((row) => row.schema_name),
        functions: functions.rows.map((row) => row.routine_name),
        migrations: migrations.rows.map((row) => row.name),
        tables: tables.rows.map((row) => row.table_name),
        userIndexes: userIndexes.rows.map((row) => row.indexname),
        userConstraints: userConstraints.rows.map(
          (row) => row.constraint_name,
        ),
        userTriggers: userTriggers.rows.map((row) => row.trigger_name),
        userCount: userCount.rows[0].count,
        authIndexes: authIndexes.rows,
        authCounts: authCounts.rows[0],
      }),
    )
  } finally {
    await client.end()
  }
}
