import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
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

    const cleanedName = cleanTemplateDocumentName(name)
    const numericQuantity = Number(expectedQuantity)
    const nextErrors = {}

    if (!cleanedName) {
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
        numericQuantity < 1)
    ) {
      nextErrors.expectedQuantity =
        'Expected quantity must be a positive whole number.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSubmit({
      name: cleanedName,
      description: description.trim(),
      sectionId: sectionId || null,
      isKey,
      expectedQuantity: tracksQuantity ? numericQuantity : null,
    })
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="template-document-name">Document name</label>
        <input
          id="template-document-name"
          type="text"
          value={name}
          placeholder="Example: Passport biographic page"
          autoComplete="off"
          aria-describedby={
            errors.name
              ? 'template-document-name-error'
              : 'template-document-name-help'
          }
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
        />
        {errors.name ? (
          <small
            id="template-document-name-error"
            className={styles.errorMessage}
          >
            {errors.name}
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
          value={description}
          placeholder="Describe what should be provided."
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="template-document-section">
          Section <span>Optional</span>
        </label>
        <select
          id="template-document-section"
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
        >
          <option value="">No section / General documents</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
        <small className={styles.helpText}>
          Sections organize the checklist but do not change document rules.
        </small>
      </div>

      <fieldset className={styles.options}>
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
              step="1"
              value={expectedQuantity}
              aria-describedby={
                errors.expectedQuantity
                  ? 'template-document-quantity-error'
                  : undefined
              }
              aria-invalid={Boolean(errors.expectedQuantity)}
              onChange={(event) => {
                setExpectedQuantity(event.target.value)
                clearFieldError('expectedQuantity')
              }}
            />
            {errors.expectedQuantity && (
              <small
                id="template-document-quantity-error"
                className={styles.errorMessage}
              >
                {errors.expectedQuantity}
              </small>
            )}
          </div>
        )}
      </fieldset>

      <div className={styles.actions}>
        <Button type="submit">{submitLabel}</Button>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}

export default TemplateDocumentForm
