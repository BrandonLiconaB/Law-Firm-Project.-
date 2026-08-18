import { useId, useState } from 'react'
import { groupDocumentsBySection } from '../../templates/utils/groupDocumentsBySection.js'
import styles from './DocumentTemplatePreview.module.css'

function PreviewDocumentList({ documents }) {
  return (
    <ul className={styles.documentList}>
      {documents.map((document) => (
        <li key={document.id}>
          <div className={styles.documentHeading}>
            <strong>{document.name}</strong>
            {document.isKey && <span className={styles.keyBadge}>Key</span>}
          </div>
          <p>{document.description}</p>
          <span className={styles.quantity}>
            {document.expectedQuantity === null
              ? 'No quantity requirement'
              : `Expected quantity: ${document.expectedQuantity}`}
          </span>
        </li>
      ))}
    </ul>
  )
}

function PreviewSection({ group }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const contentId = useId()
  const keyDocumentCount = group.documents.filter(
    (document) => document.isKey,
  ).length

  return (
    <section className={styles.previewSection}>
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
        <span>
          <strong>{group.name}</strong>
          <small>
            {group.documents.length}{' '}
            {group.documents.length === 1 ? 'document' : 'documents'} ·{' '}
            {keyDocumentCount} key
          </small>
        </span>
      </button>

      {isExpanded && (
        <div className={styles.sectionContent} id={contentId}>
          {group.documents.length > 0 ? (
            <PreviewDocumentList documents={group.documents} />
          ) : (
            <p className={styles.emptySection}>No documents in this section.</p>
          )}
        </div>
      )}
    </section>
  )
}

function DocumentTemplatePreview({ matterType }) {
  if (!matterType) {
    return (
      <aside className={`${styles.preview} ${styles.emptyPreview}`}>
        <div>
          <p className={styles.eyebrow}>Document template</p>
          <h2>Select a matter type</h2>
          <p>
            Its provisional document requirements will appear here before the matter
            is created.
          </p>
        </div>
      </aside>
    )
  }

  const keyDocumentCount = matterType.documents.filter(
    (document) => document.isKey,
  ).length
  const hasSections = matterType.sections.length > 0
  const documentGroups = hasSections
    ? groupDocumentsBySection(matterType.documents, matterType.sections, {
        includeEmptySections: true,
      })
    : []

  return (
    <aside className={styles.preview}>
      <div className={styles.previewHeader}>
        <div>
          <p className={styles.eyebrow}>Document template</p>
          <h2>{matterType.name}</h2>
        </div>
        <span className={styles.demoBadge}>Preview data</span>
      </div>

      <p className={styles.description}>{matterType.description}</p>

      <div className={styles.summary}>
        <div>
          <strong>{matterType.documents.length}</strong>
          <span>Required documents</span>
        </div>
        <div>
          <strong>{keyDocumentCount}</strong>
          <span>Key documents</span>
        </div>
      </div>

      {hasSections ? (
        <div className={styles.sectionList}>
          {documentGroups.map((group) => (
            <PreviewSection key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <PreviewDocumentList documents={matterType.documents} />
      )}

      <p className={styles.snapshotNote}>
        This list will be copied into the matter and will not depend on later
        template changes.
      </p>
    </aside>
  )
}

export default DocumentTemplatePreview
