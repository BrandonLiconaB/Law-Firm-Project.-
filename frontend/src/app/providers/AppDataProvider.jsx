import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../../features/auth/useAuth.js'
import { createCatalogStore } from '../../features/catalog/catalogStore.js'
import { AppDataContext } from './AppDataContext.js'

function AppDataProvider({ children }) {
  const { api } = useAuth()
  const [store] = useState(() => createCatalogStore(api))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    store.activate()
    store.loadCatalog()
    return () => store.dispose()
  }, [store])
  return <AppDataContext.Provider value={{ ...store, ...snapshot }}>{children}</AppDataContext.Provider>
}

export default AppDataProvider
