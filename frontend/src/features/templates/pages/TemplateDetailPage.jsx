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

function TemplateDocumentList({
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

            <div className={styles.documentActions}>
              <div className={styles.orderActions}>
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`Move ${document.name} up`}
                  onClick={() => onMove(document.id, 'up')}
                >
                  Move up
                </button>
                <button
                  type="button"
                  disabled={index === documents.length - 1}
                  aria-label={`Move ${document.name} down`}
                  onClick={() => onMove(document.id, 'down')}
                >
                  Move down
                </button>
              </div>

              <div className={styles.recordActions}>
                <Link
                  to={`/admin/templates/${matterTypeId}/documents/${document.id}/edit`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => onRequestDeletion(document.id)}
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
                  <Button variant="secondary" onClick={onCancelDeletion}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(document.id)}>
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

        {!group.isGeneral && (
          <div className={styles.sectionActions}>
            <button
              type="button"
              disabled={sectionIndex === 0}
              aria-label={`Move ${group.name} up`}
              onClick={() => onMoveSection(group.id, 'up')}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={sectionIndex === sectionCount - 1}
              aria-label={`Move ${group.name} down`}
              onClick={() => onMoveSection(group.id, 'down')}
            >
              Move down
            </button>
            <button
              type="button"
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
            <Button variant="secondary" onClick={onCancelSectionDeletion}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onDeleteSection(group.id)}>
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
              <ButtonLink
                to={`/admin/templates/${matterType.id}/documents/new`}
                variant="secondary"
              >
                Add document
              </ButtonLink>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function TemplateDetailPage() {
  const { matterTypeId } = useParams()
  const {
    matterTypes,
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
  const hasSections = matterType.sections.length > 0
  const documentGroups = hasSections
    ? groupDocumentsBySection(matterType.documents, matterType.sections, {
        includeEmptySections: true,
      })
    : []

  function handleCreateSection(sectionName) {
    const section = createTemplateSection(matterType.id, sectionName)

    if (!section) {
      return false
    }

    setShowSectionForm(false)
    setNotice('Section added to this template for the preview session.')
    return true
  }

  function handleRenameSection(sectionId, sectionName) {
    const section = updateTemplateSection(
      matterType.id,
      sectionId,
      sectionName,
    )

    if (!section) {
      return false
    }

    setEditingSectionId(null)
    setNotice('Section name updated for this preview session.')
    return true
  }

  function handleDeleteSection(sectionId) {
    const section = matterType.sections.find(
      (currentSection) => currentSection.id === sectionId,
    )
    const documentCount = matterType.documents.filter(
      (document) => document.sectionId === sectionId,
    ).length
    const wasDeleted = deleteTemplateSection(matterType.id, sectionId)

    if (wasDeleted) {
      setPendingSectionDeletionId(null)
      setEditingSectionId(null)
      setNotice(
        `Section “${section.name}” removed. ${documentCount} ${
          documentCount === 1 ? 'document was' : 'documents were'
        } moved to General documents. Existing matters were not changed.`,
      )
    }
  }

  function handleMoveSection(sectionId, direction) {
    moveTemplateSection(matterType.id, sectionId, direction)
    setPendingSectionDeletionId(null)
    setNotice('')
  }

  function handleDeleteDocument(documentId) {
    const wasDeleted = deleteTemplateDocument(matterType.id, documentId)

    if (wasDeleted) {
      setPendingDocumentDeletionId(null)
      setNotice(
        'Document removed from this template. Existing matters were not changed.',
      )
    }
  }

  function handleMoveDocument(documentId, direction) {
    moveTemplateDocument(matterType.id, documentId, direction)
    setPendingDocumentDeletionId(null)
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

      <PageHero
        eyebrow="Document template"
        title={matterType.name}
        description={matterType.description || 'No description has been provided.'}
        contextLabel="Template status"
        contextValue={templateStatus}
        action={
          <div className={styles.heroActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowSectionForm(true)
                setEditingSectionId(null)
                setPendingSectionDeletionId(null)
                setNotice('')
              }}
            >
              Add section
            </Button>
            <ButtonLink to={`/admin/templates/${matterType.id}/documents/new`}>
              Add document
            </ButtonLink>
          </div>
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
