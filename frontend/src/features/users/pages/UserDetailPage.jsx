import { useLocation, useParams } from 'react-router'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import { useUser } from '../useUser.js'
import styles from './UserFormPage.module.css'

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function UserDetailPage() {
  const { userId } = useParams()
  const location = useLocation()
  const { user, status, error, retry } = useUser(userId)
  if (error?.code === 'USER_NOT_FOUND') return <PlaceholderPage eyebrow="Users" title="User not found"
    description="The requested account could not be found." backTo="/admin/users" backLabel="Back to users" />
  if (status !== 'Ready') return <section className={styles.page}>
    {location.state?.notice && <p className={styles.notice} role="status">{location.state.notice}</p>}
    <RequestFeedback loading={status === 'Loading'} message="Loading account…" error={error} onRetry={retry} />
    <ButtonLink to="/admin/users" variant="secondary">Back to users</ButtonLink>
  </section>
  const isAdministrator = user.systemRole === 'ADMIN'
  return <section className={styles.page}>
    {location.state?.notice && <p className={styles.notice} role="status">{location.state.notice}</p>}
    <PageHero eyebrow="Administration" title={user.fullName} description={`Username: ${user.username}`}
      contextLabel="Account" contextValue={isAdministrator ? 'Administrator' : 'Internal user'} tone="teal"
      action={<ButtonLink to="/admin/users" variant="secondary">Back to users</ButtonLink>} />
    <article className={styles.details}>
      <h2>Account information</h2>
      <dl>
        <div><dt>Full name</dt><dd>{user.fullName}</dd></div>
        <div><dt>Username</dt><dd>{user.username}</dd></div>
        <div><dt>Password setup</dt><dd>{user.mustChangePassword ? 'Personal password required' : 'Personal password set'}</dd></div>
        <div><dt>Created</dt><dd><time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time></dd></div>
        <div><dt>Last updated</dt><dd><time dateTime={user.updatedAt}>{formatDate(user.updatedAt)}</time></dd></div>
      </dl>
      {isAdministrator ? <p className={styles.accountNote}>Use Change password in your account menu to update your own password. Administrator password resets are not available here.</p>
        : <div className={styles.resetAction}><p>Resetting a password revokes this user's sessions and requires a new personal password on sign-in.</p>
          <ButtonLink to={`/admin/users/${user.id}/reset-password`}>Reset password</ButtonLink></div>}
    </article>
  </section>
}

export default UserDetailPage
