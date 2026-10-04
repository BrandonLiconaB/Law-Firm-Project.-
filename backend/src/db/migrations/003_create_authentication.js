export function up(pgm) {
  pgm.sql(`
    CREATE TABLE app.auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      token_hash char(64) NOT NULL UNIQUE,
      csrf_token char(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at timestamptz NOT NULL,
      CONSTRAINT auth_sessions_token_hash_check
        CHECK (token_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT auth_sessions_csrf_token_check
        CHECK (csrf_token ~ '^[a-f0-9]{64}$'),
      CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at)
    );

    CREATE INDEX auth_sessions_user_id_idx ON app.auth_sessions(user_id);
    CREATE INDEX auth_sessions_expires_at_idx ON app.auth_sessions(expires_at);

    CREATE TABLE app.auth_login_limits (
      key_hash char(64) PRIMARY KEY,
      attempts integer NOT NULL,
      window_expires_at timestamptz NOT NULL,
      CONSTRAINT auth_login_limits_key_hash_check
        CHECK (key_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT auth_login_limits_attempts_check CHECK (attempts > 0)
    );

    CREATE INDEX auth_login_limits_expiry_idx
      ON app.auth_login_limits(window_expires_at);

    REVOKE ALL ON TABLE app.auth_sessions, app.auth_login_limits FROM PUBLIC;
    COMMENT ON TABLE app.auth_sessions
      IS 'Opaque login sessions; only the session token hash is stored';
    COMMENT ON TABLE app.auth_login_limits
      IS 'Temporary atomic login counters indexed by hashed keys';
  `)
}

export function down(pgm) {
  pgm.sql('DROP TABLE app.auth_login_limits; DROP TABLE app.auth_sessions;')
}
