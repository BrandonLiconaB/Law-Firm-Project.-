import { useRef, useState } from 'react'

export function useAsyncAction() {
  const active = useRef(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState(null)
  async function run(action) {
    if (active.current) return { ok: false }
    active.current = true
    setIsPending(true)
    setError(null)
    try { return { ok: true, data: await action() } } catch (failure) {
      setError(failure)
      return { ok: false, error: failure }
    } finally { active.current = false; setIsPending(false) }
  }
  return { run, isPending, error, clearError: () => setError(null) }
}
