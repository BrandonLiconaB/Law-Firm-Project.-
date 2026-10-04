export function up(pgm) {
  pgm.sql(`
    ALTER TABLE app.users
      ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
    COMMENT ON COLUMN app.users.must_change_password
      IS 'Restricts temporary-password sessions until the user chooses a personal password';
    COMMENT ON TABLE app.auth_login_limits
      IS 'Temporary atomic counters for login and sensitive password operations';
  `)
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE app.users DROP COLUMN must_change_password;
    COMMENT ON TABLE app.auth_login_limits
      IS 'Temporary atomic login counters indexed by hashed keys';
  `)
}
