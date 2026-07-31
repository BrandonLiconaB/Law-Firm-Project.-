import { useContext } from 'react'
import { AppDataContext } from './AppDataContext.js'

export function useAppData() {
  const context = useContext(AppDataContext)

  if (context === null) {
    throw new Error('useAppData must be used inside AppDataProvider')
  }

  return context
}
