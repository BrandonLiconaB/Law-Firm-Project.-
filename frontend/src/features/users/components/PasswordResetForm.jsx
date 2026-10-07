import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import UserFormField from './UserFormField.jsx'
import { getUserFieldErrors, validatePasswordReset } from '../utils/userValidation.js'
import styles from './UserForm.module.css'

function PasswordResetForm({ administratorUsername, cancelTo, onSubmit, isBusy = false }) {
  const [administratorPassword, setAdministratorPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState({})
  const action = useAsyncAction()
  const fields = getUserFieldErrors(action.error, errors, { reset: true })
  const disabled = action.isPending || isBusy

  function update(field, setter, value) {
    setter(value)
    action.clearError()
    setErrors((current) => { const next = { ...current }; delete next[field]; return next })
  }
  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled) return
    const nextErrors = validatePasswordReset({ administratorPassword, password, confirmation })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    await action.run(async () => {
      try { await onSubmit({ administratorPassword, newPassword: password }) }
      finally { setAdministratorPassword(''); setPassword(''); setConfirmation('') }
    })
  }
  return <form className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={disabled}>
    <RequestFeedback error={action.error} />
    <input type="text" autoComplete="username" value={administratorUsername} readOnly hidden />
    <UserFormField id="reset-admin-password" label="Your administrator password" type="password" autoComplete="current-password" required maxLength={128}
      value={administratorPassword} disabled={disabled} error={fields.administratorPassword}
      help="Enter your current password to authorize this reset."
      onChange={(event) => update('administratorPassword', setAdministratorPassword, event.target.value)} />
    <UserFormField id="reset-new-password" label="New temporary password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
      value={password} disabled={disabled} error={fields.password} help="Use 12–128 characters and a password different from the user's current one."
      onChange={(event) => update('password', setPassword, event.target.value)} />
    <UserFormField id="reset-confirm-password" label="Confirm temporary password" type="password" autoComplete="new-password" required maxLength={128}
      value={confirmation} disabled={disabled} error={fields.confirmation}
      onChange={(event) => update('confirmation', setConfirmation, event.target.value)} />
    <div className={styles.accessNotice}><strong>Existing sessions will be revoked</strong>
      <p>The user must sign in again and choose a personal password before returning to the workspace. Share the temporary password privately; no email is sent.</p></div>
    <div className={styles.actions}>
      <Button type="submit" disabled={disabled}>{action.isPending ? 'Resetting…' : 'Reset password'}</Button>
      <ButtonLink to={cancelTo} variant="secondary" disabled={disabled}>Cancel</ButtonLink>
    </div>
  </form>
}

export default PasswordResetForm
