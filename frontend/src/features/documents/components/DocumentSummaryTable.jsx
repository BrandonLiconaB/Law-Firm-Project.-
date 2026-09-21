import { formatDocumentQuantity, formatReportDate } from '../utils/documentReport.js'
import styles from './DocumentSummaryTable.module.css'

function DocumentSummaryTable({ documents, previous = false }) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Status</th>
            <th scope="col">Received / expected</th>
            <th scope="col">Delivery comment</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <strong>{document.name}</strong>
                {document.isKey && <span className={styles.key}>Key document</span>}
                {document.description && <p>{document.description}</p>}
                {previous && (
                  <small>
                    {document.previousSectionName} · Removed {formatReportDate(document.removedAt)}
                  </small>
                )}
              </td>
              <td>{document.status}</td>
              <td>{formatDocumentQuantity(document)}</td>
              <td>
                <p className={styles.comment}>{document.comment || '—'}</p>
                <small>
                  Updated by {document.updatedBy} · {formatReportDate(document.updatedAt)}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DocumentSummaryTable
