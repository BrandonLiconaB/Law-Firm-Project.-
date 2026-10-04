import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from './auth.cookies.js'
import { deleteSession } from './auth.repository.js'
import { login } from './auth.service.js'

function sessionResponse(session) {
  return {
    data: {
      user: session.user,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    },
  }
}

export function createAuthController(database) {
  return {
    login: async (req, res) => {
      const session = await login(
        database,
        req.loginCredentials,
        readSessionToken(req),
      )
      setSessionCookie(res, session.token, session.expiresAt)
      res.status(200).json(sessionResponse(session))
    },
    me: (req, res) => res.status(200).json(sessionResponse(req.auth)),
    logout: async (req, res) => {
      await deleteSession(database, req.auth.sessionId)
      clearSessionCookie(res)
      res.status(204).end()
    },
  }
}
