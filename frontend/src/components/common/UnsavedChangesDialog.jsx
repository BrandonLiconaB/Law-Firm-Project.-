import { useEffect, useRef } from 'react'
import Button from '../ui/Button.jsx'
import styles from './UnsavedChangesDialog.module.css'

function UnsavedChangesDialog({ blocker }) {
  const dialogRef = useRef(null)
  const isBlocked = blocker.state === 'blocked'

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (isBlocked && !dialog.open) {
      dialog.showModal()
    } else if (!isBlocked && dialog.open) {
      dialog.close()
    }
  }, [isBlocked])

  function handleCancel(event) {
    event.preventDefault()
    blocker.reset()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-description"
      onCancel={handleCancel}
    >
      <div className={styles.content}>
        <p className={styles.eyebrow}>Unsaved changes</p>
        <h2 id="unsaved-changes-title">Leave without saving?</h2>
        <p id="unsaved-changes-description" className={styles.description}>
          Document, comment, quantity, or status changes made on this page will be
          discarded.
        </p>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => blocker.reset()}>
            Stay on page
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed()}>
            Discard changes
          </Button>
        </div>
      </div>
    </dialog>
  )
}

export default UnsavedChangesDialog
