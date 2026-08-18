import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import {
  cleanTemplateSectionName,
  isTemplateSectionNameDuplicate,
} from '../utils/normalizeTemplateSectionName.js'
import styles from './TemplateSectionForm.module.css'

function TemplateSectionForm({
  sections,
  initialSection = null,
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const [name, setName] = useState(initialSection?.name ?? '')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    const cleanedName = cleanTemplateSectionName(name)

    if (!cleanedName) {
      setError('Section name is required.')
      return
    }

    if (
      isTemplateSectionNameDuplicate(
        sections,
        cleanedName,
        initialSection?.id,
      )
    ) {
      setError('This section name is already in this template.')
      return
    }

    const wasSubmitted = onSubmit(cleanedName)

    if (wasSubmitted === false) {
      setError('The section could not be saved. Review the name and try again.')
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor={`template-section-name-${initialSection?.id ?? 'new'}`}>
          Section name
        </label>
        <input
          id={`template-section-name-${initialSection?.id ?? 'new'}`}
          type="text"
          value={name}
          placeholder="Example: Petitioner"
          autoComplete="off"
          autoFocus
          aria-describedby={error ? 'template-section-name-error' : undefined}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
          }}
        />
        {error && (
          <small id="template-section-name-error" className={styles.errorMessage}>
            {error}
          </small>
        )}
      </div>

      <div className={styles.actions}>
        <Button type="submit">{submitLabel}</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default TemplateSectionForm
