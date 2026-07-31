import styles from './DocumentTemplatePreview.module.css'

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

      <ul className={styles.documentList}>
        {matterType.documents.map((document) => (
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

      <p className={styles.snapshotNote}>
        This list will be copied into the matter and will not depend on later
        template changes.
      </p>
    </aside>
  )
}

export default DocumentTemplatePreview
