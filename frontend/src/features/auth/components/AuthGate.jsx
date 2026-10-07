import { Navigate, Outlet, useLocation } from 'react-router'
import AppDataProvider from '../../../app/providers/AppDataProvider.jsx'
import AppLayout from '../../../layouts/AppLayout.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import { useAuth } from '../useAuth.js'
import styles from '../pages/AuthPage.module.css'

export function SessionBoundary({ children }) {
  const { status, error, session } = useAuth()
  if (status === 'Checking' || status === 'Unavailable') {
    return <div className={styles.page}><div className={styles.card}>
      <p className={styles.brand}>Gestor documental</p>
      <RequestFeedback loading={status === 'Checking'} message="Checking your session…" error={error} onRetry={() => session.restore()} />
    </div></div>
  }
  return children
}

function AuthGate() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  return <AppDataProvider key={user.id}><AppLayout /></AppDataProvider>
}

export function AdminGate() {
  const { user } = useAuth()
  return user?.systemRole === 'ADMIN' ? <Outlet /> : (
    <PlaceholderPage eyebrow="Access restricted" title="Administrator access required"
      description="Only the administrator can manage users and change catalog configuration."
      backTo="/admin/templates" backLabel="Back to templates" />
  )
}

export default AuthGate
