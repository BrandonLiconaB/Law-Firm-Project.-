import { useEffect } from 'react'
import { useUsers } from './useUsers.js'

export function useUser(id) {
  const { details, loadUser } = useUsers()
  useEffect(() => { loadUser(id) }, [id, loadUser])
  const resource = details[id]
  return { status: resource?.status ?? 'Loading', user: resource?.data ?? null,
    error: resource?.error ?? null, retry: () => loadUser(id) }
}
