export function up(pgm) {
  pgm.sql(`
    CREATE TABLE app.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar(50) NOT NULL,
      full_name varchar(120) NOT NULL,
      password_hash text NOT NULL,
      system_role varchar(10) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT users_username_format_check CHECK (
        username = lower(username)
        AND username ~ '^[a-z0-9._-]{3,50}$'
      ),
      CONSTRAINT users_full_name_format_check CHECK (
        full_name = btrim(full_name)
        AND char_length(full_name) BETWEEN 2 AND 120
      ),
      CONSTRAINT users_password_hash_present_check CHECK (
        char_length(password_hash) BETWEEN 1 AND 512
      ),
      CONSTRAINT users_system_role_check CHECK (
        system_role IN ('ADMIN', 'MEMBER')
      )
    );

    CREATE UNIQUE INDEX users_username_unique_ci_idx
      ON app.users (lower(username));

    CREATE UNIQUE INDEX users_single_admin_idx
      ON app.users ((system_role))
      WHERE system_role = 'ADMIN';

    CREATE TRIGGER users_set_updated_at
      BEFORE UPDATE ON app.users
      FOR EACH ROW
      EXECUTE FUNCTION app.set_updated_at();

    REVOKE ALL ON TABLE app.users FROM PUBLIC;

    COMMENT ON TABLE app.users
      IS 'Internal users allowed to access Gestor documental';
    COMMENT ON COLUMN app.users.system_role
      IS 'Technical authorization role; it is not a firm job title';
  `)
}

export function down(pgm) {
  pgm.sql('DROP TABLE app.users;')
}
