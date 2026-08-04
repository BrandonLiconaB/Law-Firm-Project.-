import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import { getMatterTypeTemplateStatus } from '../../matterTypes/utils/matterTypeTemplateStatus.js'
import styles from './TemplateDetailPage.module.css'

function TemplateDetailPage() {
  const { matterTypeId } = useParams()
  const {
    matterTypes,
    deleteTemplateDocument,
    moveTemplateDocument,
  } = useAppData()
  const location = useLocation()
  const [pendingDeletionId, setPendingDeletionId] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const matterType = matterTypes.find(
    (currentMatterType) => currentMatterType.id === matterTypeId,
  )

  if (!matterType) {
    return (
      <PlaceholderPage
        eyebrow="Templates"
        title="Template not found"
        description="The requested document template does not exist in the preview catalog."
        backTo="/admin/templates"
        backLabel="Back to templates"
      />
    )
  }

  const keyDocumentCount = matterType.documents.filter(
    (document) => document.isKey,
  ).length
  const templateStatus = getMatterTypeTemplateStatus(matterType)

  function handleDelete(documentId) {
    const wasDeleted = deleteTemplateDocument(matterType.id, documentId)

    if (wasDeleted) {
      setPendingDeletionId(null)
      setNotice(
        'Document removed from this template. Existing matters were not changed.',
      )
    }
  }

  function handleMove(documentId, direction) {
    moveTemplateDocument(matterType.id, documentId, direction)
    setPendingDeletionId(null)
    setNotice('')
  }

  return (
    <section className={styles.page}>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <Link className={styles.backLink} to="/admin/templates">
        ← Back to templates
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Document template</p>
          <h1>{matterType.name}</h1>
          <p className={styles.introduction}>
            {matterType.description || 'No description has been provided.'}
          </p>
        </div>
        <ButtonLink to={`/admin/templates/${matterType.id}/documents/new`}>
          Add document
        </ButtonLink>
      </header>

      <div className={styles.summaryGrid}>
        <article>
          <strong>{matterType.documents.length}</strong>
          <span>Required documents</span>
        </article>
        <article>
          <strong>{keyDocumentCount}</strong>
          <span>Key documents</span>
        </article>
        <article>
          <strong>
            {templateStatus}
          </strong>
          <span>Template status</span>
        </article>
      </div>

      {matterType.documents.length > 0 ? (
        <ol className={styles.documentList}>
          {matterType.documents.map((document, index) => (
            <li className={styles.documentCard} key={document.id}>
              <div className={styles.orderMarker} aria-hidden="true">
                {index + 1}
              </div>

              <div className={styles.documentContent}>
                <div className={styles.documentHeader}>
                  <div>
                    <div className={styles.documentNameRow}>
                      <h2>{document.name}</h2>
                      {document.isKey && (
                        <span className={styles.keyBadge}>Key</span>
                      )}
                    </div>
                    <p>
                      {document.description ||
                        'No description has been provided.'}
                    </p>
                  </div>

                  <span className={styles.quantityBadge}>
                    {document.expectedQuantity === null
                      ? 'No quantity requirement'
                      : `Expected: ${document.expectedQuantity}`}
                  </span>
                </div>

                <div className={styles.documentActions}>
                  <div className={styles.orderActions}>
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`Move ${document.name} up`}
                      onClick={() => handleMove(document.id, 'up')}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={index === matterType.documents.length - 1}
                      aria-label={`Move ${document.name} down`}
                      onClick={() => handleMove(document.id, 'down')}
                    >
                      Move down
                    </button>
                  </div>

                  <div className={styles.recordActions}>
                    <Link
                      to={`/admin/templates/${matterType.id}/documents/${document.id}/edit`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDeletionId(document.id)
                        setNotice('')
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {pendingDeletionId === document.id && (
                  <div className={styles.deleteConfirmation} role="alert">
                    <div>
                      <strong>Remove this document?</strong>
                      <p>
                        It will disappear from this template only. Existing matters
                        will keep their current document list.
                      </p>
                    </div>
                    <div className={styles.confirmationActions}>
                      <Button
                        variant="secondary"
                        onClick={() => setPendingDeletionId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(document.id)}
                      >
                        Remove document
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.emptyState}>
          <h2>Template required</h2>
          <p>
            Add the first document before this matter type can be used to create
            matters.
          </p>
          <ButtonLink to={`/admin/templates/${matterType.id}/documents/new`}>
            Add first document
          </ButtonLink>
        </div>
      )}

      <p className={styles.snapshotNote}>
        Template changes apply only to matters created after the change.
      </p>
    </section>
  )
}

export default TemplateDetailPage
