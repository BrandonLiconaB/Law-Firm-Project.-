import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { up, down } from '../../src/db/migrations/007_create_matters.js'
import { createTestDatabase, prepareTestEnvironment } from './testDatabase.js'

prepareTestEnvironment()
const database = createTestDatabase()
const statuses = ['Pending Documents', 'Ready to Start Drafting', 'Ready to Draft', 'Ready to R/S',
  'Pending Corrections', 'Corrections Ready', 'Accepted', 'Sent']
const automaticStatuses = statuses.slice(0, 3)
const tables = ['matters', 'matter_sections', 'matter_documents', 'matter_status_history']
let client
let fixture
let baseline

async function counts() {
  return (await database.query(`SELECT
    (SELECT count(*)::integer FROM app.users) AS users,
    (SELECT count(*)::integer FROM app.matter_types) AS types,
    (SELECT count(*)::integer FROM app.template_sections) AS sections,
    (SELECT count(*)::integer FROM app.template_documents) AS definitions,
    (SELECT count(*)::integer FROM app.matters) AS matters,
    (SELECT count(*)::integer FROM app.matter_sections) AS "matterSections",
    (SELECT count(*)::integer FROM app.matter_documents) AS documents,
    (SELECT count(*)::integer FROM app.matter_status_history) AS history
  `)).rows[0]
}

async function insert(table, input) {
  const columns = Object.keys(input)
  // Table and column names here are test-authored constants, never request input.
  return (await client.query(`INSERT INTO app.${table} (${columns.join(', ')})
    VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`, Object.values(input))).rows[0]
}

async function availableNumber(leadingZero = false) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const number = String(randomInt(leadingZero ? 100_000 : 1_000_000)).padStart(6, '0')
    if (!(await client.query('SELECT 1 FROM app.matters WHERE matter_name = $1', [number])).rowCount) return number
  }
  throw new Error('Unable to reserve a test-only matter number without modifying existing records.')
}

function newMatter(extra = {}) {
  return { matter_name: fixture.number, matter_type_id: fixture.type.id,
    created_by: fixture.user.id, updated_by: fixture.user.id, ...extra }
}
function newSection(extra = {}) {
  return { matter_id: fixture.matter.id, matter_type_id: fixture.type.id,
    template_section_id: fixture.section.id, name: fixture.section.name, position: 1, ...extra }
}
function newDocument(extra = {}) {
  return { matter_id: fixture.matter.id, matter_type_id: fixture.type.id,
    template_document_id: fixture.definition.id, section_id: fixture.matterSection.id,
    name: fixture.definition.name, is_key: true, expected_quantity: 10, position: 1, ...extra }
}
function event(extra = {}) {
  return { matter_id: fixture.matter.id, from_status: 'Pending Documents', to_status: 'Ready to Start Drafting',
    from_source: 'Automatic', to_source: 'Automatic', changed_by: fixture.user.id, reason: 'Document updated', ...extra }
}

async function expectFailure(operation, code, constraint) {
  await client.query('SAVEPOINT expected_failure')
  try {
    await assert.rejects(operation, (error) => {
      assert.equal(error.code, code)
      if (constraint) assert.equal(error.constraint, constraint)
      return true
    })
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure')
    await client.query('RELEASE SAVEPOINT expected_failure')
  }
}

async function buildFixture() {
  const run = randomUUID().replaceAll('-', '').slice(0, 12)
  fixture = {}
  fixture.user = await insert('users', { username: `matter_schema_${run}`, full_name: 'Matter schema user',
    password_hash: 'schema-only-unused-hash', system_role: 'MEMBER' })
  fixture.otherUser = await insert('users', { username: `matter_other_${run}`, full_name: 'Other schema user',
    password_hash: 'schema-only-unused-hash', system_role: 'MEMBER' })
  fixture.type = await insert('matter_types', { name: `Matter schema ${run}`, template_revision: 9 })
  fixture.otherType = await insert('matter_types', { name: `Other schema ${run}` })
  fixture.section = await insert('template_sections', { matter_type_id: fixture.type.id, name: 'Petitioner', position: 1 })
  fixture.otherSection = await insert('template_sections', { matter_type_id: fixture.otherType.id, name: 'Beneficiary', position: 1 })
  fixture.definition = await insert('template_documents', { matter_type_id: fixture.type.id,
    section_id: fixture.section.id, name: 'Passport', is_key: true, expected_quantity: 10, position: 1 })
  fixture.generalDefinition = await insert('template_documents', { matter_type_id: fixture.type.id, name: 'Letters', position: 1 })
  fixture.otherDefinition = await insert('template_documents', { matter_type_id: fixture.otherType.id,
    section_id: fixture.otherSection.id, name: 'Other passport', is_key: true, position: 1 })
  fixture.number = await availableNumber()
  fixture.matter = await insert('matters', newMatter())
  fixture.sameTypeMatter = await insert('matters', newMatter({ matter_name: await availableNumber() }))
  fixture.otherMatter = await insert('matters', newMatter({ matter_name: await availableNumber(), matter_type_id: fixture.otherType.id }))
  fixture.matterSection = await insert('matter_sections', newSection())
  fixture.sameTypeMatterSection = await insert('matter_sections', newSection({ matter_id: fixture.sameTypeMatter.id }))
  fixture.otherMatterSection = await insert('matter_sections', newSection({ matter_id: fixture.otherMatter.id,
    matter_type_id: fixture.otherType.id, template_section_id: fixture.otherSection.id, name: 'Beneficiary' }))
  fixture.document = await insert('matter_documents', newDocument())
}

describe('matter database foundation against isolated PostgreSQL', { concurrency: false, timeout: 60000 }, () => {
  before(async () => { baseline = await counts() })
  beforeEach(async () => {
    client = await database.connect()
    await client.query('BEGIN')
    await buildFixture()
  })
  afterEach(async () => {
    if (client) {
      try { await client.query('ROLLBACK') } finally { client.release(); client = null }
    }
    // No committed fixtures, table truncation, or development-database cleanup.
    assert.deepEqual(await counts(), baseline)
  })
  after(async () => {
    try { if (baseline) assert.deepEqual(await counts(), baseline) } finally { await database.end() }
  })

  it('registers migration 007 and exposes exactly the four planned relational tables', async () => {
    const migration = await client.query("SELECT name FROM app_migrations.pgmigrations WHERE name = '007_create_matters'")
    assert.equal(migration.rowCount, 1)
    const present = await client.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'app' AND table_type = 'BASE TABLE' AND table_name = ANY($1::text[]) ORDER BY table_name`, [tables])
    assert.deepEqual(present.rows.map((row) => row.table_name), [...tables].sort())
    const columns = await client.query(`SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'matters'`)
    assert.equal(columns.rows.find((row) => row.column_name === 'matter_name').data_type, 'character varying')
    assert.equal(columns.rows.some((row) => /client|email|assigned/.test(row.column_name)), false)
  })

  it('starts matters Pending and Automatic, with UUIDs, user references and server timestamps', () => {
    const matter = fixture.matter
    assert.match(matter.id, /^[a-f0-9-]{36}$/)
    assert.equal(matter.status, 'Pending Documents')
    assert.equal(matter.status_source, 'Automatic')
    assert.equal(matter.version, 1)
    assert.equal(matter.template_revision, 0)
    assert.equal(matter.created_by, fixture.user.id)
    for (const field of ['created_at', 'updated_at', 'status_updated_at']) assert.ok(matter[field] instanceof Date)
  })

  it('preserves leading zeros and rejects duplicate matter numbers across types and on correction', async () => {
    const zeroNumber = '001234'
    const taken = await client.query('SELECT id FROM app.matters WHERE matter_name = $1', [zeroNumber])
    // Do not overwrite a number belonging to an unrelated test fixture.
    const number = taken.rowCount ? await availableNumber(true) : zeroNumber
    const matter = await insert('matters', newMatter({ matter_name: number }))
    assert.equal(matter.matter_name, number)
    await expectFailure(() => insert('matters', newMatter({ matter_name: number, matter_type_id: fixture.otherType.id })), '23505', 'matters_name_unique')
    await expectFailure(() => client.query('UPDATE app.matters SET matter_name = $1 WHERE id = $2', [number, fixture.matter.id]), '23505', 'matters_name_unique')
  })

  it('rejects non-ASCII digits, invalid lengths, punctuation and missing numbers', async () => {
    for (const value of ['', '12345', '12 345', '12.345', '12345a', '-12345', '１２３４５６', '١٢٣٤٥٦', '12345\n']) {
      await expectFailure(() => insert('matters', newMatter({ matter_name: value })), '23514', 'matters_name_format_check')
    }
    await expectFailure(() => insert('matters', newMatter({ matter_name: '1234567' })), '22001')
    await expectFailure(() => insert('matters', newMatter({ matter_name: null })), '23502')
  })

  it('allows all eight manual statuses but only the first three automatic statuses', async () => {
    for (const status of statuses) {
      const updated = await client.query("UPDATE app.matters SET status_source = 'Manual', status = $1 WHERE id = $2 RETURNING status", [status, fixture.matter.id])
      assert.equal(updated.rows[0].status, status)
    }
    for (const status of automaticStatuses) await client.query("UPDATE app.matters SET status_source = 'Automatic', status = $1 WHERE id = $2", [status, fixture.matter.id])
    for (const status of statuses.slice(3)) await expectFailure(() => client.query("UPDATE app.matters SET status_source = 'Automatic', status = $1 WHERE id = $2", [status, fixture.matter.id]), '23514', 'matters_automatic_status_check')
    await expectFailure(() => client.query("UPDATE app.matters SET status_source = 'Manual', status = 'Unknown' WHERE id = $1", [fixture.matter.id]), '23514', 'matters_status_check')
  })

  it('rejects invalid workflow sources, versions, revisions and missing relations', async () => {
    for (const [field, value, constraint] of [
      ['status_source', 'System', 'matters_status_source_check'], ['version', 0, 'matters_version_check'],
      ['version', -1, 'matters_version_check'], ['template_revision', -1, 'matters_template_revision_check'],
    ]) await expectFailure(() => client.query(`UPDATE app.matters SET ${field} = $1 WHERE id = $2`, [value, fixture.matter.id]), '23514', constraint)
    for (const field of ['matter_type_id', 'created_by', 'updated_by']) {
      await expectFailure(() => client.query(`UPDATE app.matters SET ${field} = $1 WHERE id = $2`, [randomUUID(), fixture.matter.id]), '23503')
    }
  })

  it('keeps one section snapshot per template section and verifies its matter type', async () => {
    await expectFailure(() => insert('matter_sections', newSection()), '23505', 'matter_sections_definition_unique')
    await expectFailure(() => insert('matter_sections', newSection({ matter_type_id: fixture.otherType.id,
      template_section_id: fixture.otherSection.id })), '23503', 'matter_sections_matter_type_fk')
    await expectFailure(() => insert('matter_sections', newSection({ template_section_id: fixture.otherSection.id })), '23503', 'matter_sections_template_type_fk')
    assert.equal(fixture.sameTypeMatterSection.template_section_id, fixture.matterSection.template_section_id)
    assert.notEqual(fixture.sameTypeMatterSection.id, fixture.matterSection.id)
  })

  it('rejects cross-matter sections even when the two matters have the same type', async () => {
    for (const sectionId of [fixture.sameTypeMatterSection.id, fixture.otherMatterSection.id, randomUUID()]) {
      await expectFailure(() => client.query('UPDATE app.matter_documents SET section_id = $1 WHERE id = $2', [sectionId, fixture.document.id]), '23503', 'matter_documents_section_matter_fk')
    }
  })

  it('verifies the document definition and its matter type independently', async () => {
    await expectFailure(() => client.query('UPDATE app.matter_documents SET template_document_id = $1 WHERE id = $2', [fixture.otherDefinition.id, fixture.document.id]), '23503', 'matter_documents_template_type_fk')
    await expectFailure(() => client.query('UPDATE app.matter_documents SET matter_type_id = $1, template_document_id = $2 WHERE id = $3', [fixture.otherType.id, fixture.otherDefinition.id, fixture.document.id]), '23503', 'matter_documents_matter_type_fk')
    await expectFailure(() => client.query('UPDATE app.matter_documents SET template_document_id = $1 WHERE id = $2', [randomUUID(), fixture.document.id]), '23503', 'matter_documents_template_type_fk')
  })

  it('represents General without a section and has independent Pending tracking defaults', async () => {
    const doc = await insert('matter_documents', newDocument({ template_document_id: fixture.generalDefinition.id, section_id: null,
      name: 'Letters', is_key: false, expected_quantity: null }))
    assert.equal(doc.section_id, null)
    assert.equal(doc.status, 'Pending')
    assert.equal(doc.comment, '')
    assert.equal(doc.received_quantity, null)
    assert.equal(doc.tracking_updated_by, null)
    assert.ok(doc.tracking_updated_at instanceof Date)
    await expectFailure(() => insert('matter_documents', newDocument()), '23505', 'matter_documents_definition_unique')
  })

  it('validates snapshot names, descriptions and positive ordering positions', async () => {
    for (const name of ['', ' Passport', 'Passport ', 'Pass  port', 'Passport\tcopy', '\u00a0Passport', 'Pass\u2003port']) {
      await expectFailure(() => client.query('UPDATE app.matter_documents SET name = $1 WHERE id = $2', [name, fixture.document.id]), '23514', 'matter_documents_name_format_check')
      await expectFailure(() => client.query('UPDATE app.matter_sections SET name = $1 WHERE id = $2', [name, fixture.matterSection.id]), '23514', 'matter_sections_name_format_check')
    }
    for (const table of ['matter_documents', 'matter_sections']) {
      const id = table === 'matter_documents' ? fixture.document.id : fixture.matterSection.id
      await expectFailure(() => client.query(`UPDATE app.${table} SET name = $1 WHERE id = $2`, ['n'.repeat(121), id]), '22001')
      for (const position of [0, -1]) await expectFailure(() => client.query(`UPDATE app.${table} SET position = $1 WHERE id = $2`, [position, id]), '23514', `${table}_position_check`)
      await client.query(`UPDATE app.${table} SET name = $1 WHERE id = $2`, ['n'.repeat(120), id])
    }
    await expectFailure(() => client.query('UPDATE app.matter_documents SET description = $1 WHERE id = $2', ['d'.repeat(1001), fixture.document.id]), '23514', 'matter_documents_description_length_check')
    await client.query('UPDATE app.matter_documents SET description = $1 WHERE id = $2', ['d'.repeat(1000), fixture.document.id])
  })

  it('accepts all four document statuses and Received below or above expected quantity', async () => {
    for (const status of ['Pending', 'Received', 'Client Does Not Have', 'Not Applicable']) {
      await client.query('UPDATE app.matter_documents SET status = $1 WHERE id = $2', [status, fixture.document.id])
    }
    for (const quantity of [0, 6, 10, 12, 2147483647]) {
      const result = await client.query("UPDATE app.matter_documents SET status = 'Received', received_quantity = $1 WHERE id = $2 RETURNING *", [quantity, fixture.document.id])
      assert.equal(result.rows[0].status, 'Received')
      assert.equal(result.rows[0].received_quantity, quantity)
    }
    await expectFailure(() => client.query("UPDATE app.matter_documents SET status = 'Missing' WHERE id = $1", [fixture.document.id]), '23514', 'matter_documents_status_check')
  })

  it('rejects negative, fractional or out-of-range quantities without forcing delivery completeness', async () => {
    for (const quantity of [0, -1]) await expectFailure(() => client.query('UPDATE app.matter_documents SET expected_quantity = $1 WHERE id = $2', [quantity, fixture.document.id]), '23514', 'matter_documents_expected_quantity_check')
    await expectFailure(() => client.query('UPDATE app.matter_documents SET received_quantity = -1 WHERE id = $1', [fixture.document.id]), '23514', 'matter_documents_received_quantity_check')
    for (const field of ['expected_quantity', 'received_quantity']) {
      await expectFailure(() => client.query(`UPDATE app.matter_documents SET ${field} = $1 WHERE id = $2`, [1.5, fixture.document.id]), '22P02')
      await expectFailure(() => client.query(`UPDATE app.matter_documents SET ${field} = $1 WHERE id = $2`, [2147483648, fixture.document.id]), '22003')
    }
    await client.query('UPDATE app.matter_documents SET expected_quantity = NULL, received_quantity = NULL WHERE id = $1', [fixture.document.id])
  })

  it('definition edits do not reset quantity, Received, comment or last tracking metadata', async () => {
    const previousTime = new Date('2000-01-01T00:00:00Z')
    const comment = "Received 6 letters. O'Brien's note stays unchanged.\nSecond line."
    await client.query(`UPDATE app.matter_documents SET status = 'Received', received_quantity = 6, comment = $1,
      tracking_updated_by = $2, tracking_updated_at = $3 WHERE id = $4`, [comment, fixture.otherUser.id, previousTime, fixture.document.id])
    for (const expected of [20, 3, null, 10]) {
      const result = await client.query(`UPDATE app.matter_documents SET name = 'Updated passport', description = 'New definition',
        expected_quantity = $1, is_key = false, section_id = NULL, updated_at = $2 WHERE id = $3 RETURNING *`, [expected, previousTime, fixture.document.id])
      const doc = result.rows[0]
      assert.equal(doc.id, fixture.document.id)
      assert.equal(doc.template_document_id, fixture.definition.id)
      assert.equal(doc.status, 'Received')
      assert.equal(doc.received_quantity, 6)
      assert.equal(doc.comment, comment)
      assert.equal(doc.tracking_updated_by, fixture.otherUser.id)
      assert.equal(doc.tracking_updated_at.toISOString(), previousTime.toISOString())
      assert.ok(doc.updated_at > previousTime)
    }
  })

  it('Accepted and Sent allow incomplete checklists, further edits and empty comments', async () => {
    for (const status of ['Accepted', 'Sent']) {
      await client.query("UPDATE app.matters SET status_source = 'Manual', status = $1 WHERE id = $2", [status, fixture.matter.id])
      const result = await client.query(`UPDATE app.matter_documents SET status = 'Pending', received_quantity = 0,
        comment = '', tracking_updated_by = $1 WHERE id = $2 RETURNING *`, [fixture.user.id, fixture.document.id])
      assert.equal(result.rows[0].status, 'Pending')
      assert.equal(result.rows[0].comment, '')
      const matter = await client.query('SELECT status, status_source FROM app.matters WHERE id = $1', [fixture.matter.id])
      assert.deepEqual(matter.rows[0], { status, status_source: 'Manual' })
    }
  })

  it('retirement retains snapshots and tracking with a frozen previous section label', async () => {
    await client.query("UPDATE app.matter_documents SET status = 'Received', received_quantity = 6, comment = 'Keep this delivery' WHERE id = $1", [fixture.document.id])
    await expectFailure(() => client.query('UPDATE app.matter_documents SET retired_at = CURRENT_TIMESTAMP WHERE id = $1', [fixture.document.id]), '23514', 'matter_documents_archive_check')
    await expectFailure(() => client.query("UPDATE app.matter_documents SET previous_section_name = 'Petitioner' WHERE id = $1", [fixture.document.id]), '23514', 'matter_documents_archive_check')
    const result = await client.query("UPDATE app.matter_documents SET retired_at = CURRENT_TIMESTAMP, previous_section_name = 'Petitioner' WHERE id = $1 RETURNING *", [fixture.document.id])
    assert.equal(result.rows[0].status, 'Received')
    assert.equal(result.rows[0].received_quantity, 6)
    assert.equal(result.rows[0].comment, 'Keep this delivery')
    await client.query("UPDATE app.matter_sections SET name = 'Applicant', retired_at = CURRENT_TIMESTAMP WHERE id = $1", [fixture.matterSection.id])
    const snapshot = await client.query('SELECT previous_section_name FROM app.matter_documents WHERE id = $1', [fixture.document.id])
    assert.equal(snapshot.rows[0].previous_section_name, 'Petitioner')
    await expectFailure(() => insert('matter_documents', newDocument()), '23505', 'matter_documents_definition_unique')
  })

  it('allows section retirement and movement to General without losing document tracking', async () => {
    await client.query("UPDATE app.matter_documents SET status = 'Received', received_quantity = 6, comment = 'Keep me', section_id = NULL WHERE id = $1", [fixture.document.id])
    await client.query('UPDATE app.matter_sections SET retired_at = CURRENT_TIMESTAMP WHERE id = $1', [fixture.matterSection.id])
    const doc = (await client.query('SELECT * FROM app.matter_documents WHERE id = $1', [fixture.document.id])).rows[0]
    assert.equal(doc.section_id, null)
    assert.equal(doc.status, 'Received')
    assert.equal(doc.received_quantity, 6)
    assert.equal(doc.comment, 'Keep me')
    assert.equal(doc.retired_at, null)
  })

  it('keeps retired definition references and treats a recreated name as a new requirement', async () => {
    await client.query('UPDATE app.template_documents SET retired_at = CURRENT_TIMESTAMP WHERE id = $1', [fixture.definition.id])
    await client.query("UPDATE app.matter_documents SET status = 'Received', received_quantity = 6, retired_at = CURRENT_TIMESTAMP, previous_section_name = 'Petitioner' WHERE id = $1", [fixture.document.id])
    const definition = await insert('template_documents', { matter_type_id: fixture.type.id, name: 'Passport', position: 2 })
    const replacement = await insert('matter_documents', newDocument({ template_document_id: definition.id, position: 2 }))
    assert.notEqual(replacement.id, fixture.document.id)
    assert.notEqual(replacement.template_document_id, fixture.definition.id)
    assert.equal(replacement.status, 'Pending')
    assert.equal(replacement.received_quantity, null)
    assert.equal(replacement.comment, '')
    const old = (await client.query('SELECT * FROM app.matter_documents WHERE id = $1', [fixture.document.id])).rows[0]
    assert.equal(old.received_quantity, 6)
    assert.equal(old.status, 'Received')
  })

  it('protects referenced matters, users, types and definitions from cascading deletion', async () => {
    for (const [table, id] of [['matters', fixture.matter.id], ['users', fixture.user.id], ['matter_types', fixture.type.id],
      ['template_sections', fixture.section.id], ['template_documents', fixture.definition.id], ['matter_sections', fixture.matterSection.id]]) {
      await expectFailure(() => client.query(`DELETE FROM app.${table} WHERE id = $1`, [id]), '23503')
    }
    await expectFailure(() => client.query('UPDATE app.matter_documents SET tracking_updated_by = $1 WHERE id = $2', [randomUUID(), fixture.document.id]), '23503')
  })

  it('records initial history and normal workflow changes with an actor and server date', async () => {
    const initial = await insert('matter_status_history', event({ from_status: null, from_source: null,
      to_status: 'Pending Documents', reason: 'Matter created' }))
    assert.equal(initial.changed_by, fixture.user.id)
    assert.ok(initial.changed_at instanceof Date)
    const next = await insert('matter_status_history', event())
    assert.equal(next.to_status, 'Ready to Start Drafting')
    assert.equal(next.reason, 'Document updated')
    await expectFailure(() => insert('matter_status_history', event({ from_status: null, from_source: null,
      to_status: 'Pending Documents', reason: 'Matter created' })), '23505', 'matter_history_creation_unique_idx')
  })

  it('records mode-only changes and type replacement but rejects meaningless history duplicates', async () => {
    const changed = await insert('matter_status_history', event({ to_status: 'Pending Documents', to_source: 'Manual', reason: 'Manual status selected' }))
    assert.equal(changed.from_status, changed.to_status)
    assert.notEqual(changed.from_source, changed.to_source)
    await insert('matter_status_history', event({ from_source: 'Manual', to_status: 'Pending Documents', reason: 'Automatic mode enabled' }))
    await insert('matter_status_history', event({ to_status: 'Pending Documents', reason: 'Matter type changed' }))
    await expectFailure(() => insert('matter_status_history', event({ to_status: 'Pending Documents' })), '23514', 'matter_history_effective_change_check')
  })

  it('rejects invalid history states, sources, initial pairs, reasons and references', async () => {
    for (const [changes, constraint] of [
      [{ from_status: 'Unknown', from_source: 'Manual' }, 'matter_history_from_status_check'],
      [{ to_status: 'Unknown', to_source: 'Manual' }, 'matter_history_to_status_check'],
      [{ from_source: 'System' }, 'matter_history_from_source_check'],
      [{ to_source: 'System' }, 'matter_history_to_source_check'],
      [{ from_status: null }, 'matter_history_initial_event_check'],
      [{ from_status: null, from_source: null }, 'matter_history_initial_event_check'],
      [{ reason: 'Attorney private note' }, 'matter_history_reason_check'],
      [{ from_status: 'Accepted' }, 'matter_history_automatic_from_check'],
      [{ to_status: 'Sent' }, 'matter_history_automatic_to_check'],
    ]) await expectFailure(() => insert('matter_status_history', event(changes)), '23514', constraint)
    for (const changes of [{ matter_id: randomUUID() }, { changed_by: randomUUID() }]) await expectFailure(() => insert('matter_status_history', event(changes)), '23503')
    await expectFailure(() => insert('matter_status_history', event({ changed_by: null })), '23502')
  })

  it('supports replacing a matter type while retaining its previous status history', async () => {
    await insert('matter_status_history', event({ from_status: null, from_source: null, to_status: 'Pending Documents', reason: 'Matter created' }))
    await insert('matter_status_history', event({ to_status: 'Accepted', to_source: 'Manual', reason: 'Manual status selected' }))
    await insert('matter_documents', newDocument({ template_document_id: fixture.generalDefinition.id, section_id: null,
      name: 'Letters', position: 2, retired_at: new Date(), previous_section_name: 'General documents' }))
    await client.query('DELETE FROM app.matter_documents WHERE matter_id = $1', [fixture.matter.id])
    await client.query('DELETE FROM app.matter_sections WHERE matter_id = $1', [fixture.matter.id])
    await client.query(`UPDATE app.matters SET matter_type_id = $1, status = 'Pending Documents', status_source = 'Automatic',
      template_revision = 0, version = version + 1, updated_by = $2 WHERE id = $3`, [fixture.otherType.id, fixture.otherUser.id, fixture.matter.id])
    const section = await insert('matter_sections', newSection({ matter_type_id: fixture.otherType.id,
      template_section_id: fixture.otherSection.id, name: 'Beneficiary' }))
    await insert('matter_documents', newDocument({ matter_type_id: fixture.otherType.id, template_document_id: fixture.otherDefinition.id,
      section_id: section.id, name: 'Other passport' }))
    await insert('matter_status_history', event({ from_status: 'Accepted', from_source: 'Manual', to_status: 'Pending Documents', reason: 'Matter type changed' }))
    const history = await client.query('SELECT reason FROM app.matter_status_history WHERE matter_id = $1', [fixture.matter.id])
    assert.equal(history.rowCount, 3)
    const document = (await client.query('SELECT * FROM app.matter_documents WHERE matter_id = $1', [fixture.matter.id])).rows[0]
    assert.equal(document.status, 'Pending')
    assert.equal(document.retired_at, null)
    assert.equal(document.template_document_id, fixture.otherDefinition.id)
  })

  it('updates row timestamps without changing tracking dates or workflow dates implicitly', async () => {
    const past = new Date('2000-01-01T00:00:00Z')
    const matter = (await client.query('UPDATE app.matters SET updated_at = $1 WHERE id = $2 RETURNING *', [past, fixture.matter.id])).rows[0]
    const section = (await client.query('UPDATE app.matter_sections SET updated_at = $1 WHERE id = $2 RETURNING *', [past, fixture.matterSection.id])).rows[0]
    assert.ok(matter.updated_at > past)
    assert.ok(section.updated_at > past)
    assert.equal(matter.status_updated_at.toISOString(), fixture.matter.status_updated_at.toISOString())
    assert.equal(matter.version, 1, 'Version increments belong to the future write service, not the generic timestamp trigger.')
  })

  it('has dedicated lookup indexes and does not grant PUBLIC access to the new tables', async () => {
    const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'app' AND tablename = ANY($1::text[])", [tables])
    const names = new Set(indexes.rows.map((row) => row.indexname))
    for (const name of ['matters_name_unique', 'matters_type_order_idx', 'matters_status_order_idx',
      'matter_sections_active_order_idx', 'matter_documents_active_order_idx', 'matter_documents_retired_order_idx', 'matter_history_order_idx']) assert.ok(names.has(name), name)
    const privileges = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
      WHERE n.nspname = 'app' AND c.relname = ANY($1::text[]) AND acl.grantee = 0`, [tables])
    assert.equal(privileges.rowCount, 0)
  })

  it('can reverse and reapply migration 007 inside a test-only transaction that is always rolled back', async () => {
    // This never changes migration records or commits DDL/data. afterEach restores
    // the exact schema and records present before this test, even on failure.
    let downSql
    let upSql
    down({ sql: (value) => { downSql = value } })
    up({ sql: (value) => { upSql = value } })
    await client.query(downSql)
    const removed = await client.query("SELECT to_regclass('app.matters') AS table_name")
    assert.equal(removed.rows[0].table_name, null)
    await client.query(upSql)
    const restored = await client.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'app' AND table_name = ANY($1::text[])`, [tables])
    assert.equal(restored.rowCount, 4)
    const matter = await insert('matters', newMatter())
    assert.equal(matter.status, 'Pending Documents')
    assert.equal(matter.version, 1)
  })
})
