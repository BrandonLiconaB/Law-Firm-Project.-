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
      WHERE table_schema = 'app' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    const views = await client.query(`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = 'app' ORDER BY table_name
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
      SELECT count(*)::integer AS count,
        count(*) FILTER (WHERE must_change_password)::integer AS "temporaryPasswords"
      FROM app.users
    `)
    const passwordChangeColumn = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'users'
        AND column_name = 'must_change_password'
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
    const matterTypeColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'matter_types'
      ORDER BY ordinal_position
    `)
    const matterTypeIndexes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'app' AND tablename = 'matter_types'
      ORDER BY indexname
    `)
    const matterTypeConstraints = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = 'app' AND table_name = 'matter_types'
      ORDER BY constraint_name
    `)
    const matterTypeTriggers = await client.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE event_object_schema = 'app' AND event_object_table = 'matter_types'
      ORDER BY trigger_name
    `)
    const matterTypeCount = await client.query('SELECT count(*)::integer AS count FROM app.matter_types')
    const templateColumns = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name IN ('template_sections', 'template_documents')
      ORDER BY table_name, ordinal_position
    `)
    const templateIndexes = await client.query(`
      SELECT tablename, indexname FROM pg_indexes
      WHERE schemaname = 'app' AND tablename IN ('template_sections', 'template_documents')
      ORDER BY tablename, indexname
    `)
    const templateConstraints = await client.query(`
      SELECT c.conrelid::regclass::text AS "tableName", c.conname AS name,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.conrelid IN ('app.template_sections'::regclass, 'app.template_documents'::regclass)
      ORDER BY c.conrelid::regclass::text, c.conname
    `)
    const templateTriggers = await client.query(`
      SELECT event_object_table AS "tableName", trigger_name AS name
      FROM information_schema.triggers
      WHERE event_object_schema = 'app'
        AND event_object_table IN ('template_sections', 'template_documents')
      ORDER BY event_object_table, trigger_name
    `)
    const templateCounts = await client.query(`
      SELECT
        (SELECT count(*)::integer FROM app.template_sections WHERE retired_at IS NULL) AS "currentSections",
        (SELECT count(*)::integer FROM app.template_sections WHERE retired_at IS NOT NULL) AS "retiredSections",
        (SELECT count(*)::integer FROM app.template_documents WHERE retired_at IS NULL) AS "currentDocuments",
        (SELECT count(*)::integer FROM app.template_documents WHERE retired_at IS NOT NULL) AS "retiredDocuments"
    `)

    const matterColumns = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name IN ('matters', 'matter_sections', 'matter_documents', 'matter_status_history')
      ORDER BY table_name, ordinal_position
    `)
    const matterIndexes = await client.query(`
      SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'app'
        AND tablename IN ('matters', 'matter_sections', 'matter_documents', 'matter_status_history')
      ORDER BY tablename, indexname
    `)
    const matterConstraints = await client.query(`
      SELECT c.conrelid::regclass::text AS "tableName", c.conname AS name,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.conrelid IN ('app.matters'::regclass, 'app.matter_sections'::regclass,
        'app.matter_documents'::regclass, 'app.matter_status_history'::regclass)
      ORDER BY c.conrelid::regclass::text, c.conname
    `)
    const matterTriggers = await client.query(`
      SELECT event_object_table AS "tableName", trigger_name AS name
      FROM information_schema.triggers
      WHERE event_object_schema = 'app'
        AND event_object_table IN ('matters', 'matter_sections', 'matter_documents', 'matter_status_history')
      ORDER BY event_object_table, trigger_name
    `)
    const matterPublicPrivileges = await client.query(`
      SELECT c.relname AS "tableName", acl.privilege_type AS privilege
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
      WHERE n.nspname = 'app' AND acl.grantee = 0
        AND c.relname IN ('matters', 'matter_sections', 'matter_documents', 'matter_status_history')
      ORDER BY c.relname, acl.privilege_type
    `)
    const matterCounts = await client.query(`
      SELECT
        (SELECT count(*)::integer FROM app.matters) AS matters,
        (SELECT count(*)::integer FROM app.matter_sections WHERE retired_at IS NULL) AS "currentSections",
        (SELECT count(*)::integer FROM app.matter_sections WHERE retired_at IS NOT NULL) AS "retiredSections",
        (SELECT count(*)::integer FROM app.matter_documents WHERE retired_at IS NULL) AS "currentDocuments",
        (SELECT count(*)::integer FROM app.matter_documents WHERE retired_at IS NOT NULL) AS "retiredDocuments",
        (SELECT count(*)::integer FROM app.matter_status_history) AS "statusEvents"
    `)

    console.log(
      JSON.stringify({
        database: databaseName,
        schemas: schemas.rows.map((row) => row.schema_name),
        functions: functions.rows.map((row) => row.routine_name),
        migrations: migrations.rows.map((row) => row.name),
        tables: tables.rows.map((row) => row.table_name),
        views: views.rows.map((row) => row.table_name),
        userIndexes: userIndexes.rows.map((row) => row.indexname),
        userConstraints: userConstraints.rows.map(
          (row) => row.constraint_name,
        ),
        userTriggers: userTriggers.rows.map((row) => row.trigger_name),
        userCount: userCount.rows[0].count,
        temporaryPasswordCount: userCount.rows[0].temporaryPasswords,
        passwordChangeColumn: passwordChangeColumn.rows,
        authIndexes: authIndexes.rows,
        authCounts: authCounts.rows[0],
        matterTypes: {
          count: matterTypeCount.rows[0].count,
          columns: matterTypeColumns.rows,
          indexes: matterTypeIndexes.rows.map((row) => row.indexname),
          constraints: matterTypeConstraints.rows.map((row) => row.constraint_name),
          triggers: matterTypeTriggers.rows.map((row) => row.trigger_name),
        },
        templates: {
          counts: templateCounts.rows[0],
          columns: templateColumns.rows,
          indexes: templateIndexes.rows,
          constraints: templateConstraints.rows,
          triggers: templateTriggers.rows,
        },
        matters: {
          counts: matterCounts.rows[0],
          columns: matterColumns.rows,
          indexes: matterIndexes.rows,
          constraints: matterConstraints.rows,
          triggers: matterTriggers.rows,
          publicPrivileges: matterPublicPrivileges.rows,
        },
      }),
    )
  } finally {
    await client.end()
  }
}
