import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import {
  cleanMatterTypeName,
  isMatterTypeNameDuplicate,
} from '../utils/normalizeMatterTypeName.js'
import {
  getMatterTypeTemplateStatus,
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

    const cleanedName = cleanMatterTypeName(name)
    const nextErrors = {}

    if (!cleanedName) {
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

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSubmit({
      name: cleanedName,
      description: description.trim(),
    })
  }

  const documentCount = initialMatterType?.documents.length ?? 0
  const templateStatus = initialMatterType
    ? getMatterTypeTemplateStatus(initialMatterType)
    : MATTER_TYPE_TEMPLATE_STATUSES.TEMPLATE_REQUIRED

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="matter-type-name">Name</label>
        <input
          id="matter-type-name"
          type="text"
          value={name}
          placeholder="Example: Family Petition"
          autoComplete="off"
          aria-describedby={
            errors.name ? 'matter-type-name-error' : 'matter-type-name-help'
          }
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
        />
        {errors.name ? (
          <small id="matter-type-name-error" className={styles.errorMessage}>
            {errors.name}
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
          value={description}
          placeholder="Briefly describe when this matter type is used."
          onChange={(event) => setDescription(event.target.value)}
        />
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
        <Button type="submit">{submitLabel}</Button>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}

export default MatterTypeForm
