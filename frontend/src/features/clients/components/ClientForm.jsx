import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import styles from './ClientForm.module.css'

function ClientForm({
  initialFullName = '',
  submitLabel,
  cancelTo,
  onSubmit,
}) {
  const [fullName, setFullName] = useState(initialFullName)
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    const normalizedName = fullName.trim()

    if (normalizedName.length === 0) {
      setError('Full name is required.')
      return
    }

    setError('')
    onSubmit(normalizedName)
  }

  function handleNameChange(event) {
    setFullName(event.target.value)

    if (error) {
      setError('')
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="client-full-name">Full name</label>
        <input
          id="client-full-name"
          name="fullName"
          type="text"
          value={fullName}
          placeholder="Enter the client's full name"
          autoComplete="name"
          aria-describedby={error ? 'client-full-name-error' : undefined}
          aria-invalid={Boolean(error)}
          onChange={handleNameChange}
        />
        {error && (
          <p id="client-full-name-error" className={styles.errorMessage}>
            {error}
          </p>
        )}
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

export default ClientForm
