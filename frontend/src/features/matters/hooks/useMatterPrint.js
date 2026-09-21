import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export function useMatterPrint() {
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    function updatePrintDate() {
      // Commit the current date before the browser captures its print preview.
      flushSync(() => setPrintedAt(new Date().toISOString()))
    }
    window.addEventListener('beforeprint', updatePrintDate)
    return () => window.removeEventListener('beforeprint', updatePrintDate)
  }, [])

  return { printedAt, printReport: () => window.print() }
}
