const CREDENTIAL_COLUMNS = `
  id, username, full_name AS "fullName", system_role AS "systemRole",
  password_hash AS "passwordHash", must_change_password AS "mustChangePassword"
`

// These locks must remain on a transaction client until the operation commits.
export async function lockUserCredentials(client, id, { shared = false } = {}) {
  const result = await client.query(
    `SELECT ${CREDENTIAL_COLUMNS} FROM app.users WHERE id = $1
     ${shared ? 'FOR SHARE' : 'FOR UPDATE'}`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function lockAdministratorForRecovery(client, username) {
  const result = await client.query(
    `SELECT ${CREDENTIAL_COLUMNS} FROM app.users
     WHERE username = $1 AND system_role = 'ADMIN' FOR UPDATE`,
    [username],
  )
  return result.rows[0] ?? null
}

export async function sessionIsActive(client, sessionId, userId) {
  const result = await client.query(
    `SELECT id FROM app.auth_sessions
     WHERE id = $1 AND user_id = $2 AND expires_at > clock_timestamp()`,
    [sessionId, userId],
  )
  return result.rowCount === 1
}

export async function updatePasswordAndRevokeSessions(
  client,
  userId,
  passwordHash,
  mustChangePassword,
) {
  await client.query(
    `UPDATE app.users SET password_hash = $2, must_change_password = $3
     WHERE id = $1`,
    [userId, passwordHash, mustChangePassword],
  )
  await client.query('DELETE FROM app.auth_sessions WHERE user_id = $1', [userId])
}
