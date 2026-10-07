export function up(pgm) {
  pgm.sql(String.raw`
    -- This pair allows a foreign key to verify both definition and matter type.
    ALTER TABLE app.template_documents ADD CONSTRAINT template_documents_type_id_unique
      UNIQUE (matter_type_id, id);

    CREATE TABLE app.matters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_name varchar(6) NOT NULL,
      matter_type_id uuid NOT NULL REFERENCES app.matter_types(id) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'Pending Documents',
      status_source text NOT NULL DEFAULT 'Automatic',
      status_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      template_revision integer NOT NULL DEFAULT 0,
      version integer NOT NULL DEFAULT 1,
      created_by uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
      updated_by uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT matters_name_format_check CHECK (
        char_length(matter_name) = 6 AND matter_name ~ '^[0-9]{6}$'
      ),
      CONSTRAINT matters_name_unique UNIQUE (matter_name),
      CONSTRAINT matters_id_type_unique UNIQUE (id, matter_type_id),
      CONSTRAINT matters_status_check CHECK (status IN (
        'Pending Documents', 'Ready to Start Drafting', 'Ready to Draft',
        'Ready to R/S', 'Pending Corrections', 'Corrections Ready', 'Accepted', 'Sent'
      )),
      CONSTRAINT matters_status_source_check CHECK (status_source IN ('Automatic', 'Manual')),
      CONSTRAINT matters_automatic_status_check CHECK (
        status_source <> 'Automatic' OR status IN (
          'Pending Documents', 'Ready to Start Drafting', 'Ready to Draft'
        )
      ),
      CONSTRAINT matters_template_revision_check CHECK (template_revision >= 0),
      CONSTRAINT matters_version_check CHECK (version > 0)
    );

    CREATE TABLE app.matter_sections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_id uuid NOT NULL,
      matter_type_id uuid NOT NULL,
      template_section_id uuid NOT NULL,
      name varchar(120) NOT NULL,
      position integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      retired_at timestamptz,
      CONSTRAINT matter_sections_matter_type_fk FOREIGN KEY (matter_id, matter_type_id)
        REFERENCES app.matters(id, matter_type_id) ON DELETE RESTRICT,
      CONSTRAINT matter_sections_template_type_fk FOREIGN KEY (matter_type_id, template_section_id)
        REFERENCES app.template_sections(matter_type_id, id) ON DELETE RESTRICT,
      CONSTRAINT matter_sections_matter_id_unique UNIQUE (matter_id, id),
      CONSTRAINT matter_sections_definition_unique UNIQUE (matter_id, template_section_id),
      CONSTRAINT matter_sections_name_format_check CHECK (
        char_length(name) BETWEEN 1 AND 120
        AND name = btrim(regexp_replace(name,
          U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))
      ),
      CONSTRAINT matter_sections_position_check CHECK (position > 0)
    );

    CREATE TABLE app.matter_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_id uuid NOT NULL,
      matter_type_id uuid NOT NULL,
      template_document_id uuid NOT NULL,
      section_id uuid,
      name varchar(120) NOT NULL,
      description text NOT NULL DEFAULT '',
      is_key boolean NOT NULL DEFAULT false,
      expected_quantity integer,
      position integer NOT NULL,
      status text NOT NULL DEFAULT 'Pending',
      received_quantity integer,
      comment text NOT NULL DEFAULT '',
      tracking_updated_by uuid REFERENCES app.users(id) ON DELETE RESTRICT,
      tracking_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      retired_at timestamptz,
      previous_section_name varchar(120),
      CONSTRAINT matter_documents_matter_type_fk FOREIGN KEY (matter_id, matter_type_id)
        REFERENCES app.matters(id, matter_type_id) ON DELETE RESTRICT,
      CONSTRAINT matter_documents_template_type_fk FOREIGN KEY (matter_type_id, template_document_id)
        REFERENCES app.template_documents(matter_type_id, id) ON DELETE RESTRICT,
      CONSTRAINT matter_documents_section_matter_fk FOREIGN KEY (matter_id, section_id)
        REFERENCES app.matter_sections(matter_id, id) ON DELETE RESTRICT,
      CONSTRAINT matter_documents_definition_unique UNIQUE (matter_id, template_document_id),
      CONSTRAINT matter_documents_name_format_check CHECK (
        char_length(name) BETWEEN 1 AND 120
        AND name = btrim(regexp_replace(name,
          U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))
      ),
      CONSTRAINT matter_documents_description_length_check CHECK (char_length(description) <= 1000),
      CONSTRAINT matter_documents_position_check CHECK (position > 0),
      CONSTRAINT matter_documents_status_check CHECK (status IN (
        'Pending', 'Received', 'Client Does Not Have', 'Not Applicable'
      )),
      CONSTRAINT matter_documents_expected_quantity_check CHECK (expected_quantity IS NULL OR expected_quantity > 0),
      CONSTRAINT matter_documents_received_quantity_check CHECK (received_quantity IS NULL OR received_quantity >= 0),
      CONSTRAINT matter_documents_archive_check CHECK (
        (retired_at IS NULL AND previous_section_name IS NULL)
        OR (retired_at IS NOT NULL AND previous_section_name IS NOT NULL
          AND char_length(btrim(previous_section_name)) BETWEEN 1 AND 120)
      )
    );

    CREATE TABLE app.matter_status_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_id uuid NOT NULL REFERENCES app.matters(id) ON DELETE RESTRICT,
      from_status text,
      to_status text NOT NULL,
      from_source text,
      to_source text NOT NULL,
      changed_by uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
      changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reason text NOT NULL,
      CONSTRAINT matter_history_from_status_check CHECK (from_status IN (
        'Pending Documents', 'Ready to Start Drafting', 'Ready to Draft',
        'Ready to R/S', 'Pending Corrections', 'Corrections Ready', 'Accepted', 'Sent'
      )),
      CONSTRAINT matter_history_to_status_check CHECK (to_status IN (
        'Pending Documents', 'Ready to Start Drafting', 'Ready to Draft',
        'Ready to R/S', 'Pending Corrections', 'Corrections Ready', 'Accepted', 'Sent'
      )),
      CONSTRAINT matter_history_from_source_check CHECK (from_source IN ('Automatic', 'Manual')),
      CONSTRAINT matter_history_to_source_check CHECK (to_source IN ('Automatic', 'Manual')),
      CONSTRAINT matter_history_source_pair_check CHECK ((from_status IS NULL) = (from_source IS NULL)),
      CONSTRAINT matter_history_automatic_from_check CHECK (
        from_source IS NULL OR from_source <> 'Automatic' OR from_status IN (
          'Pending Documents', 'Ready to Start Drafting', 'Ready to Draft'
        )
      ),
      CONSTRAINT matter_history_automatic_to_check CHECK (
        to_source <> 'Automatic' OR to_status IN (
          'Pending Documents', 'Ready to Start Drafting', 'Ready to Draft'
        )
      ),
      CONSTRAINT matter_history_reason_check CHECK (reason IN (
        'Matter created', 'Document updated', 'Template updated',
        'Matter type changed', 'Manual status selected', 'Automatic mode enabled'
      )),
      CONSTRAINT matter_history_initial_event_check CHECK (
        (reason = 'Matter created' AND from_status IS NULL AND from_source IS NULL
          AND to_status = 'Pending Documents' AND to_source = 'Automatic')
        OR (reason <> 'Matter created' AND from_status IS NOT NULL AND from_source IS NOT NULL)
      ),
      CONSTRAINT matter_history_effective_change_check CHECK (
        reason IN ('Matter created', 'Matter type changed')
        OR from_status IS DISTINCT FROM to_status OR from_source IS DISTINCT FROM to_source
      )
    );

    CREATE INDEX matters_created_order_idx ON app.matters (created_at DESC, id DESC);
    CREATE INDEX matters_type_order_idx ON app.matters (matter_type_id, created_at DESC, id DESC);
    CREATE INDEX matters_status_order_idx ON app.matters (status, created_at DESC, id DESC);
    CREATE INDEX matter_sections_active_order_idx ON app.matter_sections (matter_id, position, id)
      WHERE retired_at IS NULL;
    CREATE INDEX matter_sections_template_idx ON app.matter_sections (matter_type_id, template_section_id);
    CREATE INDEX matter_documents_active_order_idx ON app.matter_documents (matter_id, section_id, position, id)
      WHERE retired_at IS NULL;
    CREATE INDEX matter_documents_retired_order_idx ON app.matter_documents (matter_id, retired_at DESC, id DESC)
      WHERE retired_at IS NOT NULL;
    CREATE INDEX matter_documents_template_idx ON app.matter_documents (matter_type_id, template_document_id);
    CREATE INDEX matter_history_order_idx ON app.matter_status_history (matter_id, changed_at DESC, id DESC);
    CREATE UNIQUE INDEX matter_history_creation_unique_idx ON app.matter_status_history (matter_id)
      WHERE reason = 'Matter created';

    CREATE TRIGGER matters_set_updated_at BEFORE UPDATE ON app.matters
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
    CREATE TRIGGER matter_sections_set_updated_at BEFORE UPDATE ON app.matter_sections
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
    CREATE TRIGGER matter_documents_set_updated_at BEFORE UPDATE ON app.matter_documents
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

    REVOKE ALL ON TABLE app.matters, app.matter_sections, app.matter_documents,
      app.matter_status_history FROM PUBLIC;

    COMMENT ON TABLE app.matters IS 'Matter metadata and workflow; not a client directory';
    COMMENT ON COLUMN app.matters.matter_name IS 'Unique six-digit matter number stored as text, including leading zeros';
    COMMENT ON COLUMN app.matters.version IS 'Optimistic concurrency version; future services increment it on effective changes';
    COMMENT ON COLUMN app.matters.template_revision IS 'Template revision applied to this matter; synchronization is implemented in a later block';
    COMMENT ON TABLE app.matter_sections IS 'Per-matter section definitions; General is represented by a null document section';
    COMMENT ON TABLE app.matter_documents IS 'Per-matter requirement snapshots and delivery tracking; no file storage';
    COMMENT ON COLUMN app.matter_documents.tracking_updated_at IS 'Last tracking update, independent of definition changes and row updated_at';
    COMMENT ON COLUMN app.matter_documents.tracking_updated_by IS 'Null for system-initialized tracking; otherwise the authenticated internal user';
    COMMENT ON COLUMN app.matter_documents.previous_section_name IS 'Section label frozen when the requirement was retired';
    COMMENT ON TABLE app.matter_status_history IS 'Workflow events with technical reasons, not legal notes or document comments';
  `)
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE app.matter_status_history;
    DROP TABLE app.matter_documents;
    DROP TABLE app.matter_sections;
    DROP TABLE app.matters;
    ALTER TABLE app.template_documents DROP CONSTRAINT template_documents_type_id_unique;
  `)
}
