const COLUMNS = `id, matter_type_id AS "matterTypeId", section_id AS "sectionId", name, description,
  is_key AS "isKey", expected_quantity AS "expectedQuantity", position,
  created_at AS "createdAt", updated_at AS "updatedAt"`

export async function findDocument(client, matterTypeId, documentId) {
  const result = await client.query(
    `SELECT ${COLUMNS} FROM app.template_documents
     WHERE matter_type_id = $1 AND id = $2 AND retired_at IS NULL`, [matterTypeId, documentId],
  )
  return result.rows[0] ?? null
}

export async function listGroupDocuments(client, matterTypeId, sectionId) {
  const result = await client.query(
    `SELECT ${COLUMNS} FROM app.template_documents WHERE matter_type_id = $1
     AND section_id IS NOT DISTINCT FROM $2::uuid AND retired_at IS NULL
     ORDER BY position, id`, [matterTypeId, sectionId],
  )
  return result.rows
}

export async function insertDocument(client, matterTypeId, document) {
  const result = await client.query(
    `INSERT INTO app.template_documents
       (matter_type_id, section_id, name, description, is_key, expected_quantity, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
    [matterTypeId, document.sectionId, document.name, document.description,
      document.isKey, document.expectedQuantity, document.position],
  )
  return result.rows[0]
}

export async function updateDocument(client, matterTypeId, documentId, document) {
  // The service merges fields only after taking the parent template row lock.
  const result = await client.query(
    `UPDATE app.template_documents SET section_id = $3, name = $4, description = $5,
       is_key = $6, expected_quantity = $7, position = $8
     WHERE matter_type_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
    [matterTypeId, documentId, document.sectionId, document.name, document.description,
      document.isKey, document.expectedQuantity, document.position],
  )
  return result.rows[0]
}

export async function retireDocument(client, matterTypeId, documentId) {
  await client.query(
    'UPDATE app.template_documents SET retired_at = CURRENT_TIMESTAMP WHERE matter_type_id = $1 AND id = $2',
    [matterTypeId, documentId],
  )
}

export async function moveSectionDocumentsToGeneral(client, matterTypeId, sectionId) {
  await client.query(
    `UPDATE app.template_documents SET section_id = NULL
     WHERE matter_type_id = $1 AND section_id = $2 AND retired_at IS NULL`, [matterTypeId, sectionId],
  )
}

export async function reorderDocuments(client, matterTypeId, ids) {
  await client.query(
    `UPDATE app.template_documents d SET position = ordered.position::integer
     FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id, position)
     WHERE d.matter_type_id = $1 AND d.id = ordered.id AND d.retired_at IS NULL
       AND d.position IS DISTINCT FROM ordered.position::integer`, [matterTypeId, ids],
  )
}
