export function up(pgm) {
  pgm.sql(String.raw`
    ALTER TABLE app.matter_types ADD COLUMN template_revision integer NOT NULL DEFAULT 0;
    ALTER TABLE app.matter_types ADD CONSTRAINT matter_types_template_revision_check
      CHECK (template_revision >= 0);

    CREATE TABLE app.template_sections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_type_id uuid NOT NULL REFERENCES app.matter_types(id),
      name varchar(120) NOT NULL,
      position integer NOT NULL CHECK (position > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      retired_at timestamptz,
      CONSTRAINT template_sections_type_id_unique UNIQUE (matter_type_id, id),
      CONSTRAINT template_sections_name_format_check CHECK (
        char_length(name) BETWEEN 1 AND 120
        AND name = btrim(regexp_replace(name,
          U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))
      )
    );

    CREATE TABLE app.template_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_type_id uuid NOT NULL REFERENCES app.matter_types(id),
      section_id uuid,
      name varchar(120) NOT NULL,
      description text NOT NULL DEFAULT '',
      is_key boolean NOT NULL DEFAULT false,
      expected_quantity integer,
      position integer NOT NULL CHECK (position > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      retired_at timestamptz,
      CONSTRAINT template_documents_section_type_fk
        FOREIGN KEY (matter_type_id, section_id)
        REFERENCES app.template_sections(matter_type_id, id),
      CONSTRAINT template_documents_name_format_check CHECK (
        char_length(name) BETWEEN 1 AND 120
        AND name = btrim(regexp_replace(name,
          U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))
      ),
      CONSTRAINT template_documents_description_length_check CHECK (char_length(description) <= 1000),
      CONSTRAINT template_documents_quantity_check CHECK (expected_quantity IS NULL OR expected_quantity > 0)
    );

    CREATE UNIQUE INDEX template_sections_name_active_idx
      ON app.template_sections (matter_type_id, lower(name)) WHERE retired_at IS NULL;
    CREATE UNIQUE INDEX template_documents_name_active_idx
      ON app.template_documents (matter_type_id, lower(name)) WHERE retired_at IS NULL;
    CREATE INDEX template_sections_active_order_idx
      ON app.template_sections (matter_type_id, position, id) WHERE retired_at IS NULL;
    CREATE INDEX template_documents_active_order_idx
      ON app.template_documents (matter_type_id, section_id, position, id) WHERE retired_at IS NULL;

    CREATE TRIGGER template_sections_set_updated_at BEFORE UPDATE ON app.template_sections
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
    CREATE TRIGGER template_documents_set_updated_at BEFORE UPDATE ON app.template_documents
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

    CREATE VIEW app.matter_type_template_summary AS
      SELECT t.id, t.name, t.description, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
        t.template_revision AS "templateRevision", counts.documents AS "documentCount",
        counts.keys AS "keyDocumentCount",
        CASE WHEN counts.documents = 0 THEN 'Template required'
             WHEN counts.keys = 0 THEN 'Key document required'
             ELSE 'Ready' END AS "templateStatus"
      FROM app.matter_types t
      CROSS JOIN LATERAL (
        SELECT count(*)::integer AS documents,
          count(*) FILTER (WHERE is_key)::integer AS keys
        FROM app.template_documents WHERE matter_type_id = t.id AND retired_at IS NULL
      ) AS counts;

    REVOKE ALL ON TABLE app.template_sections, app.template_documents,
      app.matter_type_template_summary FROM PUBLIC;
    COMMENT ON TABLE app.template_documents
      IS 'Requirement definitions, not uploaded files or matter delivery tracking';
    COMMENT ON COLUMN app.template_documents.retired_at
      IS 'Removal from the current template without losing the stable requirement identifier';
    COMMENT ON COLUMN app.matter_types.template_revision
      IS 'Incremented transactionally with effective template changes';
  `)
}

export function down(pgm) {
  pgm.sql(`
    DROP VIEW app.matter_type_template_summary;
    DROP TABLE app.template_documents;
    DROP TABLE app.template_sections;
    ALTER TABLE app.matter_types DROP CONSTRAINT matter_types_template_revision_check;
    ALTER TABLE app.matter_types DROP COLUMN template_revision;
  `)
}
