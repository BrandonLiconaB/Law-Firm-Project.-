import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAppData } from '../../../app/providers/useAppData.js'
import PlaceholderPage from '../../../components/common/PlaceholderPage.jsx'
import UnsavedChangesDialog from '../../../components/common/UnsavedChangesDialog.jsx'
import Button from '../../../components/ui/Button.jsx'
import ButtonLink from '../../../components/ui/ButtonLink.jsx'
import StatusBadge from '../../../components/ui/StatusBadge.jsx'
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning.js'
import DocumentChecklist from '../../documents/components/DocumentChecklist.jsx'
import { isDocumentResolved } from '../../documents/constants/documentStatuses.js'
import { MATTER_STATUSES } from '../constants/matterStatuses.js'
import { calculateMatterStatus } from '../utils/calculateMatterStatus.js'
import styles from './MatterDetailPage.module.css'

function formatDateTime(dateTime) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateTime))
}

function MatterDetail({
  matter,
  matterRecord,
  matterTypeName,
  notice,
  onSave,
}) {
  const [documents, setDocuments] = useState(() =>
    matterRecord.documents.map((document) => ({ ...document })),
  )
  const [statusMode, setStatusMode] = useState(matter.statusSource)
  const [manualMatterStatus, setManualMatterStatus] = useState(matter.status)
  const [statusUpdatedAt, setStatusUpdatedAt] = useState(matter.statusUpdatedAt)
  const [statusHistory, setStatusHistory] = useState(() =>
    matterRecord.history.map((entry) => ({ ...entry })),
  )
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const navigationBlocker = useUnsavedChangesWarning(hasUnsavedChanges)

  const automaticMatterStatus = useMemo(
    () => calculateMatterStatus(documents),
    [documents],
  )
  const currentMatterStatus =
    statusMode === 'Manual' ? manualMatterStatus : automaticMatterStatus
  const resolvedDocuments = documents.filter((document) =>
    isDocumentResolved(document.status),
  ).length
  const resolvedKeyDocuments = documents.filter(
    (document) => document.isKey && isDocumentResolved(document.status),
  ).length
  const keyDocumentCount = documents.filter((document) => document.isKey).length
  const completionPercentage = Math.round((resolvedDocuments / documents.length) * 100)

  function addHistoryEntry(fromStatus, toStatus, source, changedAt) {
    setStatusHistory((currentHistory) => [
      {
        id: `status-${Date.now()}`,
        fromStatus,
        toStatus,
        changedBy: source === 'Automatic' ? 'System' : 'Administrator',
        changedAt,
        source,
      },
      ...currentHistory,
    ])
  }

  function handleDocumentChange(documentId, changes) {
    const changedAt = new Date().toISOString()
    const previousAutomaticStatus = calculateMatterStatus(documents)
    const nextDocuments = documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            ...changes,
            updatedBy: 'Administrator',
            updatedAt: changedAt,
          }
        : document,
    )

    setDocuments(nextDocuments)
    setHasUnsavedChanges(true)
    setSaveMessage('')

    if (statusMode === 'Automatic') {
      const nextAutomaticStatus = calculateMatterStatus(nextDocuments)

      if (previousAutomaticStatus !== nextAutomaticStatus) {
        setStatusUpdatedAt(changedAt)
        addHistoryEntry(
          previousAutomaticStatus,
          nextAutomaticStatus,
          'Automatic',
          changedAt,
        )
      }
    }
  }

  function handleStatusModeChange(event) {
    const nextStatusMode = event.target.value

    if (nextStatusMode === statusMode) {
      return
    }

    if (nextStatusMode === 'Manual') {
      setManualMatterStatus(currentMatterStatus)
    } else if (automaticMatterStatus !== currentMatterStatus) {
      const changedAt = new Date().toISOString()

      addHistoryEntry(
        currentMatterStatus,
        automaticMatterStatus,
        'Automatic',
        changedAt,
      )
      setStatusUpdatedAt(changedAt)
    }

    setStatusMode(nextStatusMode)
    setHasUnsavedChanges(true)
    setSaveMessage('')
  }

  function handleMatterStatusChange(event) {
    const nextStatus = event.target.value
    const changedAt = new Date().toISOString()

    if (nextStatus !== currentMatterStatus) {
      addHistoryEntry(currentMatterStatus, nextStatus, 'Manual', changedAt)
      setStatusUpdatedAt(changedAt)
    }

    setManualMatterStatus(nextStatus)
    setHasUnsavedChanges(true)
    setSaveMessage('')
  }

  function handleSave() {
    onSave({
      documents,
      history: statusHistory,
      status: currentMatterStatus,
      statusSource: statusMode,
      statusUpdatedAt,
    })
    setHasUnsavedChanges(false)
    setSaveMessage('Changes saved for this preview session. They will reset after a refresh.')
  }

  return (
    <section className={styles.page}>
      {notice && (
        <div className={styles.createdNotice} role="status">
          {notice}
        </div>
      )}

      <div className={styles.previewNotice} role="status">
        Preview data only. Changes on this page are not connected to a database yet.
      </div>

      <Link className={styles.backLink} to="/matters">
        ← Back to matters
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Matter record</p>
          <h1>{matter.matterName}</h1>
          <p className={styles.matterType}>{matterTypeName}</p>
        </div>

        <div className={styles.headerActions}>
          <ButtonLink to={`/matters/${matter.id}/edit`} variant="secondary">
            Edit matter
          </ButtonLink>
          <Button disabled={!hasUnsavedChanges} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </header>

      {saveMessage && <p className={styles.saveMessage}>{saveMessage}</p>}

      <div className={styles.overviewGrid}>
        <article className={styles.statusCard}>
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.cardLabel}>Current status</p>
              <StatusBadge status={currentMatterStatus} />
            </div>
            <span className={styles.statusSource}>
              {statusMode}
            </span>
          </div>

          <div className={styles.statusControls}>
            <label className={styles.statusField}>
              <span>Status mode</span>
              <select value={statusMode} onChange={handleStatusModeChange}>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual override</option>
              </select>
            </label>

            {statusMode === 'Manual' && (
              <label className={styles.statusField}>
                <span>Manual matter status</span>
                <select
                  value={manualMatterStatus}
                  onChange={handleMatterStatusChange}
                >
                  {MATTER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <p className={styles.statusHelp}>
            {statusMode === 'Automatic'
              ? 'Document changes automatically determine the workflow through Ready to Draft.'
              : 'Document changes will not alter the manually selected status.'}
          </p>
          <p className={styles.statusUpdated}>
            Last status change: {formatDateTime(statusUpdatedAt)}
          </p>
        </article>

        <article className={styles.progressCard}>
          <p className={styles.cardLabel}>Document overview</p>
          <div className={styles.progressOverview}>
            <div>
              <strong>
                {resolvedDocuments} of {documents.length} resolved
              </strong>
              <p>
                {resolvedKeyDocuments} of {keyDocumentCount} key documents resolved
              </p>
            </div>
            <div
              className={styles.progressRing}
              style={{ '--completion': `${completionPercentage}%` }}
              aria-hidden="true"
            >
              <span>{completionPercentage}%</span>
            </div>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Resolved documents"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={completionPercentage}
          >
            <span style={{ width: `${completionPercentage}%` }} />
          </div>
          <p className={styles.nonBlockingNote}>
            Document quantities are informational and never block status changes.
          </p>
        </article>
      </div>

      <section className={styles.checklistSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.cardLabel}>Document checklist</p>
            <h2>Required documents</h2>
          </div>
          <p>
            Comments are optional and must only describe document delivery. Legal notes
            remain in the firm’s existing system.
          </p>
        </div>

        <DocumentChecklist
          documents={documents}
          onDocumentChange={handleDocumentChange}
        />
      </section>

      <section className={styles.historySection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.cardLabel}>Audit trail</p>
            <h2>Status history</h2>
          </div>
        </div>

        <ol className={styles.historyList}>
          {statusHistory.map((entry) => (
            <li key={entry.id}>
              <span className={styles.historyMarker} aria-hidden="true" />
              <div>
                <strong>{entry.toStatus}</strong>
                <p>
                  {entry.fromStatus
                    ? `Changed from ${entry.fromStatus}`
                    : 'Initial matter status'}
                </p>
                <span>
                  {entry.changedBy} · {entry.source} · {formatDateTime(entry.changedAt)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <UnsavedChangesDialog blocker={navigationBlocker} />
    </section>
  )
}

function MatterDetailPage() {
  const { matterId } = useParams()
  const location = useLocation()
  const { matterRecords, matterTypes, matters, saveMatterChanges } = useAppData()
  const matter = matters.find((item) => item.id === matterId)
  const matterRecord = matterRecords[matterId]
  const matterType = matterTypes.find(
    (currentMatterType) => currentMatterType.id === matter?.matterTypeId,
  )

  if (!matter || !matterRecord) {
    return (
      <PlaceholderPage
        eyebrow="Matter details"
        title="Matter not found"
        description="The requested matter does not exist in the preview data."
      />
    )
  }

  return (
    <MatterDetail
      key={matter.id}
      matter={matter}
      matterRecord={matterRecord}
      matterTypeName={matterType?.name ?? 'Unknown matter type'}
      notice={location.state?.notice}
      onSave={(changes) => saveMatterChanges(matter.id, changes)}
    />
  )
}

export default MatterDetailPage
