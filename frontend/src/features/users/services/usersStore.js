import { ApiError } from '../../../api/apiClient.js'

export const USERS_PAGE_SIZE = 20

export function createUsersStore(api) {
  let snapshot = {
    list: { status: 'Idle', page: null, data: [], pagination: null, error: null },
    details: {},
    isMutating: false,
  }
  let active = true
  let epoch = 0
  let listVersion = 0
  let listRequest = null
  const detailVersions = new Map()
  const detailRequests = new Map()
  const listeners = new Set()

  function publish(changes) {
    if (!active) return
    snapshot = { ...snapshot, ...changes }
    listeners.forEach((listener) => listener())
  }
  function setDetail(id, value) {
    publish({ details: { ...snapshot.details, [id]: value } })
  }
  function invalidateList() {
    listVersion += 1
    listRequest = null
    publish({ list: { status: 'Idle', page: null, data: [], pagination: null, error: null } })
  }
  function invalidateDetail(id) {
    detailVersions.set(id, (detailVersions.get(id) ?? 0) + 1)
    detailRequests.delete(id)
  }
  function isCurrent(startEpoch) { return active && startEpoch === epoch }
  function workspaceClosedError() {
    return new ApiError('This workspace is no longer active. Sign in again.', { code: 'WORKSPACE_CLOSED' })
  }

  async function loadUsers(page = 1) {
    if (!active) return null
    if (listRequest?.page === page) return listRequest.promise
    const version = ++listVersion
    const startEpoch = epoch
    publish({ list: { status: 'Loading', page, data: [], pagination: null, error: null } })
    const promise = (async () => {
      try {
        const response = await api.request(`/users?page=${page}&limit=${USERS_PAGE_SIZE}`)
        if (isCurrent(startEpoch) && version === listVersion) {
          publish({ list: { status: 'Ready', page, data: response.data, pagination: response.pagination, error: null } })
        }
        return response
      } catch (error) {
        if (isCurrent(startEpoch) && version === listVersion) {
          publish({ list: { status: 'Error', page, data: [], pagination: null, error } })
        }
        return null
      } finally {
        if (isCurrent(startEpoch) && version === listVersion) listRequest = null
      }
    })()
    listRequest = { page, promise }
    return promise
  }

  async function loadUser(id) {
    if (!active) return null
    if (detailRequests.has(id)) return detailRequests.get(id)
    const version = (detailVersions.get(id) ?? 0) + 1
    detailVersions.set(id, version)
    const startEpoch = epoch
    setDetail(id, { status: 'Loading', data: null, error: null })
    const promise = (async () => {
      try {
        const response = await api.request(`/users/${encodeURIComponent(id)}`)
        if (isCurrent(startEpoch) && detailVersions.get(id) === version) {
          setDetail(id, { status: 'Ready', data: response.data, error: null })
        }
        return response.data
      } catch (error) {
        if (isCurrent(startEpoch) && detailVersions.get(id) === version) {
          setDetail(id, { status: 'Error', data: null, error })
        }
        return null
      } finally {
        if (isCurrent(startEpoch) && detailVersions.get(id) === version) detailRequests.delete(id)
      }
    })()
    detailRequests.set(id, promise)
    return promise
  }

  async function mutate(operation) {
    if (!active) throw workspaceClosedError()
    if (snapshot.isMutating) throw new ApiError('Another change is being saved. Please wait.', { code: 'SAVE_IN_PROGRESS' })
    const startEpoch = epoch
    publish({ isMutating: true })
    try { return await operation(startEpoch) } finally {
      if (isCurrent(startEpoch)) publish({ isMutating: false })
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    activate: () => { active = true },
    dispose: () => {
      active = false
      epoch += 1
      listRequest = null
      detailRequests.clear()
    },
    loadUsers, loadUser,
    createUser: (body) => mutate(async (startEpoch) => {
      const { fullName, username, password } = body
      const response = await api.request('/users', { method: 'POST', body: { fullName, username, password } })
      if (!isCurrent(startEpoch)) throw workspaceClosedError()
      invalidateList()
      invalidateDetail(response.data.id)
      setDetail(response.data.id, { status: 'Ready', data: response.data, error: null })
      return response.data
    }),
    resetPassword: (id, body) => mutate(async (startEpoch) => {
      const { administratorPassword, newPassword } = body
      await api.request(`/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: { administratorPassword, newPassword } })
      if (!isCurrent(startEpoch)) throw workspaceClosedError()
      invalidateList()
      invalidateDetail(id)
      // A 204 confirms the reset. A failed GET must never invite repeating it.
      await loadUser(id)
      if (!isCurrent(startEpoch)) throw workspaceClosedError()
      const resource = snapshot.details[id]
      if (resource?.status === 'Error') {
        setDetail(id, { ...resource, error: new ApiError(
          'The password was reset, but the updated account could not be loaded. Refresh the account to continue.',
          { code: 'SAVED_REFRESH_FAILED', status: resource.error.status },
        ) })
      }
    }),
  }
}
