export async function lockTemplate(client, matterTypeId) {
  const result = await client.query(
    `SELECT id, template_revision AS "templateRevision" FROM app.matter_types
     WHERE id = $1 FOR UPDATE`, [matterTypeId],
  )
  return result.rows[0] ?? null
}

export async function incrementTemplateRevision(client, matterTypeId) {
  const result = await client.query(
    `UPDATE app.matter_types SET template_revision = template_revision + 1
     WHERE id = $1 RETURNING template_revision AS "templateRevision"`, [matterTypeId],
  )
  return result.rows[0].templateRevision
}

export async function findTemplate(database, matterTypeId) {
  // One statement gives the revision, counters, sections and documents one snapshot.
  const result = await database.query(
    `SELECT row_to_json(summary) AS "matterType",
       COALESCE(section_data.items, '[]'::json) AS sections,
       COALESCE(document_data.items, '[]'::json) AS documents
     FROM app.matter_type_template_summary summary
     LEFT JOIN LATERAL (
       SELECT json_agg(item ORDER BY item.position, item.id) AS items FROM (
         SELECT id, matter_type_id AS "matterTypeId", name, position,
           created_at AS "createdAt", updated_at AS "updatedAt"
         FROM app.template_sections WHERE matter_type_id = summary.id AND retired_at IS NULL
       ) item
     ) section_data ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(to_jsonb(item) - 'general_group' - 'section_position'
         ORDER BY item.general_group, item.section_position, item.position, item.id) AS items
       FROM (
         SELECT d.id, d.matter_type_id AS "matterTypeId", d.section_id AS "sectionId",
           d.name, d.description, d.is_key AS "isKey", d.expected_quantity AS "expectedQuantity",
           d.position, d.created_at AS "createdAt", d.updated_at AS "updatedAt",
           s.id IS NULL AS general_group, s.position AS section_position
         FROM app.template_documents d LEFT JOIN app.template_sections s ON s.id = d.section_id
         WHERE d.matter_type_id = summary.id AND d.retired_at IS NULL
       ) item
     ) document_data ON true WHERE summary.id = $1`, [matterTypeId],
  )
  if (!result.rows[0]) return null
  const template = result.rows[0]
  const normalizeDates = (item) => ({
    ...item,
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
  })
  template.matterType = normalizeDates(template.matterType)
  template.sections = template.sections.map(normalizeDates)
  template.documents = template.documents.map(normalizeDates)
  return template
}
