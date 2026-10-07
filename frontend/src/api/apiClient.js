export class ApiError extends Error {
  constructor(message, { code = 'REQUEST_FAILED', status = 0, fields = {}, retryAfter = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = fields
    this.retryAfter = retryAfter
  }
}

export function createApiClient({
  baseUrl = '/api', fetchImpl = globalThis.fetch,
  getCsrfToken = () => null, getSessionVersion = () => 0,
  onUnauthorized = () => {}, onPasswordRequired = () => {},
} = {}) {
  const base = baseUrl.replace(/\/+$/, '')
  return {
    async request(path, { method = 'GET', body, signal } = {}) {
      const version = getSessionVersion()
      const headers = { Accept: 'application/json' }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      const token = getCsrfToken()
      if (!['GET', 'HEAD'].includes(method) && token && path !== '/auth/login') {
        headers['X-CSRF-Token'] = token
      }
      let response
      try {
        response = await fetchImpl(`${base}${path}`, {
          method, headers, credentials: 'include', signal,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
      } catch (error) {
        if (error.name === 'AbortError') throw error
        throw new ApiError('Cannot reach the server. Check your connection and try again.', { code: 'NETWORK_ERROR' })
      }
      if (response.status === 401 && path !== '/auth/login') onUnauthorized(version)
      let payload = null
      if (response.status !== 204) {
        try { payload = await response.json() } catch {
          throw new ApiError('The server returned an unexpected response.', { code: 'INVALID_RESPONSE', status: response.status })
        }
      }
      if (!response.ok) {
        const error = new ApiError(payload?.error?.message ?? 'The request could not be completed.', {
          code: payload?.error?.code, status: response.status,
          fields: payload?.error?.fields ?? {}, retryAfter: response.headers.get('Retry-After'),
        })
        if (error.code === 'PASSWORD_CHANGE_REQUIRED') onPasswordRequired(version)
        throw error
      }
      return payload
    },
  }
}
