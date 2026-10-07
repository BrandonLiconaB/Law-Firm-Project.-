import { useEffect } from 'react'
import { useAppData } from '../../app/providers/useAppData.js'

export function useTemplate(id) {
  const { templates, loadTemplate } = useAppData()
  useEffect(() => { loadTemplate(id).catch(() => {}) }, [id, loadTemplate])
  return { ...(templates[id] ?? { status: 'Loading', data: null, error: null }),
    retry: () => { loadTemplate(id).catch(() => {}) } }
}
