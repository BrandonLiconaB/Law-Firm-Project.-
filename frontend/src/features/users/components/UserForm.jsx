import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import {
  cleanUserName,
  isUserEmailDuplicate,
  isUserEmailValid,
  normalizeUserEmail,
} from '../utils/userValidation.js'
import styles from './UserForm.module.css'

function UserForm({
  users,
  initialUser = null,
  submitLabel,
  cancelTo,
  onSubmit,
}) {
  const [name, setName] = useState(initialUser?.name ?? '')
  const [email, setEmail] = useState(initialUser?.email ?? '')
  const [errors, setErrors] = useState({})

  function clearFieldError(fieldName) {
    setErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors
      }

      const nextErrors = { ...currentErrors }
      delete nextErrors[fieldName]
      return nextErrors
    })
  }

  function handleSubmit(event) {
    event.preventDefault()

    const cleanedName = cleanUserName(name)
    const normalizedEmail = normalizeUserEmail(email)
    const nextErrors = {}

    if (!cleanedName) {
      nextErrors.name = 'Name is required.'
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required.'
    } else if (!isUserEmailValid(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    } else if (
      isUserEmailDuplicate(users, normalizedEmail, initialUser?.id)
    ) {
      nextErrors.email = 'This email address is already in use.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSubmit({
      name: cleanedName,
      email: normalizedEmail,
    })
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="user-name">Name</label>
        <input
          id="user-name"
          type="text"
          value={name}
          placeholder="Enter the user's name"
          autoComplete="name"
          aria-describedby={errors.name ? 'user-name-error' : undefined}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
        />
        {errors.name && (
          <small id="user-name-error" className={styles.errorMessage}>
            {errors.name}
          </small>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="user-email">Email</label>
        <input
          id="user-email"
          type="email"
          value={email}
          placeholder="name@example.com"
          autoComplete="email"
          aria-describedby={
            errors.email ? 'user-email-error' : 'user-email-help'
          }
          aria-invalid={Boolean(errors.email)}
          onChange={(event) => {
            setEmail(event.target.value)
            clearFieldError('email')
          }}
        />
        {errors.email ? (
          <small id="user-email-error" className={styles.errorMessage}>
            {errors.email}
          </small>
        ) : (
          <small id="user-email-help" className={styles.helpText}>
            Email addresses must be unique across internal users.
          </small>
        )}
      </div>

      <div className={styles.accessNotice}>
        <strong>Directory record only</strong>
        <p>
          Authentication, passwords, invitations, roles, and access permissions
          are not configured in this frontend preview.
        </p>
      </div>

      <div className={styles.actions}>
        <Button type="submit">{submitLabel}</Button>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}

export default UserForm
