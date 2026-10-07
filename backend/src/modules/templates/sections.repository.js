const COLUMNS = `id, matter_type_id AS "matterTypeId", name, position,
  created_at AS "createdAt", updated_at AS "updatedAt"`

export async function findSection(client, matterTypeId, sectionId) {
  const result = await client.query(
    `SELECT ${COLUMNS} FROM app.template_sections
     WHERE matter_type_id = $1 AND id = $2 AND retired_at IS NULL`, [matterTypeId, sectionId],
  )
  return result.rows[0] ?? null
}

export async function listSections(client, matterTypeId) {
  const result = await client.query(
    `SELECT ${COLUMNS} FROM app.template_sections
     WHERE matter_type_id = $1 AND retired_at IS NULL ORDER BY position, id`, [matterTypeId],
  )
  return result.rows
}

export async function insertSection(client, matterTypeId, name, position) {
  const result = await client.query(
    `INSERT INTO app.template_sections (matter_type_id, name, position)
     VALUES ($1, $2, $3) RETURNING ${COLUMNS}`, [matterTypeId, name, position],
  )
  return result.rows[0]
}

export async function renameSection(client, matterTypeId, sectionId, name) {
  const result = await client.query(
    `UPDATE app.template_sections SET name = $3 WHERE matter_type_id = $1 AND id = $2
     RETURNING ${COLUMNS}`, [matterTypeId, sectionId, name],
  )
  return result.rows[0]
}

export async function retireSection(client, matterTypeId, sectionId) {
  await client.query(
    'UPDATE app.template_sections SET retired_at = CURRENT_TIMESTAMP WHERE matter_type_id = $1 AND id = $2',
    [matterTypeId, sectionId],
  )
}

export async function reorderSections(client, matterTypeId, ids) {
  await client.query(
    `UPDATE app.template_sections s SET position = ordered.position::integer
     FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id, position)
     WHERE s.matter_type_id = $1 AND s.id = ordered.id AND s.retired_at IS NULL
       AND s.position IS DISTINCT FROM ordered.position::integer`, [matterTypeId, ids],
  )
}
