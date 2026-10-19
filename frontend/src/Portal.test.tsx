import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Portal from './Portal'

vi.mock('./App', () => ({ default: ({ onLogout }: { onLogout: () => void }) => <main><h1 tabIndex={-1}>Voice workspace</h1><button onClick={onLogout}>Log out</button></main> }))
beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); location.hash = '' })

it('shows the public landing and links to real account screens', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: null }) }))
  render(<Portal />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('big thoughts.')
  expect(screen.getByRole('link', { name: 'Find your thinking space' })).toHaveAttribute('href', '#/signup')
  await act(async () => { location.hash = '#/login'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
  expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
})

it('protects the workspace, handles login errors and logs out', async () => {
  location.hash = '#/app'
  const user = { name: 'Mira', email: 'mira@example.com' }
  const request = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/session') || url.endsWith('/logout')) return { ok: true, json: async () => ({ user: null }) }
    const body = JSON.parse(options?.body as string)
    return body.password === 'correct password' ? { ok: true, json: async () => ({ user }) }
      : { ok: false, json: async () => ({ detail: 'Email or password is incorrect.' }) }
  })
  vi.stubGlobal('fetch', request)
  vi.stubGlobal('scrollTo', vi.fn())
  render(<Portal />)
  await screen.findByRole('heading', { name: 'Welcome back.' })
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: user.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  expect(await screen.findByRole('heading', { name: 'Voice workspace' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible())
  expect(request.mock.calls.some(([url]) => url === '/api/auth/logout')).toBe(true)
})

it('restores an existing session on refresh', async () => {
  location.hash = '#/app'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { name: 'Mira', email: 'mira@example.com' } }) }))
  render(<Portal />)
  expect(await screen.findByRole('heading', { name: 'Voice workspace' })).toBeVisible()
})
