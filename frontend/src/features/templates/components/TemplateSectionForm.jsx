import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
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
  const action = useAsyncAction()
  const nameError = error || action.error?.fields?.name

  async function handleSubmit(event) {
    event.preventDefault()

    const cleanedName = cleanTemplateSectionName(name)

    if (cleanedName.length > 120) { setError('Name cannot exceed 120 characters.'); return }
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

    setError('')
    await action.run(() => onSubmit(cleanedName))
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={action.isPending}>
      <RequestFeedback error={action.error} />
      <div className={styles.field}>
        <label htmlFor={`template-section-name-${initialSection?.id ?? 'new'}`}>
          Section name
        </label>
        <input
          id={`template-section-name-${initialSection?.id ?? 'new'}`}
          type="text"
          maxLength={120}
          disabled={action.isPending}
          value={name}
          placeholder="Example: Petitioner"
          autoComplete="off"
          autoFocus
          aria-describedby={nameError ? 'template-section-name-error' : undefined}
          aria-invalid={Boolean(nameError)}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
            action.clearError()
          }}
        />
        {nameError && (
          <small id="template-section-name-error" className={styles.errorMessage}>
            {nameError}
          </small>
        )}
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={action.isPending}>{action.isPending ? 'Saving…' : submitLabel}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={action.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default TemplateSectionForm
