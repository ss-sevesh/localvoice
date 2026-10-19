import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import Background from './Background'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('plays a silent decorative video and lets the user stop it', () => {
  const { container } = render(<Background />)
  const video = container.querySelector('video')!
  expect(video.muted).toBe(true)
  expect(video.autoplay && video.loop && video.playsInline).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Pause background' }))
  expect(container.querySelector('video')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Play background' }))
  expect(container.querySelector('video')).not.toBeNull()
})

it('uses the still image for reduced motion and follows preference changes', () => {
  const preference = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(() => preference))
  const { container, unmount } = render(<Background />)
  expect(container.querySelector('video')).toBeNull()
  expect(screen.getByRole('button', { name: 'Play background' })).toHaveAttribute('aria-pressed', 'false')
  const update = preference.addEventListener.mock.calls[0][1]
  act(() => { preference.matches = false; update() })
  expect(container.querySelector('video')).not.toBeNull()
  unmount()
  expect(preference.removeEventListener).toHaveBeenCalledWith('change', update)
})
