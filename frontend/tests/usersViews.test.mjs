import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let vite
let AuthContext
let UsersContext
let UsersPage
let UserDetailPage
let NewUserPage
let ResetUserPasswordPage
let AdminGate
const user = { id: 'user-1', fullName: 'Team User', username: 'team.user', systemRole: 'MEMBER', mustChangePassword: true,
  createdAt: '2026-10-06T15:00:00.000Z', updatedAt: '2026-10-06T15:00:00.000Z' }
const admin = { ...user, id: 'admin', fullName: 'QA Administrator', username: 'qa.admin', systemRole: 'ADMIN', mustChangePassword: false }
const data = { list: { status: 'Ready', page: 1, data: [user, admin], pagination: { page: 1, total: 22, totalPages: 2 }, error: null },
  details: { [user.id]: { status: 'Ready', data: user }, [admin.id]: { status: 'Ready', data: admin } },
  loadUsers: async () => {}, loadUser: async () => {}, createUser: async () => {}, resetPassword: async () => {} }

before(async () => {
  vite = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } })
  AuthContext = (await vite.ssrLoadModule('/src/features/auth/AuthContext.js')).AuthContext
  UsersContext = (await vite.ssrLoadModule('/src/features/users/UsersContext.js')).UsersContext
  UsersPage = (await vite.ssrLoadModule('/src/features/users/pages/UsersPage.jsx')).default
  UserDetailPage = (await vite.ssrLoadModule('/src/features/users/pages/UserDetailPage.jsx')).default
  NewUserPage = (await vite.ssrLoadModule('/src/features/users/pages/NewUserPage.jsx')).default
  ResetUserPasswordPage = (await vite.ssrLoadModule('/src/features/users/pages/ResetUserPasswordPage.jsx')).default
  AdminGate = (await vite.ssrLoadModule('/src/features/auth/components/AuthGate.jsx')).AdminGate
})
after(async () => { await vite?.close() })

function render(component, { path = `/admin/users/${user.id}`, resource = data, identity = admin, guarded = false, notice } = {}) {
  const route = h(Route, { path: '/admin/users/:userId/*', element: h(component) })
  const other = h(Route, { path: '*', element: h(component) })
  return renderToStaticMarkup(h(AuthContext.Provider, { value: { user: identity, session: {} } },
    h(UsersContext.Provider, { value: resource }, h(MemoryRouter, { initialEntries: [{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state: notice ? { notice } : null }] },
      h(Routes, null, h(Route, { element: guarded ? h(AdminGate) : h(Outlet) }, route, other))))))
}

test('user directory displays real usernames, password setup and server pagination without email editing', () => {
  const html = render(UsersPage, { path: '/admin/users' })
  assert.match(html, /team.user/)
  assert.match(html, /22 accounts/)
  assert.match(html, /Personal password required/)
  assert.match(html, /Page 1 of 2/)
  assert.match(html, /Previous<\/button>/)
  assert.doesNotMatch(html, /Email|Preview|>Edit<|email address|Search/)
})

test('creation form only asks for name, username and confirmed temporary password', () => {
  const html = render(NewUserPage, { path: '/admin/users/new' })
  assert.match(html, /Full name/)
  assert.match(html, /Username/)
  assert.match(html, /Confirm temporary password/)
  assert.match(html, /type="password"/)
  assert.doesNotMatch(html, /type="email"|<select|Active|Inactive|Role/)
})

test('MEMBER detail has reset but no identity edit or stored credential', () => {
  const html = render(UserDetailPage)
  assert.match(html, /\/admin\/users\/user-1\/reset-password/)
  assert.match(html, /Personal password required/)
  assert.match(html, /Last updated/)
  assert.doesNotMatch(html, /Edit user|passwordHash|type="password"/)
})

test('ADMIN detail and direct reset URL never offer administrator reset', () => {
  const html = render(UserDetailPage, { path: '/admin/users/admin' })
  assert.match(html, /Use Change password/)
  assert.doesNotMatch(html, /href="\/admin\/users\/admin\/reset-password"/)
  const reset = render(ResetUserPasswordPage, { path: '/admin/users/admin/reset-password' })
  assert.match(reset, /Reset unavailable/)
  assert.doesNotMatch(reset, /type="password"/)
})

test('reset form explicitly requires administrator authorization and explains session revocation', () => {
  const html = render(ResetUserPasswordPage, { path: '/admin/users/user-1/reset-password' })
  assert.match(html, /Your administrator password/)
  assert.match(html, /New temporary password/)
  assert.match(html, /Existing sessions will be revoked/)
  assert.match(html, /no email is sent/)
})

test('MEMBER direct navigation is restricted before user management content can render', () => {
  const html = render(UsersPage, { path: '/admin/users', identity: user, guarded: true })
  assert.match(html, /Administrator access required/)
  assert.doesNotMatch(html, /New user|team.user|Full name/)
})

test('loading and errors do not expose cached rows from a different page', () => {
  const html = render(UsersPage, { path: '/admin/users?page=2' })
  assert.match(html, /Loading accounts/)
  assert.doesNotMatch(html, /team.user|qa.admin|22 accounts/)
  const error = render(UsersPage, { path: '/admin/users', resource: { ...data, list: { ...data.list, status: 'Error', error: { message: 'Offline' } } } })
  assert.match(error, /Offline|Try again/)
  assert.doesNotMatch(error, /team.user/)
})

test('a confirmed reset notice stays visible even when the account refresh fails', () => {
  const html = render(UserDetailPage, { notice: 'Password reset. Existing sessions were revoked.', resource: {
    ...data, details: { [user.id]: { status: 'Error', error: { message: 'Offline' } } },
  } })
  assert.match(html, /Password reset. Existing sessions were revoked/)
  assert.match(html, /Offline/)
  assert.doesNotMatch(html, /Reset password<\/a>/)
})
