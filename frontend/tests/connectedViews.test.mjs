import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let vite
let AuthContext
let AppDataContext
let TemplateDetailPage
let MatterTypesPage
let AppLayout
let ChangePasswordPage
const type = { id: 'type', name: 'Family', description: '', documentCount: 1, keyDocumentCount: 1, templateStatus: 'Ready', sections: [{ id: 'section', name: 'Petitioner' }], documents: [{ id: 'doc', name: 'Petitioner passport', isKey: true, expectedQuantity: 10, description: '', sectionId: 'section' }] }
const data = { status: 'Ready', matterTypes: [type], templates: { type: { status: 'Ready', data: type } }, loadTemplate: async () => type }
const identity = (systemRole = 'MEMBER', extra = {}) => ({ user: { id: 'user', username: 'qa.user', fullName: 'QA User', systemRole, mustChangePassword: false, ...extra }, session: {} })

before(async () => {
  vite = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } })
  AuthContext = (await vite.ssrLoadModule('/src/features/auth/AuthContext.js')).AuthContext
  AppDataContext = (await vite.ssrLoadModule('/src/app/providers/AppDataContext.js')).AppDataContext
  TemplateDetailPage = (await vite.ssrLoadModule('/src/features/templates/pages/TemplateDetailPage.jsx')).default
  MatterTypesPage = (await vite.ssrLoadModule('/src/features/matterTypes/pages/MatterTypesPage.jsx')).default
  AppLayout = (await vite.ssrLoadModule('/src/layouts/AppLayout.jsx')).default
  ChangePasswordPage = (await vite.ssrLoadModule('/src/features/auth/pages/ChangePasswordPage.jsx')).default
})
after(async () => { await vite?.close() })

function render(component, auth = identity(), path = '/admin/templates/type') {
  return renderToStaticMarkup(h(AuthContext.Provider, { value: auth }, h(AppDataContext.Provider, { value: data },
    h(MemoryRouter, { initialEntries: [path] }, h(Routes, null, h(Route, { path: '/admin/templates/:matterTypeId', element: h(component) }),
      h(Route, { path: '*', element: h(component) }))))))
}

test('MEMBER template views include definitions but no write actions', () => {
  const html = render(TemplateDetailPage)
  assert.match(html, /Petitioner passport/)
  assert.match(html, /Expected: 10/)
  assert.doesNotMatch(html, /Add section|Add document|Rename|Delete|>Edit</)
})

test('ADMIN template views expose actions without claiming matter synchronization is live', () => {
  const html = render(TemplateDetailPage, identity('ADMIN'))
  assert.match(html, /Add section/)
  assert.match(html, /Add document/)
  assert.match(html, /Matter tracking will be connected later/)
  assert.doesNotMatch(html, /Existing matters were synchronized/)
})

test('catalog summaries work without loading documents and hide administrative edit links for MEMBER', () => {
  const original = data.matterTypes
  data.matterTypes = [{ id: 'type', name: 'Family', documentCount: 7, keyDocumentCount: 2, templateStatus: 'Ready' }]
  try {
    const html = render(MatterTypesPage, identity(), '/admin/matter-types')
    assert.match(html, /<td>7<\/td>/)
    assert.match(html, /<td>2<\/td>/)
    assert.doesNotMatch(html, /New matter type|Edit type/)
  } finally { data.matterTypes = original }
})

test('the mobile hidden sidebar is inert and the account shows a real identity rather than a mock email', () => {
  const previous = globalThis.window
  globalThis.window = { matchMedia: () => ({ matches: true }) }
  try {
    const html = render(AppLayout, identity(), '/admin/templates')
    assert.match(html, /inert=""/)
    assert.match(html, /QA User/)
    assert.match(html, /qa.user/)
    assert.doesNotMatch(html, /admin@example.com|>Users</)
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
})

test('temporary password screen requires replacement without offering a workspace bypass', () => {
  const html = render(ChangePasswordPage, identity('MEMBER', { mustChangePassword: true }), '/change-password')
  assert.match(html, /Choose your personal password/)
  assert.match(html, /Current password/)
  assert.match(html, /Confirm new password/)
  assert.doesNotMatch(html, /Back to workspace/)
})
