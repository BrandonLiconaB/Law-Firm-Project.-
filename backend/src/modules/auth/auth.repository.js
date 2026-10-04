export async function findLoginUser(database, username) {
  const result = await database.query(
    `SELECT id, username, full_name AS "fullName",
            system_role AS "systemRole", password_hash AS "passwordHash"
     FROM app.users WHERE username = $1`,
    [username],
  )
  return result.rows[0] ?? null
}

export async function insertSession(database, session) {
  const result = await database.query(
    `INSERT INTO app.auth_sessions (user_id, token_hash, csrf_token, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + $4::integer * INTERVAL '1 hour')
     RETURNING id, expires_at AS "expiresAt"`,
    [session.userId, session.tokenHash, session.csrfToken, session.ttlHours],
  )
  return result.rows[0]
}

export async function findSession(database, tokenHash) {
  const result = await database.query(
    `SELECT s.id AS "sessionId", s.csrf_token AS "csrfToken",
            s.expires_at AS "expiresAt", u.id, u.username,
            u.full_name AS "fullName", u.system_role AS "systemRole"
     FROM app.auth_sessions s
     JOIN app.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
    [tokenHash],
  )
  return result.rows[0] ?? null
}

export async function deleteSessionByToken(database, tokenHash) {
  await database.query('DELETE FROM app.auth_sessions WHERE token_hash = $1', [
    tokenHash,
  ])
}

export async function deleteSession(database, sessionId) {
  await database.query('DELETE FROM app.auth_sessions WHERE id = $1', [sessionId])
}

export async function consumeLoginAttempt(database, keyHash, limit, windowSeconds) {
  const result = await database.query(
    `INSERT INTO app.auth_login_limits AS current_limit
       (key_hash, attempts, window_expires_at)
     VALUES ($1, 1, statement_timestamp() + $3::integer * INTERVAL '1 second')
     ON CONFLICT (key_hash) DO UPDATE SET
       attempts = CASE
         WHEN current_limit.window_expires_at <= statement_timestamp() THEN 1
         ELSE LEAST(current_limit.attempts + 1, $2::integer + 1)
       END,
       window_expires_at = CASE
         WHEN current_limit.window_expires_at <= statement_timestamp()
           THEN statement_timestamp() + $3::integer * INTERVAL '1 second'
         ELSE current_limit.window_expires_at
       END
     RETURNING attempts,
       GREATEST(1, CEIL(EXTRACT(EPOCH FROM
         (window_expires_at - statement_timestamp()))))::integer AS "retryAfter"`,
    [keyHash, limit, windowSeconds],
  )
  return result.rows[0]
}

export async function deleteExpiredAuthenticationData(database) {
  const sessions = await database.query(
    'DELETE FROM app.auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP',
  )
  const limits = await database.query(
    'DELETE FROM app.auth_login_limits WHERE window_expires_at <= CURRENT_TIMESTAMP',
  )
  return { sessions: sessions.rowCount, loginLimits: limits.rowCount }
}
