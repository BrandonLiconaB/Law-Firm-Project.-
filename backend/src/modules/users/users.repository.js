import { USER_ROLES } from './user.constants.js'

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
        system_role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        username,
        full_name AS "fullName",
        system_role AS "systemRole",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [user.username, user.fullName, user.passwordHash, user.systemRole],
  )

  return result.rows[0]
}
