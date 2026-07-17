import styles from './StatusBadge.module.css'

const statusClassNames = {
  'Pending Documents': styles.pending,
  'Ready to Start Drafting': styles.readyStart,
  'Ready to Draft': styles.ready,
  'Ready to R/S': styles.review,
  'Pending Corrections': styles.correctionsPending,
  'Corrections Ready': styles.correctionsReady,
  Accepted: styles.accepted,
  Sent: styles.sent,
}

function StatusBadge({ status }) {
  const statusClassName = statusClassNames[status] ?? styles.neutral

  return <span className={`${styles.badge} ${statusClassName}`}>{status}</span>
}

export default StatusBadge
