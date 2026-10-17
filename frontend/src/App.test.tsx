import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'

const actions = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), clear: vi.fn(), interrupt: vi.fn() }))
vi.mock('./client', () => ({ VoiceClient: class {
  start = actions.start
  stop = actions.stop
  clear = actions.clear
  interrupt = actions.interrupt
} }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('voice interface', () => {
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
