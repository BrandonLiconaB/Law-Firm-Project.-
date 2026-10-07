import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PageHero from '../../../components/common/PageHero.jsx'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import { getMatterTypeTemplateStatus } from '../../matterTypes/utils/matterTypeTemplateStatus.js'
import TemplateSectionForm from '../components/TemplateSectionForm.jsx'
import { groupDocumentsBySection } from '../utils/groupDocumentsBySection.js'
import styles from './TemplateDetailPage.module.css'
import { useAuth } from '../../auth/useAuth.js'
import { useTemplate } from '../../catalog/useTemplate.js'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'

function TemplateDocumentList({
  canEdit,
  isBusy,
  matterTypeId,
  documents,
  pendingDeletionId,
  onRequestDeletion,
  onCancelDeletion,
  onDelete,
  onMove,
}) {
  return (
    <ol className={styles.documentList}>
      {documents.map((document, index) => (
        <li className={styles.documentCard} key={document.id}>
          <div className={styles.orderMarker} aria-hidden="true">
            {index + 1}
          </div>

          <div className={styles.documentContent}>
            <div className={styles.documentHeader}>
              <div>
                <div className={styles.documentNameRow}>
                  <h3>{document.name}</h3>
                  {document.isKey && (
                    <span className={styles.keyBadge}>Key</span>
                  )}
                </div>
                <p>
                  {document.description || 'No description has been provided.'}
                </p>
              </div>

              <span className={styles.quantityBadge}>
                {document.expectedQuantity === null
                  ? 'No quantity requirement'
                  : `Expected: ${document.expectedQuantity}`}
              </span>
            </div>

            {canEdit && <div className={styles.documentActions}>
              <div className={styles.orderActions}>
                <button
                  type="button"
                  disabled={isBusy || index === 0}
                  aria-label={`Move ${document.name} up`}
                  onClick={() => onMove(document.id, 'up')}
                >
                  Move up
                </button>
                <button
                  type="button"
                  disabled={isBusy || index === documents.length - 1}
                  aria-label={`Move ${document.name} down`}
                  onClick={() => onMove(document.id, 'down')}
                >
                  Move down
                </button>
              </div>

              <div className={styles.recordActions}>
                <Link
                  aria-disabled={isBusy}
                  onClick={(event) => { if (isBusy) event.preventDefault() }}
                  to={`/admin/templates/${matterTypeId}/documents/${document.id}/edit`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onRequestDeletion(document.id)}
                >
                  Delete
                </button>
              </div>
            </div>}

            {pendingDeletionId === document.id && (
              <div className={styles.deleteConfirmation} role="alert">
                <div>
                  <strong>Remove this document?</strong>
                  <p>
                    This definition will leave the current template. Its database
                    record will be retained rather than permanently deleted.
                  </p>
                </div>
                <div className={styles.confirmationActions}>
                  <Button variant="secondary" onClick={onCancelDeletion} disabled={isBusy}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(document.id)} disabled={isBusy}>
                    Remove document
                  </Button>
                </div>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function TemplateSectionGroup({
  canEdit,
  isBusy,
  group,
  sectionIndex,
  sectionCount,
  matterType,
  editingSectionId,
  pendingSectionDeletionId,
  pendingDocumentDeletionId,
  onStartRename,
  onCancelRename,
  onRename,
  onMoveSection,
  onRequestSectionDeletion,
  onCancelSectionDeletion,
  onDeleteSection,
  onRequestDocumentDeletion,
  onCancelDocumentDeletion,
  onDeleteDocument,
  onMoveDocument,
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const contentId = `template-section-content-${group.id}`
  const keyDocumentCount = group.documents.filter(
    (document) => document.isKey,
  ).length

  return (
    <section className={styles.sectionPanel}>
      <div className={styles.sectionHeader}>
        <button
          className={styles.sectionToggle}
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          <span
            className={styles.sectionChevron}
            data-expanded={isExpanded}
            aria-hidden="true"
          >
            ›
          </span>
          <span className={styles.sectionIdentity}>
            <strong>{group.name}</strong>
            <span>
              {group.documents.length}{' '}
              {group.documents.length === 1 ? 'document' : 'documents'} ·{' '}
              {keyDocumentCount} key
            </span>
          </span>
        </button>

        {canEdit && !group.isGeneral && (
          <div className={styles.sectionActions}>
            <button
              type="button"
              disabled={isBusy || sectionIndex === 0}
              aria-label={`Move ${group.name} up`}
              onClick={() => onMoveSection(group.id, 'up')}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={isBusy || sectionIndex === sectionCount - 1}
              aria-label={`Move ${group.name} down`}
              onClick={() => onMoveSection(group.id, 'down')}
            >
              Move down
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setIsExpanded(true)
                onStartRename(group.id)
              }}
            >
              Rename
            </button>
            <button
              className={styles.deleteSectionButton}
              type="button"
              disabled={isBusy}
              onClick={() => onRequestSectionDeletion(group.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {pendingSectionDeletionId === group.id && (
        <div className={styles.sectionDeleteConfirmation} role="alert">
          <div>
            <strong>Delete the “{group.name}” section?</strong>
            <p>
              Its {group.documents.length}{' '}
              {group.documents.length === 1 ? 'document' : 'documents'} will move
              to General documents. No document will be deleted.
            </p>
          </div>
          <div className={styles.confirmationActions}>
            <Button variant="secondary" onClick={onCancelSectionDeletion} disabled={isBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onDeleteSection(group.id)} disabled={isBusy}>
              Delete section
            </Button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className={styles.sectionContent} id={contentId}>
          {editingSectionId === group.id && (
            <div className={styles.renamePanel}>
              <TemplateSectionForm
                sections={matterType.sections}
                initialSection={matterType.sections.find(
                  (section) => section.id === group.id,
                )}
                submitLabel="Save name"
                onSubmit={(sectionName) => onRename(group.id, sectionName)}
                onCancel={onCancelRename}
              />
            </div>
          )}

          {group.documents.length > 0 ? (
            <TemplateDocumentList
              canEdit={canEdit}
              isBusy={isBusy}
              matterTypeId={matterType.id}
              documents={group.documents}
              pendingDeletionId={pendingDocumentDeletionId}
              onRequestDeletion={onRequestDocumentDeletion}
              onCancelDeletion={onCancelDocumentDeletion}
              onDelete={onDeleteDocument}
              onMove={onMoveDocument}
            />
          ) : (
            <div className={styles.emptySection}>
              <p>No documents have been assigned to this section.</p>
              {canEdit && <ButtonLink
                to={`/admin/templates/${matterType.id}/documents/new`}
                variant="secondary"
              >
                Add document
              </ButtonLink>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function TemplateDetailPage() {
  const { matterTypeId } = useParams()
  const { user } = useAuth()
  const canEdit = user.systemRole === 'ADMIN'
  const template = useTemplate(matterTypeId)
  const action = useAsyncAction()
  const {
    isMutating,
    createTemplateSection,
    updateTemplateSection,
    deleteTemplateSection,
    moveTemplateSection,
    deleteTemplateDocument,
    moveTemplateDocument,
  } = useAppData()
  const location = useLocation()
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [pendingSectionDeletionId, setPendingSectionDeletionId] = useState(null)
  const [pendingDocumentDeletionId, setPendingDocumentDeletionId] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const matterType = template.data
  const isBusy = isMutating || action.isPending || template.status === 'Loading'

  if (!matterType) {
    if (template.status !== 'Ready') return <RequestFeedback loading={template.status === 'Loading'}
      message="Loading the template…" error={template.error} onRetry={template.retry} />
    return (
      <PlaceholderPage
        eyebrow="Templates"
        title="Template not found"
        description="The requested document template does not exist in the catalog."
        backTo="/admin/templates"
        backLabel="Back to templates"
      />
    )
  }

  const keyDocumentCount = matterType.documents.filter(
    (document) => document.isKey,
  ).length
  const templateStatus = getMatterTypeTemplateStatus(matterType)
  const hasSections = matterType.sections.length > 0
  const documentGroups = hasSections
    ? groupDocumentsBySection(matterType.documents, matterType.sections, {
        includeEmptySections: true,
      })
    : []

  async function handleCreateSection(sectionName) {
    const section = await createTemplateSection(matterType.id, sectionName)

    if (!section) {
      return false
    }

    setShowSectionForm(false)
    setNotice('Section saved to the template.')
    return true
  }

  async function handleRenameSection(sectionId, sectionName) {
    const section = await updateTemplateSection(
      matterType.id,
      sectionId,
      sectionName,
    )

    if (!section) {
      return false
    }

    setEditingSectionId(null)
    setNotice('Section name saved to the database.')
    return true
  }

  async function handleDeleteSection(sectionId) {
    const section = matterType.sections.find(
      (currentSection) => currentSection.id === sectionId,
    )
    const documentCount = matterType.documents.filter(
      (document) => document.sectionId === sectionId,
    ).length
    const result = await action.run(() => deleteTemplateSection(matterType.id, sectionId))

    if (result.ok) {
      setPendingSectionDeletionId(null)
      setEditingSectionId(null)
      setNotice(
        `Section “${section.name}” removed. ${documentCount} ${
          documentCount === 1 ? 'document was' : 'documents were'
        } moved to General documents.`,
      )
    }
  }

  async function handleMoveSection(sectionId, direction) {
    await action.run(() => moveTemplateSection(matterType.id, sectionId, direction))
    setPendingSectionDeletionId(null)
    setNotice('')
  }

  async function handleDeleteDocument(documentId) {
    const result = await action.run(() => deleteTemplateDocument(matterType.id, documentId))

    if (result.ok) {
      setPendingDocumentDeletionId(null)
      setNotice(
        'Document removed from the current template. Its database record was retained.',
      )
    }
  }

  async function handleMoveDocument(documentId, direction) {
    await action.run(() => moveTemplateDocument(matterType.id, documentId, direction))
    setPendingDocumentDeletionId(null)
    setNotice('')
  }

  return (
    <section className={styles.page} aria-busy={isBusy}>
      <RequestFeedback error={action.error} />
      {isBusy && <p role="status">Updating the template…</p>}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <Link className={styles.backLink} to="/admin/templates">
        ← Back to templates
      </Link>

      <PageHero
        eyebrow="Document template"
        title={matterType.name}
        description={matterType.description || 'No description has been provided.'}
        contextLabel="Template status"
        contextValue={templateStatus}
        action={
          canEdit ? <div className={styles.heroActions}>
            <Button
              variant="secondary"
              disabled={isBusy}
              onClick={() => {
                setShowSectionForm(true)
                setEditingSectionId(null)
                setPendingSectionDeletionId(null)
                setNotice('')
              }}
            >
              Add section
            </Button>
            <ButtonLink to={`/admin/templates/${matterType.id}/documents/new`} disabled={isBusy}>
              Add document
            </ButtonLink>
          </div> : null
        }
      />

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
          <strong>{templateStatus}</strong>
          <span>Template status</span>
        </article>
      </div>

      {showSectionForm && (
        <div className={styles.createSectionPanel}>
          <div className={styles.formHeading}>
            <strong>Add a document section</strong>
            <p>
              Use sections only when the template needs separate document groups.
            </p>
          </div>
          <TemplateSectionForm
            sections={matterType.sections}
            submitLabel="Add section"
            onSubmit={handleCreateSection}
            onCancel={() => setShowSectionForm(false)}
          />
        </div>
      )}

      {hasSections ? (
        <div className={styles.sectionGroups}>
          {documentGroups.map((group, index) => (
            <TemplateSectionGroup
              canEdit={canEdit}
              isBusy={isBusy}
              key={group.id}
              group={group}
              sectionIndex={index}
              sectionCount={matterType.sections.length}
              matterType={matterType}
              editingSectionId={editingSectionId}
              pendingSectionDeletionId={pendingSectionDeletionId}
              pendingDocumentDeletionId={pendingDocumentDeletionId}
              onStartRename={(sectionId) => {
                setEditingSectionId(sectionId)
                setShowSectionForm(false)
                setPendingSectionDeletionId(null)
                setNotice('')
              }}
              onCancelRename={() => setEditingSectionId(null)}
              onRename={handleRenameSection}
              onMoveSection={handleMoveSection}
              onRequestSectionDeletion={(sectionId) => {
                setPendingSectionDeletionId(sectionId)
                setEditingSectionId(null)
                setPendingDocumentDeletionId(null)
                setNotice('')
              }}
              onCancelSectionDeletion={() => setPendingSectionDeletionId(null)}
              onDeleteSection={handleDeleteSection}
              onRequestDocumentDeletion={(documentId) => {
                setPendingDocumentDeletionId(documentId)
                setPendingSectionDeletionId(null)
                setNotice('')
              }}
              onCancelDocumentDeletion={() => setPendingDocumentDeletionId(null)}
              onDeleteDocument={handleDeleteDocument}
              onMoveDocument={handleMoveDocument}
            />
          ))}
        </div>
      ) : matterType.documents.length > 0 ? (
        <TemplateDocumentList
          canEdit={canEdit}
          isBusy={isBusy}
          matterTypeId={matterType.id}
          documents={matterType.documents}
          pendingDeletionId={pendingDocumentDeletionId}
          onRequestDeletion={(documentId) => {
            setPendingDocumentDeletionId(documentId)
            setNotice('')
          }}
          onCancelDeletion={() => setPendingDocumentDeletionId(null)}
          onDelete={handleDeleteDocument}
          onMove={handleMoveDocument}
        />
      ) : (
        <div className={styles.emptyState}>
          <h2>Template required</h2>
          <p>
            Add the first document before this matter type can be used to create
            matters.
          </p>
          {canEdit && <ButtonLink to={`/admin/templates/${matterType.id}/documents/new`}>
            Add first document
          </ButtonLink>}
        </div>
      )}

      <p className={styles.snapshotNote}>
        This template is saved to the database. Editing preserves definition
        identifiers; removals retain their database records. Matter tracking will be connected later.
      </p>
    </section>
  )
}

export default TemplateDetailPage
