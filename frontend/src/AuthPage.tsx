import { useState } from 'react'
import type { FormEvent } from 'react'
import Background from './Background'
import Brand from './Brand'
import { accountRequest } from './auth'
import type { User } from './auth'

export default function AuthPage({ signup, onSuccess }: { signup: boolean; onSuccess: (user: User) => void }) {
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    setPending(true)
    setError('')
    try {
      const user = await accountRequest(signup ? 'signup' : 'login', data)
      if (!user) throw new Error('Unable to open your account. Please try again.')
      onSuccess(user)
    } catch (error) {
      setError(error instanceof Error && error.message !== 'Failed to fetch' ? error.message : 'Cannot reach the local server. Check that it is running and try again.')
    } finally { setPending(false) }
  }

  return <div className="app-shell account-shell">
    <Background />
    <header className="site-header"><Brand /><a href="#/" className="quiet-link"><span aria-hidden="true">←</span> Back to home</a></header>
    <main className="account-main" id="main-content" tabIndex={-1}>
      <section className="account-story" aria-label="Your thinking space"><p className="eyebrow">A LITTLE SPACE TO THINK</p><h2>Your next great thought<br />starts with a<br /><em>simple hello.</em></h2><p>A quiet corner for your ideas.<br />A conversation that stays close.</p><div className="account-story-footer"><span className="tiny-dot" /> Local inference. Natural conversation.</div></section>
      <section className="account-card" aria-labelledby="account-title">
        <p className="eyebrow">{signup ? 'MAKE ROOM FOR YOUR IDEAS' : 'YOUR SPACE IS RIGHT HERE'}</p>
        <h1 id="account-title" tabIndex={-1}>{signup ? 'Make yourself at home.' : 'Welcome back.'}</h1>
        <p className="account-intro">{signup ? 'Create your account. Let your thoughts unfold.' : 'A fresh conversation is just a hello away.'}</p>
        <form onSubmit={event => void submit(event)} aria-busy={pending}>
          <fieldset disabled={pending}>
            {signup && <div className="form-field"><label htmlFor="account-name">Your name</label><input id="account-name" name="name" autoComplete="name" placeholder="What should we call you?" required minLength={2} maxLength={80} /></div>}
            <div className="form-field"><label htmlFor="account-email">Email address</label><input id="account-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></div>
            <div className="form-field"><label htmlFor="account-password">Password</label><div className="password-field"><input id="account-password" name="password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : 1} maxLength={128} aria-describedby={signup ? 'password-hint' : undefined} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button></div>{signup && <small id="password-hint">Use at least 12 characters. A phrase works well.</small>}</div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button-link form-submit" type="submit">{pending ? 'Opening your space…' : signup ? 'Create account' : 'Log in'} {!pending && <span aria-hidden="true">↗</span>}</button>
          </fieldset>
        </form>
        <p className="account-switch">{signup ? 'Already have an account?' : 'New around here?'} <a href={signup ? '#/login' : '#/signup'}>{signup ? 'Log in' : 'Create an account'}</a></p>
        <p className="account-note"><span aria-hidden="true">⌁</span> Your account stays on this machine.<br />No email verification or password recovery.</p>
      </section>
    </main>
    <footer className="account-footer"><span>Local Voice · English, Hindi & Hinglish</span><span>Your thoughts belong to you.</span></footer>
  </div>
}
