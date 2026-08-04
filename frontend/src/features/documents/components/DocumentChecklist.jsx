import { DOCUMENT_STATUSES } from '../constants/documentStatuses.js'
import styles from './DocumentChecklist.module.css'

function formatDateTime(dateTime) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateTime))
}

function QuantityField({ document, onDocumentChange }) {
  if (document.expectedQuantity === null) {
    return <span className={styles.notCounted}>Not counted</span>
  }

  return (
    <div className={styles.quantityField}>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={document.receivedQuantity ?? ''}
        aria-label={`Received quantity for ${document.name}`}
        onChange={(event) => {
          const value = event.target.value

          if (value !== '' && !/^\d+$/.test(value)) {
            return
          }

          onDocumentChange(document.id, {
            receivedQuantity: value === '' ? '' : Number(value),
          })
        }}
        onBlur={() => {
          if (document.receivedQuantity === '') {
            onDocumentChange(document.id, { receivedQuantity: 0 })
          }
        }}
      />
      <span>of {document.expectedQuantity}</span>
    </div>
  )
}

function StatusField({ document, onDocumentChange }) {
  return (
    <select
      className={styles.statusSelect}
      value={document.status}
      aria-label={`Status for ${document.name}`}
      onChange={(event) => onDocumentChange(document.id, { status: event.target.value })}
    >
      {DOCUMENT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  )
}

function CommentField({ document, onDocumentChange }) {
  return (
    <textarea
      className={styles.commentField}
      rows="2"
      value={document.comment}
      placeholder="Optional document comment"
      aria-label={`Comment for ${document.name}`}
      onChange={(event) => onDocumentChange(document.id, { comment: event.target.value })}
    />
  )
}

function DocumentIdentity({ document }) {
  return (
    <div className={styles.documentIdentity}>
      <div className={styles.documentNameRow}>
        <strong>{document.name}</strong>
        {document.isKey && <span className={styles.keyBadge}>Key</span>}
      </div>
      <p>{document.description}</p>
    </div>
  )
}

function DocumentChecklist({ documents, onDocumentChange }) {
  return (
    <>
      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Quantity</th>
              <th>Comment</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>
                  <DocumentIdentity document={document} />
                </td>
                <td>
                  <StatusField document={document} onDocumentChange={onDocumentChange} />
                </td>
                <td>
                  <QuantityField document={document} onDocumentChange={onDocumentChange} />
                </td>
                <td>
                  <CommentField document={document} onDocumentChange={onDocumentChange} />
                </td>
                <td>
                  <div className={styles.updatedInformation}>
                    <span>{document.updatedBy}</span>
                    <time dateTime={document.updatedAt}>
                      {formatDateTime(document.updatedAt)}
                    </time>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileList}>
        {documents.map((document) => (
          <article className={styles.documentCard} key={document.id}>
            <DocumentIdentity document={document} />

            <div className={styles.mobileFields}>
              <label>
                <span>Status</span>
                <StatusField document={document} onDocumentChange={onDocumentChange} />
              </label>

              <label>
                <span>Quantity</span>
                <QuantityField document={document} onDocumentChange={onDocumentChange} />
              </label>

              <label className={styles.mobileComment}>
                <span>Comment</span>
                <CommentField document={document} onDocumentChange={onDocumentChange} />
              </label>
            </div>

            <p className={styles.mobileUpdated}>
              Updated by {document.updatedBy} · {formatDateTime(document.updatedAt)}
            </p>
          </article>
        ))}
      </div>
    </>
  )
}

export default DocumentChecklist
