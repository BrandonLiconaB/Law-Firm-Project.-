import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import {
  cleanTemplateDocumentName,
  isTemplateDocumentNameDuplicate,
} from '../utils/normalizeTemplateDocumentName.js'
import styles from './TemplateDocumentForm.module.css'

function TemplateDocumentForm({
  documents,
  sections = [],
  initialDocument = null,
  submitLabel,
  cancelTo,
  onSubmit,
}) {
  const [name, setName] = useState(initialDocument?.name ?? '')
  const [description, setDescription] = useState(
    initialDocument?.description ?? '',
  )
  const [sectionId, setSectionId] = useState(
    initialDocument?.sectionId ?? '',
  )
  const [isKey, setIsKey] = useState(initialDocument?.isKey ?? false)
  const [tracksQuantity, setTracksQuantity] = useState(
    initialDocument?.expectedQuantity !== null &&
      initialDocument?.expectedQuantity !== undefined,
  )
  const [expectedQuantity, setExpectedQuantity] = useState(
    initialDocument?.expectedQuantity?.toString() ?? '',
  )
  const [errors, setErrors] = useState({})
  const action = useAsyncAction()
  const fieldErrors = { ...action.error?.fields, ...errors }

  function clearFieldError(fieldName) {
    action.clearError()
    setErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors
      }

      const nextErrors = { ...currentErrors }
      delete nextErrors[fieldName]
      return nextErrors
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const cleanedName = cleanTemplateDocumentName(name)
    const numericQuantity = Number(expectedQuantity)
    const nextErrors = {}

    if (cleanedName.length > 120) {
      nextErrors.name = 'Name cannot exceed 120 characters.'
    } else if (!cleanedName) {
      nextErrors.name = 'Document name is required.'
    } else if (
      isTemplateDocumentNameDuplicate(
        documents,
        cleanedName,
        initialDocument?.id,
      )
    ) {
      nextErrors.name = 'This document name is already in this template.'
    }

    if (
      tracksQuantity &&
      (!expectedQuantity ||
        !Number.isInteger(numericQuantity) ||
        numericQuantity < 1 || numericQuantity > 2147483647)
    ) {
      nextErrors.expectedQuantity =
        'Expected quantity must be a whole number between 1 and 2147483647.'
    }
    if (description.trim().length > 1000) nextErrors.description = 'Description cannot exceed 1000 characters.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    await action.run(() => onSubmit({
      name: cleanedName,
      description: description.trim(),
      sectionId: sectionId || null,
      isKey,
      expectedQuantity: tracksQuantity ? numericQuantity : null,
    }))
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={action.isPending}>
      <RequestFeedback error={action.error} />
      <div className={styles.field}>
        <label htmlFor="template-document-name">Document name</label>
        <input
          id="template-document-name"
          type="text"
          disabled={action.isPending}
          maxLength={120}
          value={name}
          placeholder="Example: Passport biographic page"
          autoComplete="off"
          aria-describedby={
            fieldErrors.name
              ? 'template-document-name-error'
              : 'template-document-name-help'
          }
          aria-invalid={Boolean(fieldErrors.name)}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
        />
        {fieldErrors.name ? (
          <small
            id="template-document-name-error"
            className={styles.errorMessage}
          >
            {fieldErrors.name}
          </small>
        ) : (
          <small id="template-document-name-help" className={styles.helpText}>
            Document names must be unique within this template.
          </small>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="template-document-description">
          Description <span>Optional</span>
        </label>
        <textarea
          id="template-document-description"
          rows="4"
          disabled={action.isPending}
          maxLength={1000}
          aria-invalid={Boolean(fieldErrors.description)}
          value={description}
          placeholder="Describe what should be provided."
          onChange={(event) => { setDescription(event.target.value); clearFieldError('description') }}
        />
        {fieldErrors.description && <small className={styles.errorMessage}>{fieldErrors.description}</small>}
      </div>

      <div className={styles.field}>
        <label htmlFor="template-document-section">
          Section <span>Optional</span>
        </label>
        <select
          id="template-document-section"
          value={sectionId}
          disabled={action.isPending}
          aria-invalid={Boolean(fieldErrors.sectionId)}
          onChange={(event) => { setSectionId(event.target.value); clearFieldError('sectionId') }}
        >
          <option value="">No section / General documents</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
        {fieldErrors.sectionId && <small className={styles.errorMessage}>{fieldErrors.sectionId}</small>}
        <small className={styles.helpText}>
          Sections organize the checklist but do not change document rules.
        </small>
      </div>

      <fieldset className={styles.options} disabled={action.isPending}>
        <legend>Document settings</legend>

        <label className={styles.checkOption}>
          <input
            type="checkbox"
            checked={isKey}
            onChange={(event) => setIsKey(event.target.checked)}
          />
          <span>
            <strong>Key document</strong>
            <small>
              Counts toward the minimum documents needed to start drafting.
            </small>
          </span>
        </label>

        <label className={styles.checkOption}>
          <input
            type="checkbox"
            checked={tracksQuantity}
            onChange={(event) => {
              setTracksQuantity(event.target.checked)
              clearFieldError('expectedQuantity')
            }}
          />
          <span>
            <strong>Track expected quantity</strong>
            <small>
              The quantity is informational and never prevents Received status.
            </small>
          </span>
        </label>

        {tracksQuantity && (
          <div className={styles.quantityField}>
            <label htmlFor="template-document-quantity">
              Expected quantity
            </label>
            <input
              id="template-document-quantity"
              type="number"
              min="1"
              max="2147483647"
              step="1"
              value={expectedQuantity}
              aria-describedby={
                fieldErrors.expectedQuantity
                  ? 'template-document-quantity-error'
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.expectedQuantity)}
              onChange={(event) => {
                setExpectedQuantity(event.target.value)
                clearFieldError('expectedQuantity')
              }}
            />
            {fieldErrors.expectedQuantity && (
              <small
                id="template-document-quantity-error"
                className={styles.errorMessage}
              >
                {fieldErrors.expectedQuantity}
              </small>
            )}
          </div>
        )}
      </fieldset>

      <div className={styles.actions}>
        <Button type="submit" disabled={action.isPending}>{action.isPending ? 'Saving…' : submitLabel}</Button>
        <ButtonLink to={cancelTo} variant="secondary" disabled={action.isPending}>
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}

export default TemplateDocumentForm
