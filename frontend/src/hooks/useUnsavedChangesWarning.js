import { useCallback } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

export function useUnsavedChangesWarning(hasUnsavedChanges) {
  const shouldBlockNavigation = useCallback(
    () => hasUnsavedChanges,
    [hasUnsavedChanges],
  )
  const blocker = useBlocker(shouldBlockNavigation)

  const handleBeforeUnload = useCallback(
    (event) => {
      if (!hasUnsavedChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    },
    [hasUnsavedChanges],
  )

  useBeforeUnload(handleBeforeUnload)

  return blocker
}
