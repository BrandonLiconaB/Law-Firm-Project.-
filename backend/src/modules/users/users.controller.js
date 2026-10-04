import { createMemberUser, getUser, listUsers } from './users.service.js'
import { resetMemberPassword } from '../auth/password.service.js'

export function createUsersController(database) {
  return {
    create: async (req, res) => {
      const user = await createMemberUser(req.validated.body, database)
      res.location(`/api/users/${user.id}`).status(201).json({ data: user })
    },
    list: async (req, res) => {
      const result = await listUsers(req.validated.query, database)
      res.status(200).json(result)
    },
    getById: async (req, res) => {
      const user = await getUser(req.validated.params.id, database)
      res.status(200).json({ data: user })
    },
    resetPassword: async (req, res) => {
      await resetMemberPassword(
        req.auth,
        req.validated.params.id,
        req.validated.body,
        database,
      )
      req.log?.info(
        { actorId: req.auth.user.id, userId: req.validated.params.id },
        'Member password reset; user sessions revoked',
      )
      res.status(204).end()
    },
  }
}
