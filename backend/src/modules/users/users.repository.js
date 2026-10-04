import { USER_ROLES } from './user.constants.js'

const PUBLIC_USER_COLUMNS = `
  id, username, full_name AS "fullName", system_role AS "systemRole",
  created_at AS "createdAt", updated_at AS "updatedAt",
  must_change_password AS "mustChangePassword"
`

export async function findAdministrator(database) {
  const result = await database.query(
    `
      SELECT id, username
      FROM app.users
      WHERE system_role = $1
      LIMIT 1
    `,
    [USER_ROLES.ADMIN],
  )

  return result.rows[0] ?? null
}

export async function insertUser(database, user) {
  const result = await database.query(
    `
      INSERT INTO app.users (
        username,
        full_name,
        password_hash,
        system_role,
        must_change_password
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        username,
        full_name AS "fullName",
        system_role AS "systemRole",
        must_change_password AS "mustChangePassword",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [
      user.username,
      user.fullName,
      user.passwordHash,
      user.systemRole,
      user.mustChangePassword ?? false,
    ],
  )

  return result.rows[0]
}

export async function findUserById(database, id) {
  const result = await database.query(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM app.users WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function findUsersPage(database, { limit, offset }) {
  // LEFT JOIN keeps the total available even when the requested page is empty.
  const result = await database.query(
    `WITH total_users AS (
       SELECT count(*)::integer AS total FROM app.users
     )
     SELECT total_users.total, page_users.*
     FROM total_users
     LEFT JOIN LATERAL (
       SELECT ${PUBLIC_USER_COLUMNS}
       FROM app.users
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2
     ) AS page_users ON true
     ORDER BY page_users."createdAt" DESC, page_users.id DESC`,
    [limit, offset],
  )

  return {
    total: result.rows[0].total,
    users: result.rows.filter((row) => row.id).map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.fullName,
      systemRole: row.systemRole,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  }
}
