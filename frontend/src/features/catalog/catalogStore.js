import { ApiError } from '../../api/apiClient.js'

const sortTypes = (types) => [...types].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id))

export function createCatalogStore(api) {
  let snapshot = { status: 'Loading', matterTypes: [], templates: {}, error: null, isMutating: false }
  let active = true
  let catalogVersion = 0
  let writeVersion = 0
  const typeVersions = new Map()
  let catalogRequest = null
  const templateVersions = new Map()
  const templateRequests = new Map()
  const listeners = new Set()
  function publish(changes) {
    if (!active) return
    snapshot = { ...snapshot, ...changes }
    listeners.forEach((listener) => listener())
  }
  function upsertType(type) {
    typeVersions.set(type.id, ++writeVersion)
    publish({ matterTypes: sortTypes([...snapshot.matterTypes.filter((item) => item.id !== type.id), type]) })
  }
  function setTemplate(id, value) {
    publish({ templates: { ...snapshot.templates, [id]: value } })
  }
  function invalidateTemplate(id) {
    templateVersions.set(id, (templateVersions.get(id) ?? 0) + 1)
    templateRequests.delete(id)
  }
  async function loadCatalog() {
    if (catalogRequest) return catalogRequest
    const version = ++catalogVersion
    const initialWriteVersion = writeVersion
    publish({ status: 'Loading', error: null })
    catalogRequest = (async () => {
      try {
        let page = 1
        let totalPages = 1
        const types = new Map()
        do {
          const response = await api.request(`/matter-types?page=${page}&limit=100`)
          if (!active) return
          response.data.forEach((type) => types.set(type.id, type))
          totalPages = response.pagination.totalPages
          page += 1
        } while (page <= totalPages)
        if (version === catalogVersion) {
          snapshot.matterTypes.forEach((type) => {
            if ((typeVersions.get(type.id) ?? 0) > initialWriteVersion) types.set(type.id, type)
          })
          publish({ status: 'Ready', matterTypes: sortTypes([...types.values()]), error: null })
        }
      } catch (error) {
        if (version === catalogVersion) publish({ status: 'Error', error })
      } finally { catalogRequest = null }
    })()
    return catalogRequest
  }
  async function loadTemplate(id) {
    if (templateRequests.has(id)) return templateRequests.get(id)
    const version = (templateVersions.get(id) ?? 0) + 1
    templateVersions.set(id, version)
    setTemplate(id, { status: 'Loading', data: snapshot.templates[id]?.data ?? null, error: null })
    const request = (async () => {
      try {
        const response = await api.request(`/matter-types/${encodeURIComponent(id)}/template`)
        const { matterType, sections, documents } = response.data
        const template = { ...matterType, sections, documents }
        if (templateVersions.get(id) === version && active) {
          upsertType(matterType)
          setTemplate(id, { status: 'Ready', data: template, error: null })
        }
        return template
      } catch (error) {
        if (templateVersions.get(id) === version) setTemplate(id, { status: 'Error', data: null, error })
        throw error
      } finally {
        if (templateVersions.get(id) === version) templateRequests.delete(id)
      }
    })()
    templateRequests.set(id, request)
    return request
  }
  async function mutate(operation) {
    if (!active) throw new ApiError('This workspace is no longer active. Sign in again.', { code: 'WORKSPACE_CLOSED' })
    if (snapshot.isMutating) throw new ApiError('Another change is being saved. Please wait.', { code: 'SAVE_IN_PROGRESS' })
    publish({ isMutating: true })
    try { return await operation() } finally { publish({ isMutating: false }) }
  }
  async function mutateTemplate(typeId, path, method, body) {
    return mutate(async () => {
      const response = await api.request(`/matter-types/${encodeURIComponent(typeId)}/template${path}`, { method, body })
      if (!active) return response?.data ?? true
      invalidateTemplate(typeId)
      try { await loadTemplate(typeId) } catch {
        // The write was confirmed. A failed refresh must not invite repeating it.
        const failure = snapshot.templates[typeId]?.error
        if (failure) setTemplate(typeId, { status: 'Error', data: null, error: new ApiError(
          'Your change was saved, but the updated template could not be loaded. Refresh to continue.',
          { code: 'SAVED_REFRESH_FAILED', status: failure.status },
        ) })
      }
      return response?.data ?? true
    })
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    activate: () => { active = true },
    dispose: () => { active = false },
    loadCatalog, loadTemplate,
    createMatterType: (body) => mutate(async () => {
      const response = await api.request('/matter-types', { method: 'POST', body })
      upsertType(response.data)
      return response.data
    }),
    updateMatterType: (id, body) => mutate(async () => {
      const response = await api.request(`/matter-types/${encodeURIComponent(id)}`, { method: 'PATCH', body })
      upsertType(response.data)
      const cached = snapshot.templates[id]
      if (cached?.data) setTemplate(id, { ...cached, data: { ...cached.data, ...response.data } })
      return response.data
    }),
    createTemplateSection: (id, name) => mutateTemplate(id, '/sections', 'POST', { name }),
    updateTemplateSection: (id, sectionId, name) => mutateTemplate(id, `/sections/${encodeURIComponent(sectionId)}`, 'PATCH', { name }),
    deleteTemplateSection: (id, sectionId) => mutateTemplate(id, `/sections/${encodeURIComponent(sectionId)}`, 'DELETE'),
    moveTemplateSection: (id, sectionId, direction) => mutateTemplate(id, `/sections/${encodeURIComponent(sectionId)}/move`, 'POST', { direction }),
    createTemplateDocument: (id, body) => mutateTemplate(id, '/documents', 'POST', body),
    updateTemplateDocument: (id, documentId, body) => mutateTemplate(id, `/documents/${encodeURIComponent(documentId)}`, 'PATCH', body),
    deleteTemplateDocument: (id, documentId) => mutateTemplate(id, `/documents/${encodeURIComponent(documentId)}`, 'DELETE'),
    moveTemplateDocument: (id, documentId, direction) => mutateTemplate(id, `/documents/${encodeURIComponent(documentId)}/move`, 'POST', { direction }),
  }
}
