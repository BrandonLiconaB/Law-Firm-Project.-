import { createApiClient } from '../../../api/apiClient.js'

// Tokens stay in this closure, never in localStorage or the public React context.
export function createAuthSession(options = {}) {
  let snapshot = { status: 'Checking', user: null, error: null, notice: '' }
  let csrfToken = null
  let version = 0
  let restoring = null
  let expiryTimer = null
  const now = options.now ?? Date.now
  const schedule = options.setTimeoutImpl ?? globalThis.setTimeout
  const cancel = options.clearTimeoutImpl ?? globalThis.clearTimeout
  const listeners = new Set()
  const publish = (next) => { snapshot = next; listeners.forEach((listener) => listener()) }
  const clear = (notice = '') => {
    cancel(expiryTimer)
    expiryTimer = null
    version += 1
    csrfToken = null
    publish({ status: 'Anonymous', user: null, error: null, notice })
  }
  const api = createApiClient({
    ...options, getCsrfToken: () => csrfToken, getSessionVersion: () => version,
    onUnauthorized: (requestVersion) => {
      if (requestVersion === version) clear(snapshot.user ? 'Your session ended. Sign in again.' : '')
    },
    onPasswordRequired: (requestVersion) => {
      if (requestVersion === version && snapshot.user) {
        publish({ ...snapshot, user: { ...snapshot.user, mustChangePassword: true } })
      }
    },
  })
  function accept(data, operationVersion) {
    if (version !== operationVersion) return
    csrfToken = data.csrfToken
    publish({ status: 'Authenticated', user: data.user, error: null, notice: '' })
    cancel(expiryTimer)
    const remaining = Date.parse(data.expiresAt) - now()
    if (Number.isFinite(remaining)) {
      expiryTimer = schedule(() => {
        if (version === operationVersion) clear('Your session ended. Sign in again.')
      }, Math.max(0, Math.min(remaining, 2147483647)))
      expiryTimer?.unref?.()
    }
  }
  return {
    api,
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    restore() {
      if (restoring) return restoring
      const operationVersion = ++version
      publish({ status: 'Checking', user: null, error: null, notice: '' })
      restoring = api.request('/auth/me')
        .then((response) => accept(response.data, operationVersion))
        .catch((error) => {
          if (version !== operationVersion) return
          if (error.status === 401) clear()
          else publish({ status: 'Unavailable', user: null, error, notice: '' })
        })
        .finally(() => { restoring = null })
      return restoring
    },
    async login(credentials) {
      const operationVersion = ++version
      const response = await api.request('/auth/login', { method: 'POST', body: credentials })
      accept(response.data, operationVersion)
    },
    async logout() {
      const operationVersion = version
      try { await api.request('/auth/logout', { method: 'POST' }) } catch (error) {
        if (error.status !== 401) throw error
      }
      if (operationVersion === version) clear()
    },
    async changePassword(credentials) {
      const operationVersion = version
      await api.request('/auth/change-password', { method: 'POST', body: credentials })
      if (operationVersion === version) clear('Password changed. Sign in with your new password.')
    },
  }
}
