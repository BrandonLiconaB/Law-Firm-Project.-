import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import Button from '../../../components/ui/Button.jsx'
import RequestFeedback from '../../../components/common/RequestFeedback.jsx'
import { useAsyncAction } from '../../../hooks/useAsyncAction.js'
import { useAuth } from '../useAuth.js'
import styles from './AuthPage.module.css'

function LoginPage() {
  const { user, notice, session } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const action = useAsyncAction()
  if (user) {
    const from = location.state?.from
    const target = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !['/login', '/change-password'].includes(from)
      ? from : '/admin/templates'
    return <Navigate to={user.mustChangePassword ? '/change-password' : target} replace />
  }
  async function handleSubmit(event) {
    event.preventDefault()
    await action.run(async () => {
      try { await session.login({ username, password }) } finally { setPassword('') }
    })
  }
  return <div className={styles.page}><section className={styles.card}>
    <p className={styles.brand}>Gestor documental</p>
    <h1>Welcome back</h1>
    <p className={styles.description}>Sign in with the username and password provided by your administrator.</p>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <RequestFeedback error={action.error} />
    <form className={styles.form} onSubmit={handleSubmit} aria-busy={action.isPending}>
      <label className={styles.field} htmlFor="login-username">Username
        <input id="login-username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64}
          value={username} disabled={action.isPending} onChange={(event) => setUsername(event.target.value)} />
      </label>
      <label className={styles.field} htmlFor="login-password">Password
        <input id="login-password" type="password" autoComplete="current-password" required maxLength={128}
          value={password} disabled={action.isPending} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <Button type="submit" disabled={action.isPending}>{action.isPending ? 'Signing in…' : 'Sign in'}</Button>
    </form>
  </section></div>
}

export default LoginPage
