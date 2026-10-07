import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import {
  cleanMatterTypeName,
  isMatterTypeNameDuplicate,
} from '../utils/normalizeMatterTypeName.js'
import {
  getMatterTypeTemplateStatus,
  getTemplateDocumentCount,
  MATTER_TYPE_TEMPLATE_STATUSES,
} from '../utils/matterTypeTemplateStatus.js'
import styles from './MatterTypeForm.module.css'

function MatterTypeForm({
  matterTypes,
  initialMatterType = null,
  submitLabel,
  cancelTo,
  onSubmit,
}) {
  const [name, setName] = useState(initialMatterType?.name ?? '')
  const [description, setDescription] = useState(
    initialMatterType?.description ?? '',
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

    const cleanedName = cleanMatterTypeName(name)
    const nextErrors = {}

    if (cleanedName.length > 120) {
      nextErrors.name = 'Name cannot exceed 120 characters.'
    } else if (!cleanedName) {
      nextErrors.name = 'Matter type name is required.'
    } else if (
      isMatterTypeNameDuplicate(
        matterTypes,
        cleanedName,
        initialMatterType?.id,
      )
    ) {
      nextErrors.name = 'This matter type name is already in use.'
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
    }))
  }

  const documentCount = getTemplateDocumentCount(initialMatterType)
  const templateStatus = initialMatterType
    ? getMatterTypeTemplateStatus(initialMatterType)
    : MATTER_TYPE_TEMPLATE_STATUSES.TEMPLATE_REQUIRED

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={action.isPending}>
      <RequestFeedback error={action.error} />
      <div className={styles.field}>
        <label htmlFor="matter-type-name">Name</label>
        <input
          id="matter-type-name"
          type="text"
          disabled={action.isPending}
          maxLength={120}
          value={name}
          placeholder="Example: Family Petition"
          autoComplete="off"
          aria-describedby={
            fieldErrors.name ? 'matter-type-name-error' : 'matter-type-name-help'
          }
          aria-invalid={Boolean(fieldErrors.name)}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
        />
        {fieldErrors.name ? (
          <small id="matter-type-name-error" className={styles.errorMessage}>
            {fieldErrors.name}
          </small>
        ) : (
          <small id="matter-type-name-help" className={styles.helpText}>
            Names must be unique across the catalog.
          </small>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="matter-type-description">
          Description <span>Optional</span>
        </label>
        <textarea
          id="matter-type-description"
          rows="4"
          disabled={action.isPending}
          maxLength={1000}
          aria-invalid={Boolean(fieldErrors.description)}
          value={description}
          placeholder="Briefly describe when this matter type is used."
          onChange={(event) => { setDescription(event.target.value); clearFieldError('description') }}
        />
        {fieldErrors.description && <small className={styles.errorMessage}>{fieldErrors.description}</small>}
      </div>

      <div className={styles.templateInformation}>
        <div>
          <strong>Document template</strong>
          <span>
            {documentCount > 0
              ? `${documentCount} ${
                  documentCount === 1 ? 'document' : 'documents'
                } configured · ${templateStatus}`
              : templateStatus}
          </span>
        </div>
        <p>
          Document requirements are managed separately from the Templates
          section.
        </p>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={action.isPending}>{action.isPending ? 'Saving…' : submitLabel}</Button>
        <ButtonLink to={cancelTo} variant="secondary" disabled={action.isPending}>
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}

export default MatterTypeForm
