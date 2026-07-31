import { Navigate, createBrowserRouter } from 'react-router'
import AppLayout from '../layouts/AppLayout.jsx'
import MatterDetailPage from '../features/matters/pages/MatterDetailPage.jsx'
import MattersPage from '../features/matters/pages/MattersPage.jsx'
import NewMatterPage from '../features/matters/pages/NewMatterPage.jsx'
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
        path: 'admin/matter-types',
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Matter types"
            description="Manage the types of matters available to the firm."
          />
        ),
      },
      {
        path: 'admin/templates',
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Templates"
            description="Create and maintain document requirement templates."
          />
        ),
      },
      {
        path: 'admin/users',
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Users"
            description="Create and manage the internal users who can access the application."
          />
        ),
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
