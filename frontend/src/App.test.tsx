import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import type { Action } from './state'

const actions = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), clear: vi.fn(), interrupt: vi.fn(), language: vi.fn() }))
const events = vi.hoisted(() => ({ dispatch: undefined as ((action: Action) => void) | undefined }))
vi.mock('./client', () => ({ VoiceClient: class {
  constructor(dispatch: (action: Action) => void) { events.dispatch = dispatch }
  start = actions.start
  stop = actions.stop
  clear = actions.clear
  interrupt = actions.interrupt
  set inputLanguage(value: string) { actions.language(value) }
} }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('voice interface', () => {
  it('animates the voice only during assistant playback and stops on interruption', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ready: true, error: null, models: {},
    }) }))
    const { container } = render(<App />)
    const animated = () => container.querySelectorAll('.wave-mark.is-speaking')
    act(() => {
      events.dispatch!({ type: 'active', value: true })
      events.dispatch!({ type: 'begin', turn: 0 })
      events.dispatch!({ type: 'server', event: { type: 'text_delta', turn_id: 0, text: 'Earlier reply.' } })
      events.dispatch!({ type: 'complete' })
      events.dispatch!({ type: 'begin', turn: 1 })
      events.dispatch!({ type: 'server', event: { type: 'text_delta', turn_id: 1, text: 'Hello.' } })
      events.dispatch!({ type: 'phase', value: 'generating' })
    })
    expect(animated()).toHaveLength(0)
    act(() => events.dispatch!({ type: 'phase', value: 'speaking' }))
    expect(animated()).toHaveLength(2)
    act(() => events.dispatch!({ type: 'mic', value: true }))
    expect(animated()).toHaveLength(0)
    act(() => events.dispatch!({ type: 'mic', value: false }))
    expect(animated()).toHaveLength(2)
    act(() => events.dispatch!({ type: 'interrupt' }))
    expect(animated()).toHaveLength(0)
  })

  it('lets the user override recognition language before starting', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ready: false, error: null, models: {},
    }) }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Hindi / Hinglish' }))
    expect(actions.language).toHaveBeenLastCalledWith('hi')
    expect(screen.getByRole('button', { name: 'Hindi / Hinglish' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('enables the voice action only after model readiness and calls start', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ready: true, error: null, models: { stt: 'Whisper', llm: 'Qwen', tts: 'Piper' },
    }) }))
    const { unmount } = render(<App />)
    const start = await screen.findByRole('button', { name: 'Start conversation' })
    await screen.findByText('All models local')
    expect(start).toBeEnabled()
    fireEvent.click(start)
    expect(actions.start).toHaveBeenCalledOnce()
    unmount()
    expect(actions.stop).toHaveBeenCalledOnce()
  })

  it('shows model setup errors without enabling recording', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ready: false, error: 'Whisper missing', models: {},
    }) }))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Whisper missing')
    expect(screen.getByRole('button', { name: 'Start conversation' })).toBeDisabled()
  })
})
