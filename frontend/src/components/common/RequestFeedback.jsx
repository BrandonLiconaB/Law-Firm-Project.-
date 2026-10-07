import Button from '../ui/Button.jsx'
import styles from './RequestFeedback.module.css'

function RequestFeedback({ error, loading = false, onRetry, message = 'Loading…' }) {
  if (loading) return <div className={styles.panel} role="status">{message}</div>
  if (!error) return null
  return (
    <div className={`${styles.panel} ${styles.error}`} role="alert">
      <p>{error.message || 'The request could not be completed.'}</p>
      {error.retryAfter && <p>Try again in {error.retryAfter} seconds.</p>}
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export default RequestFeedback
