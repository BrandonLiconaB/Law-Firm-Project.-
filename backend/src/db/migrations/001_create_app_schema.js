export function up(pgm) {
  pgm.createSchema('app')
  pgm.sql('REVOKE ALL ON SCHEMA app FROM PUBLIC;')
  pgm.sql(
    "COMMENT ON SCHEMA app IS 'Private application data for Gestor documental';",
  )

  pgm.sql(`
    CREATE FUNCTION app.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$;
  `)

  pgm.sql(`
    COMMENT ON FUNCTION app.set_updated_at()
    IS 'Sets updated_at whenever a row is updated';
  `)
}

export function down(pgm) {
  pgm.dropSchema('app', { cascade: true, ifExists: true })
}
