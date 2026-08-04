import { Navigate, createBrowserRouter } from 'react-router'
import AppLayout from '../layouts/AppLayout.jsx'
import EditMatterTypePage from '../features/matterTypes/pages/EditMatterTypePage.jsx'
import MatterTypesPage from '../features/matterTypes/pages/MatterTypesPage.jsx'
import NewMatterTypePage from '../features/matterTypes/pages/NewMatterTypePage.jsx'
import EditMatterPage from '../features/matters/pages/EditMatterPage.jsx'
import MatterDetailPage from '../features/matters/pages/MatterDetailPage.jsx'
import MattersPage from '../features/matters/pages/MattersPage.jsx'
import NewMatterPage from '../features/matters/pages/NewMatterPage.jsx'
import EditTemplateDocumentPage from '../features/templates/pages/EditTemplateDocumentPage.jsx'
import NewTemplateDocumentPage from '../features/templates/pages/NewTemplateDocumentPage.jsx'
import TemplateDetailPage from '../features/templates/pages/TemplateDetailPage.jsx'
import TemplatesPage from '../features/templates/pages/TemplatesPage.jsx'
import EditUserPage from '../features/users/pages/EditUserPage.jsx'
import NewUserPage from '../features/users/pages/NewUserPage.jsx'
import UsersPage from '../features/users/pages/UsersPage.jsx'
import PlaceholderPage from '../components/common/PlaceholderPage.jsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/matters" replace />,
      },
      {
        path: 'matters',
        element: <MattersPage />,
      },
      {
        path: 'matters/new',
        element: <NewMatterPage />,
      },
      {
        path: 'matters/:matterId',
        element: <MatterDetailPage />,
      },
      {
        path: 'matters/:matterId/edit',
        element: <EditMatterPage />,
      },
      {
        path: 'admin/matter-types',
        element: <MatterTypesPage />,
      },
      {
        path: 'admin/matter-types/new',
        element: <NewMatterTypePage />,
      },
      {
        path: 'admin/matter-types/:matterTypeId/edit',
        element: <EditMatterTypePage />,
      },
      {
        path: 'admin/templates',
        element: <TemplatesPage />,
      },
      {
        path: 'admin/templates/:matterTypeId',
        element: <TemplateDetailPage />,
      },
      {
        path: 'admin/templates/:matterTypeId/documents/new',
        element: <NewTemplateDocumentPage />,
      },
      {
        path: 'admin/templates/:matterTypeId/documents/:documentId/edit',
        element: <EditTemplateDocumentPage />,
      },
      {
        path: 'admin/users',
        element: <UsersPage />,
      },
      {
        path: 'admin/users/new',
        element: <NewUserPage />,
      },
      {
        path: 'admin/users/:userId/edit',
        element: <EditUserPage />,
      },
      {
        path: '*',
        element: (
          <PlaceholderPage
            eyebrow="404"
            title="Page not found"
            description="The page you requested does not exist."
          />
        ),
      },
    ],
  },
])
