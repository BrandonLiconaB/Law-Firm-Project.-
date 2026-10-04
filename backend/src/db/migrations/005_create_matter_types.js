export function up(pgm) {
  // Match the whitespace cleaned by JavaScript's trim and /\s+/.
  pgm.sql(String.raw`
    CREATE TABLE app.matter_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(120) NOT NULL,
      description text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT matter_types_name_format_check CHECK (
        char_length(name) BETWEEN 1 AND 120
        AND name = btrim(regexp_replace(
          name,
          U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
          ' ', 'g'
        ))
      ),
      CONSTRAINT matter_types_description_length_check CHECK (
        char_length(description) <= 1000
      )
    );

    CREATE UNIQUE INDEX matter_types_name_unique_ci_idx
      ON app.matter_types (lower(name));

    CREATE TRIGGER matter_types_set_updated_at
      BEFORE UPDATE ON app.matter_types
      FOR EACH ROW
      EXECUTE FUNCTION app.set_updated_at();

    REVOKE ALL ON TABLE app.matter_types FROM PUBLIC;

    COMMENT ON TABLE app.matter_types
      IS 'Matter type catalog; template requirements are managed separately';
  `)
}

export function down(pgm) {
  pgm.sql('DROP TABLE app.matter_types;')
}
