import { useId, useState } from 'react'
import { groupDocumentsBySection } from '../../templates/utils/groupDocumentsBySection.js'
import {
  DOCUMENT_STATUSES,
  isDocumentResolved,
} from '../constants/documentStatuses.js'
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
      data-status={document.status}
      value={document.status}
      aria-label={`Status for ${document.name}`}
      onChange={(event) =>
        onDocumentChange(document.id, { status: event.target.value })
      }
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
      onChange={(event) =>
        onDocumentChange(document.id, { comment: event.target.value })
      }
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

function DocumentTable({ documents, onDocumentChange }) {
  return (
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
            <tr key={document.id} data-status={document.status}>
              <td>
                <DocumentIdentity document={document} />
              </td>
              <td>
                <StatusField
                  document={document}
                  onDocumentChange={onDocumentChange}
                />
              </td>
              <td>
                <QuantityField
                  document={document}
                  onDocumentChange={onDocumentChange}
                />
              </td>
              <td>
                <CommentField
                  document={document}
                  onDocumentChange={onDocumentChange}
                />
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
  )
}

function DocumentMobileList({ documents, onDocumentChange }) {
  return (
    <div className={styles.mobileList}>
      {documents.map((document) => (
        <article
          className={styles.documentCard}
          key={document.id}
          data-status={document.status}
        >
          <DocumentIdentity document={document} />

          <div className={styles.mobileFields}>
            <label>
              <span>Status</span>
              <StatusField
                document={document}
                onDocumentChange={onDocumentChange}
              />
            </label>

            <label>
              <span>Quantity</span>
              <QuantityField
                document={document}
                onDocumentChange={onDocumentChange}
              />
            </label>

            <label className={styles.mobileComment}>
              <span>Comment</span>
              <CommentField
                document={document}
                onDocumentChange={onDocumentChange}
              />
            </label>
          </div>

          <p className={styles.mobileUpdated}>
            Updated by {document.updatedBy} · {formatDateTime(document.updatedAt)}
          </p>
        </article>
      ))}
    </div>
  )
}

function DocumentCollection({ documents, onDocumentChange }) {
  return (
    <>
      <DocumentTable
        documents={documents}
        onDocumentChange={onDocumentChange}
      />
      <DocumentMobileList
        documents={documents}
        onDocumentChange={onDocumentChange}
      />
    </>
  )
}

function DocumentSection({ group, onDocumentChange }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const contentId = useId()
  const resolvedDocuments = group.documents.filter((document) =>
    isDocumentResolved(document.status),
  ).length
  const keyDocumentCount = group.documents.filter(
    (document) => document.isKey,
  ).length

  return (
    <section className={styles.documentSection}>
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
            {resolvedDocuments} of {group.documents.length} resolved ·{' '}
            {keyDocumentCount} key
          </span>
        </span>
        <span className={styles.sectionProgress}>
          {resolvedDocuments}/{group.documents.length}
        </span>
      </button>

      {isExpanded && (
        <div className={styles.sectionContent} id={contentId}>
          <DocumentCollection
            documents={group.documents}
            onDocumentChange={onDocumentChange}
          />
        </div>
      )}
    </section>
  )
}

function DocumentChecklist({ documents, sections = [], onDocumentChange }) {
  if (sections.length === 0) {
    return (
      <DocumentCollection
        documents={documents}
        onDocumentChange={onDocumentChange}
      />
    )
  }

  const documentGroups = groupDocumentsBySection(documents, sections)

  return (
    <div className={styles.sectionGroups}>
      {documentGroups.map((group) => (
        <DocumentSection
          key={group.id}
          group={group}
          onDocumentChange={onDocumentChange}
        />
      ))}
    </div>
  )
}

export default DocumentChecklist
