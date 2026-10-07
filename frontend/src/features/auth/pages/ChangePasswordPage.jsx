import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import Button from '../../../components/ui/Button.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import { useAuth } from '../useAuth.js'
import styles from './AuthPage.module.css'

function ChangePasswordPage() {
  const { user, session } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validation, setValidation] = useState('')
  const action = useAsyncAction()
  if (!user) return <Navigate to="/login" replace />
  async function handleSubmit(event) {
    event.preventDefault()
    if (newPassword.length < 12 || newPassword.length > 128) { setValidation('Use between 12 and 128 characters.'); return }
    if (newPassword !== confirmation) { setValidation('The new passwords do not match.'); return }
    setValidation('')
    await action.run(async () => {
      try { await session.changePassword({ currentPassword, newPassword }) } finally {
        setCurrentPassword(''); setNewPassword(''); setConfirmation('')
      }
    })
  }
  return <div className={styles.page}><section className={styles.card}>
    <p className={styles.brand}>Gestor documental</p>
    <h1>Change password</h1>
    <p className={styles.description}>{user.mustChangePassword
      ? 'Choose your personal password before accessing the workspace.'
      : 'Changing your password signs you out on all devices.'}</p>
    <RequestFeedback error={action.error || (validation ? { message: validation } : null)} />
    <form className={styles.form} onSubmit={handleSubmit} aria-busy={action.isPending}>
      <input type="text" autoComplete="username" value={user.username} readOnly hidden />
      <label className={styles.field} htmlFor="current-password">Current password
        <input id="current-password" type="password" autoComplete="current-password" required maxLength={128}
          value={currentPassword} disabled={action.isPending} onChange={(event) => setCurrentPassword(event.target.value)} />
      </label>
      <label className={styles.field} htmlFor="new-password">New password
        <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={newPassword} disabled={action.isPending} onChange={(event) => setNewPassword(event.target.value)} />
      </label>
      <label className={styles.field} htmlFor="confirm-password">Confirm new password
        <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={confirmation} disabled={action.isPending} onChange={(event) => setConfirmation(event.target.value)} />
      </label>
      <Button type="submit" disabled={action.isPending}>{action.isPending ? 'Saving…' : 'Save password'}</Button>
    </form>
    {user.mustChangePassword
      ? <button className={styles.secondary} disabled={action.isPending} onClick={() => action.run(() => session.logout())}>Sign out</button>
      : <Link className={styles.secondary} to="/admin/templates">Back to workspace</Link>}
  </section></div>
}

export default ChangePasswordPage
