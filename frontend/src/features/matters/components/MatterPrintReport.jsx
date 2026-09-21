import DocumentSummaryTable from '../../documents/components/DocumentSummaryTable.jsx'
import { countDocumentStatuses, formatReportDate } from '../../documents/utils/documentReport.js'
import { groupDocumentsBySection } from '../../templates/utils/groupDocumentsBySection.js'
import styles from './MatterPrintReport.module.css'

function MatterPrintReport({
  matterNumber,
  matterTypeName,
  status,
  statusMode,
  statusUpdatedAt,
  documents,
  sections,
  previousDocuments = [],
  hasUnsavedChanges,
  printedAt,
}) {
  const counts = countDocumentStatuses(documents)
  const groups = groupDocumentsBySection(documents, sections)

  return (
    <article className={styles.report} data-matter-print-report>
      <header className={styles.header}>
        <p>Gestor documental · Document status report</p>
        <h1>Matter {matterNumber}</h1>
        <p>{matterTypeName}</p>
        <dl className={styles.details}>
          <div>
            <dt>Current status</dt>
            <dd>{status} · {statusMode}</dd>
          </div>
          <div>
            <dt>Last status change</dt>
            <dd>{formatReportDate(statusUpdatedAt)}</dd>
          </div>
          <div>
            <dt>Report generated</dt>
            <dd>{formatReportDate(printedAt)}</dd>
          </div>
        </dl>
        {hasUnsavedChanges && (
          <p className={styles.notice}>Unsaved changes included. Printing does not save these changes.</p>
        )}
      </header>

      <section aria-label="Document summary">
        <h2>Active requirements · {documents.length} documents</h2>
        <dl className={styles.counts}>
          {Object.entries(counts).map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.note}>
          Counts are per requirement, not per item. Quantities are informational.
          Client Does Not Have and Not Applicable are not counted as Received.
        </p>
      </section>

      {groups.length === 0 && <p>No active requirements.</p>}
      {groups.map((group) => (
        <section key={group.id} className={styles.group}>
          <h2>{group.name} · {group.documents.length}</h2>
          <DocumentSummaryTable documents={group.documents} />
        </section>
      ))}

      {previousDocuments.length > 0 && (
        <section className={styles.group}>
          <h2>Previous requirements · {previousDocuments.length}</h2>
          <p className={styles.note}>
            Removed from the template. Retained for reference and excluded from active counts and workflow calculations.
          </p>
          <DocumentSummaryTable documents={previousDocuments} previous />
        </section>
      )}
      <footer className={styles.footer}>
        Internal document tracking only · Frontend preview data
      </footer>
    </article>
  )
}

export default MatterPrintReport
