import { useEffect, useState, useSyncExternalStore } from 'react'
import { AuthContext } from './AuthContext.js'
import { createAuthSession } from './services/authSession.js'

function AuthProvider({ children }) {
  const [session] = useState(() => createAuthSession({ baseUrl: import.meta.env.VITE_API_URL || '/api' }))
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  useEffect(() => { session.restore() }, [session])
  return <AuthContext.Provider value={{ ...snapshot, session, api: session.api }}>{children}</AuthContext.Provider>
}

export default AuthProvider
