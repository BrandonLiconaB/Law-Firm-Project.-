import { Navigate, createBrowserRouter } from 'react-router'
import AppLayout from '../layouts/AppLayout.jsx'
import MattersPage from '../features/matters/pages/MattersPage.jsx'
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
        element: (
          <PlaceholderPage
            eyebrow="Matters"
            title="Create a new matter"
            description="The matter creation form will be built in the next product phase."
          />
        ),
      },
      {
        path: 'matters/:matterId',
        element: (
          <PlaceholderPage
            eyebrow="Matter details"
            title="Document checklist"
            description="This page will contain the matter status and its complete document checklist."
          />
        ),
      },
      {
        path: 'clients',
        element: (
          <PlaceholderPage
            eyebrow="Workspace"
            title="Clients"
            description="Client search, creation, and matter associations will live here."
          />
        ),
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
