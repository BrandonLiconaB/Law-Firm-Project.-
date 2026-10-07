import { Navigate, Outlet, createBrowserRouter } from 'react-router'
import AuthGate, { AdminGate, SessionBoundary } from '../features/auth/components/AuthGate.jsx'
import LoginPage from '../features/auth/pages/LoginPage.jsx'
import ChangePasswordPage from '../features/auth/pages/ChangePasswordPage.jsx'
import CatalogBoundary from '../features/catalog/CatalogBoundary.jsx'
import EditMatterTypePage from '../features/matterTypes/pages/EditMatterTypePage.jsx'
import MatterTypesPage from '../features/matterTypes/pages/MatterTypesPage.jsx'
import NewMatterTypePage from '../features/matterTypes/pages/NewMatterTypePage.jsx'
import EditTemplateDocumentPage from '../features/templates/pages/EditTemplateDocumentPage.jsx'
import NewTemplateDocumentPage from '../features/templates/pages/NewTemplateDocumentPage.jsx'
import TemplateDetailPage from '../features/templates/pages/TemplateDetailPage.jsx'
import TemplatesPage from '../features/templates/pages/TemplatesPage.jsx'
import UsersProvider from '../features/users/UsersProvider.jsx'
import UsersPage from '../features/users/pages/UsersPage.jsx'
import NewUserPage from '../features/users/pages/NewUserPage.jsx'
import UserDetailPage from '../features/users/pages/UserDetailPage.jsx'
import ResetUserPasswordPage from '../features/users/pages/ResetUserPasswordPage.jsx'
import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import ConnectionPendingPage from '../components/common/ConnectionPendingPage.jsx'

export const router = createBrowserRouter([
  {
    element: <SessionBoundary><Outlet /></SessionBoundary>,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/change-password', element: <ChangePasswordPage /> },
      {
        path: '/', element: <AuthGate />,
        children: [
          { index: true, element: <Navigate to="/admin/templates" replace /> },
          { path: 'matters/*', element: <ConnectionPendingPage section="Matters" /> },
          {
            element: <CatalogBoundary />,
            children: [
              { path: 'admin/matter-types', element: <MatterTypesPage /> },
              { path: 'admin/templates', element: <TemplatesPage /> },
              { path: 'admin/templates/:matterTypeId', element: <TemplateDetailPage /> },
              {
                element: <AdminGate />,
                children: [
                  { path: 'admin/matter-types/new', element: <NewMatterTypePage /> },
                  { path: 'admin/matter-types/:matterTypeId/edit', element: <EditMatterTypePage /> },
                  { path: 'admin/templates/:matterTypeId/documents/new', element: <NewTemplateDocumentPage /> },
                  { path: 'admin/templates/:matterTypeId/documents/:documentId/edit', element: <EditTemplateDocumentPage /> },
                ],
              },
            ],
          },
          { element: <AdminGate />, children: [{ element: <UsersProvider />, children: [
            { path: 'admin/users', element: <UsersPage /> },
            { path: 'admin/users/new', element: <NewUserPage /> },
            { path: 'admin/users/:userId', element: <UserDetailPage /> },
            { path: 'admin/users/:userId/reset-password', element: <ResetUserPasswordPage /> },
          ] }] },
          { path: '*', element: <PlaceholderPage eyebrow="404" title="Page not found"
            description="The page you requested does not exist." backTo="/admin/templates" backLabel="Back to templates" /> },
        ],
      },
    ],
  },
])
