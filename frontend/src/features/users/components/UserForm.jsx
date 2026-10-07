import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import UserFormField from './UserFormField.jsx'
import { getUserFieldErrors, normalizeUsername, validateNewUser } from '../utils/userValidation.js'
import styles from './UserForm.module.css'

function UserForm({ onSubmit, isBusy = false }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState({})
  const action = useAsyncAction()
  const fields = getUserFieldErrors(action.error, errors)
  const disabled = action.isPending || isBusy

  function update(field, setter, value) {
    setter(value)
    action.clearError()
    setErrors((current) => { const next = { ...current }; delete next[field]; return next })
  }
  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled) return
    const nextErrors = validateNewUser({ fullName, username, password, confirmation })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    await action.run(async () => {
      try { await onSubmit({ fullName: fullName.trim(), username: normalizeUsername(username), password }) }
      finally { setPassword(''); setConfirmation('') }
    })
  }
  return <form className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={disabled}>
    <RequestFeedback error={action.error} />
    <UserFormField id="user-full-name" label="Full name" type="text" autoComplete="name" required maxLength={120}
      value={fullName} disabled={disabled} error={fields.fullName} onChange={(event) => update('fullName', setFullName, event.target.value)} />
    <UserFormField id="user-username" label="Username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
      required maxLength={50} value={username} disabled={disabled} error={fields.username}
      help="Unique username: 3–50 letters, numbers, periods, hyphens, or underscores."
      onChange={(event) => update('username', setUsername, event.target.value)} />
    <UserFormField id="user-password" label="Temporary password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
      value={password} disabled={disabled} error={fields.password} help="Use 12–128 characters. Share this password privately with the user."
      onChange={(event) => update('password', setPassword, event.target.value)} />
    <UserFormField id="user-confirm-password" label="Confirm temporary password" type="password" autoComplete="new-password" required maxLength={128}
      value={confirmation} disabled={disabled} error={fields.confirmation}
      onChange={(event) => update('confirmation', setConfirmation, event.target.value)} />
    <div className={styles.accessNotice}><strong>Personal password required on first sign-in</strong>
      <p>New accounts are internal users. They must replace this temporary password before accessing the workspace. No email is sent.</p></div>
    <div className={styles.actions}>
      <Button type="submit" disabled={disabled}>{action.isPending ? 'Creating…' : 'Create user'}</Button>
      <ButtonLink to="/admin/users" variant="secondary" disabled={disabled}>Cancel</ButtonLink>
    </div>
  </form>
}

export default UserForm
