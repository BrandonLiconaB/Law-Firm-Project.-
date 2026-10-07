const MATTER_TYPE_COLUMNS = `
  id, name, description,
  "createdAt", "updatedAt", "templateRevision", "documentCount", "keyDocumentCount", "templateStatus"
`

export async function insertMatterType(database, { name, description }) {
  const result = await database.query(
    `INSERT INTO app.matter_types (name, description)
     VALUES ($1, $2)
     RETURNING id`,
    [name, description],
  )
  return result.rows[0]
}

export async function updateMatterTypeById(database, id, { name, description }) {
  // Omitted fields remain untouched, including during concurrent PATCH requests.
  const result = await database.query(
    `UPDATE app.matter_types SET
       name = COALESCE($2, name),
       description = COALESCE($3, description)
     WHERE id = $1
     RETURNING id`,
    [id, name ?? null, description ?? null],
  )
  return result.rows[0] ?? null
}

export async function findMatterTypeById(database, id) {
  const result = await database.query(
    `SELECT ${MATTER_TYPE_COLUMNS} FROM app.matter_type_template_summary WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function findMatterTypesPage(database, { limit, offset }) {
  // Count and records share one snapshot; an empty page still returns the total.
  const result = await database.query(
    `WITH total_types AS (
       SELECT count(*)::integer AS total FROM app.matter_types
     )
     SELECT total_types.total, page_types.*
     FROM total_types
     LEFT JOIN LATERAL (
       SELECT ${MATTER_TYPE_COLUMNS}
       FROM app.matter_type_template_summary
       ORDER BY lower(name), id
       LIMIT $1 OFFSET $2
     ) AS page_types ON true
     ORDER BY lower(page_types.name), page_types.id`,
    [limit, offset],
  )
  return {
    total: result.rows[0].total,
    matterTypes: result.rows.filter((row) => row.id).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      templateRevision: row.templateRevision,
      documentCount: row.documentCount,
      keyDocumentCount: row.keyDocumentCount,
      templateStatus: row.templateStatus,
    })),
  }
}
