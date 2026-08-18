import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import {
  getMatterTypeTemplateStatus,
  isMatterTypeReady,
  MATTER_TYPE_TEMPLATE_STATUSES,
} from '../../matterTypes/utils/matterTypeTemplateStatus.js'
import {
  cleanMatterName,
  isMatterNameDuplicate,
} from '../utils/normalizeMatterName.js'
import styles from './MatterEditForm.module.css'

function MatterEditForm({
  matter,
  matterRecord,
  matterTypes,
  matters,
  onSubmit,
}) {
  const [matterName, setMatterName] = useState(matter.matterName)
  const [matterTypeId, setMatterTypeId] = useState(matter.matterTypeId)
  const [confirmsReplacement, setConfirmsReplacement] = useState(false)
  const [errors, setErrors] = useState({})

  const currentMatterType = matterTypes.find(
    (matterType) => matterType.id === matter.matterTypeId,
  )
  const selectedMatterType = matterTypes.find(
    (matterType) => matterType.id === matterTypeId,
  )
  const matterTypeChanged = matterTypeId !== matter.matterTypeId

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

    const cleanedMatterName = cleanMatterName(matterName)
    const nextErrors = {}

    if (!cleanedMatterName) {
      nextErrors.matterName = 'Matter name is required.'
    } else if (
      isMatterNameDuplicate(matters, cleanedMatterName, matter.id)
    ) {
      nextErrors.matterName = 'This matter name is already in use.'
    }

    if (!selectedMatterType) {
      nextErrors.matterTypeId = 'Select an available matter type.'
    } else if (
      matterTypeChanged &&
      !isMatterTypeReady(selectedMatterType)
    ) {
      const templateStatus = getMatterTypeTemplateStatus(selectedMatterType)

      nextErrors.matterTypeId =
        templateStatus === MATTER_TYPE_TEMPLATE_STATUSES.KEY_DOCUMENT_REQUIRED
          ? 'The new matter type must have at least one key document.'
          : 'The new matter type must have a configured document template.'
    }

    if (matterTypeChanged && !confirmsReplacement) {
      nextErrors.confirmation =
        'Confirm that the existing document tracking can be replaced.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSubmit({
      matterName: cleanedMatterName,
      matterTypeId,
    })
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.adminNotice}>
        <strong>Administrator action</strong>
        <p>
          Access restrictions will be enforced by the backend. This frontend
          preview does not apply user permissions.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="edit-matter-name">Matter name</label>
        <input
          id="edit-matter-name"
          type="text"
          value={matterName}
          autoComplete="off"
          aria-describedby={
            errors.matterName ? 'edit-matter-name-error' : 'edit-matter-name-help'
          }
          aria-invalid={Boolean(errors.matterName)}
          onChange={(event) => {
            setMatterName(event.target.value)
            clearFieldError('matterName')
          }}
        />
        {errors.matterName ? (
          <small id="edit-matter-name-error" className={styles.errorMessage}>
            {errors.matterName}
          </small>
        ) : (
          <small id="edit-matter-name-help" className={styles.helpText}>
            Matter names must remain unique across the system.
          </small>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="edit-matter-type">Matter type</label>
        <select
          id="edit-matter-type"
          value={matterTypeId}
          aria-describedby={
            errors.matterTypeId ? 'edit-matter-type-error' : undefined
          }
          aria-invalid={Boolean(errors.matterTypeId)}
          onChange={(event) => {
            setMatterTypeId(event.target.value)
            setConfirmsReplacement(false)
            clearFieldError('matterTypeId')
            clearFieldError('confirmation')
          }}
        >
          {matterTypes.map((matterType) => {
            const templateStatus = getMatterTypeTemplateStatus(matterType)
            const isReady = isMatterTypeReady(matterType)
            const isCurrentType = matterType.id === matter.matterTypeId

            return (
              <option
                key={matterType.id}
                value={matterType.id}
                disabled={!isReady && !isCurrentType}
              >
                {matterType.name}
                {!isReady ? ` (${templateStatus})` : ''}
              </option>
            )
          })}
        </select>
        {errors.matterTypeId && (
          <small id="edit-matter-type-error" className={styles.errorMessage}>
            {errors.matterTypeId}
          </small>
        )}
      </div>

      {matterTypeChanged && selectedMatterType && (
        <div className={styles.destructiveWarning}>
          <strong>Changing the matter type will reset document tracking</strong>
          <p>
            The current {matterRecord.documents.length}-document checklist from{' '}
            {currentMatterType?.name ?? 'the current matter type'} will be replaced
            by {selectedMatterType.documents.length} pending documents from{' '}
            {selectedMatterType.name}, including its current section structure.
          </p>
          <ul>
            <li>Document statuses, received quantities, and comments will be discarded.</li>
            <li>The workflow will return to Pending Documents and Automatic.</li>
            <li>The previous status history will remain available.</li>
          </ul>

          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={confirmsReplacement}
              onChange={(event) => {
                setConfirmsReplacement(event.target.checked)
                clearFieldError('confirmation')
              }}
            />
            <span>I understand that the existing document tracking will be replaced.</span>
          </label>
          {errors.confirmation && (
            <small className={styles.errorMessage}>{errors.confirmation}</small>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <Button type="submit">Save matter details</Button>
        <ButtonLink to={`/matters/${matter.id}`} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}

export default MatterEditForm
