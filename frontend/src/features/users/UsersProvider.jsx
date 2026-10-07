import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { createUsersStore } from './services/usersStore.js'
import { UsersContext } from './UsersContext.js'

function UsersProvider() {
  const { api } = useAuth()
  const [store] = useState(() => createUsersStore(api))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  // Activate before the pages' passive effects, including a StrictMode remount.
  useLayoutEffect(() => {
    store.activate()
    return () => store.dispose()
  }, [store])
  return <UsersContext.Provider value={{ ...store, ...snapshot }}><Outlet /></UsersContext.Provider>
}

export default UsersProvider
