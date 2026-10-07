import { useNavigate, useParams } from 'react-router'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { useUser } from '../useUser.js'
import { useUsers } from '../useUsers.js'
import PasswordResetForm from '../components/PasswordResetForm.jsx'
import styles from './UserFormPage.module.css'

function ResetUserPasswordPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: administrator } = useAuth()
  const { user, status, error, retry } = useUser(userId)
  const { resetPassword, isMutating } = useUsers()
  if (error?.code === 'USER_NOT_FOUND') return <PlaceholderPage eyebrow="Users" title="User not found"
    description="The requested account could not be found." backTo="/admin/users" backLabel="Back to users" />
  if (status !== 'Ready') return <section className={styles.page}>
    <RequestFeedback loading={status === 'Loading'} message="Loading account…" error={error} onRetry={retry} />
    <ButtonLink to="/admin/users" variant="secondary">Back to users</ButtonLink>
  </section>
  if (user.systemRole !== 'MEMBER') return <PlaceholderPage eyebrow="Users" title="Reset unavailable"
    description="This operation is only available for internal user accounts. Use Change password to update your administrator password."
    backTo={`/admin/users/${user.id}`} backLabel="Back to account" />

  async function handleReset(credentials) {
    await resetPassword(user.id, credentials)
    navigate(`/admin/users/${user.id}`, { replace: true, state: {
      notice: 'Password reset. Existing sessions were revoked; a personal password is required on sign-in.',
    } })
  }
  return <section className={styles.page}>
    <PageHero eyebrow="Administration" title="Reset password" description="Assign a new temporary password to this internal user."
      contextLabel="Account" contextValue={`${user.fullName} · ${user.username}`} tone="teal" />
    <PasswordResetForm key={user.id} administratorUsername={administrator.username} cancelTo={`/admin/users/${user.id}`}
      onSubmit={handleReset} isBusy={isMutating} />
    <p className={styles.sessionNote}>Passwords cannot be viewed again after the reset.</p>
  </section>
}

export default ResetUserPasswordPage
