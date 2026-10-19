import { useEffect, useRef, useState } from 'react'
import App from './App'
import AuthPage from './AuthPage'
import Landing from './Landing'
import { accountRequest } from './auth'
import type { User } from './auth'

export default function Portal() {
  const [route, setRoute] = useState(location.hash)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const content = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    accountRequest('session').then(user => { if (active) setUser(user) })
      .catch(() => { if (active) setError('Cannot reach the local server. Check that it is running, then refresh.') })
      .finally(() => { if (active) setLoading(false) })
    const navigate = () => { setRoute(location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', navigate)
    return () => { active = false; window.removeEventListener('hashchange', navigate) }
  }, [])

  useEffect(() => {
    if (route.startsWith('#/')) content.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [route, loading, user])

  async function logout() {
    try {
      await accountRequest('logout')
      setUser(null)
      setError('')
      location.hash = '#/login'
    } catch { setError('Could not log out. Check the local server and try again.') }
  }

  const success = (user: User) => { setUser(user); setError(''); location.hash = '#/app' }
  const workspace = route === '#/app'
  return <div ref={content}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); content.current?.querySelector('main')?.focus() }}>Skip to content</a>
    {error && <p className="connection-banner" role="alert">{error}</p>}
    {loading && (workspace || route === '#/login' || route === '#/signup') ? <div className="session-loading" role="status">Opening your space…</div>
      : workspace && user ? <App user={user} onLogout={() => void logout()} />
      : route === '#/login' || route === '#/signup' || workspace
        ? <AuthPage key={route} signup={route === '#/signup'} onSuccess={success} />
        : <Landing user={user} />}
  </div>
}
