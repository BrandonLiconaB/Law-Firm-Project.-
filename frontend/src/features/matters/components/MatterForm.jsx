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
import DocumentTemplatePreview from './DocumentTemplatePreview.jsx'
import styles from './MatterForm.module.css'

function MatterForm({ matterTypes, matters, onSubmit }) {
  const [matterName, setMatterName] = useState('')
  const [matterTypeId, setMatterTypeId] = useState('')
  const [errors, setErrors] = useState({})

  const selectedMatterType = matterTypes.find(
    (matterType) => matterType.id === matterTypeId,
  )

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
    } else if (isMatterNameDuplicate(matters, cleanedMatterName)) {
      nextErrors.matterName = 'This matter name is already in use.'
    }

    if (!matterTypeId) {
      nextErrors.matterTypeId = 'Select a matter type.'
    } else if (!selectedMatterType) {
      nextErrors.matterTypeId = 'The selected matter type is not available.'
    } else if (!isMatterTypeReady(selectedMatterType)) {
      const templateStatus = getMatterTypeTemplateStatus(selectedMatterType)

      nextErrors.matterTypeId =
        templateStatus === MATTER_TYPE_TEMPLATE_STATUSES.KEY_DOCUMENT_REQUIRED
          ? 'Mark at least one template document as key before using this matter type.'
          : 'Add documents to this matter type before using it.'
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
      <div className={styles.layout}>
        <section className={styles.formCard}>
          <div className={styles.cardHeading}>
            <p className={styles.eyebrow}>Matter information</p>
            <h2>Basic details</h2>
            <p>All fields are required to create the matter record.</p>
          </div>

          <div className={styles.fields}>
            <label className={styles.field} htmlFor="matter-name">
              <span>Matter name</span>
              <input
                id="matter-name"
                type="text"
                value={matterName}
                placeholder="Example: Gutierrez, Juan Carlos (402432)"
                autoComplete="off"
                aria-describedby={
                  errors.matterName ? 'matter-name-error' : 'matter-name-help'
                }
                aria-invalid={Boolean(errors.matterName)}
                onChange={(event) => {
                  setMatterName(event.target.value)
                  clearFieldError('matterName')
                }}
              />
              {errors.matterName ? (
                <small id="matter-name-error" className={styles.errorMessage}>
                  {errors.matterName}
                </small>
              ) : (
                <small id="matter-name-help" className={styles.helpText}>
                  Paste the complete name assigned by the firm.
                </small>
              )}
            </label>

            <label className={styles.field} htmlFor="matter-type">
              <span>Matter type</span>
              <select
                id="matter-type"
                value={matterTypeId}
                aria-describedby={
                  errors.matterTypeId ? 'matter-type-error' : undefined
                }
                aria-invalid={Boolean(errors.matterTypeId)}
                onChange={(event) => {
                  setMatterTypeId(event.target.value)
                  clearFieldError('matterTypeId')
                }}
              >
                <option value="">Select a matter type</option>
                {matterTypes.map((matterType) => {
                  const templateStatus = getMatterTypeTemplateStatus(matterType)
                  const isReady = isMatterTypeReady(matterType)

                  return (
                    <option
                      key={matterType.id}
                      value={matterType.id}
                      disabled={!isReady}
                    >
                      {matterType.name}
                      {!isReady ? ` (${templateStatus})` : ''}
                    </option>
                  )
                })}
              </select>
              {errors.matterTypeId && (
                <small id="matter-type-error" className={styles.errorMessage}>
                  {errors.matterTypeId}
                </small>
              )}
            </label>
          </div>

          <div className={styles.initialState}>
            <p>
              <strong>Initial status</strong>
              <span>Pending Documents · Automatic</span>
            </p>
            <p>
              Every document starts as Pending and can be updated after creation.
            </p>
          </div>

          <div className={styles.actions}>
            <Button type="submit">Create matter</Button>
            <ButtonLink to="/matters" variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </section>

        <DocumentTemplatePreview matterType={selectedMatterType} />
      </div>
    </form>
  )
}

export default MatterForm
