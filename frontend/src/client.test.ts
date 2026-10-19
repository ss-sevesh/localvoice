import { afterEach, expect, it, vi } from 'vitest'
import type { RealTimeVADOptions } from '@ricky0123/vad-web'
import { VoiceClient } from './client'
import { encodePCM } from './audio'

const vad = vi.hoisted(() => ({ options: {} as Partial<RealTimeVADOptions> }))
vi.mock('@ricky0123/vad-web', () => ({ MicVAD: { new: async (options: RealTimeVADOptions) => {
  vad.options = options
  return { start: vi.fn(), model: { release: vi.fn() } }
} } }))

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

it('cancels at speech onset, keeps the entire audio, and never sends a VAD misfire', async () => {
  const frames: { type: string; pcm?: string }[] = []
  class Socket {
    static OPEN = 1
    readyState = 1
    onopen?: () => void
    constructor() { queueMicrotask(() => this.onopen?.()) }
    send(raw: string) { frames.push(JSON.parse(raw)) }
    close() {}
  }
  vi.stubGlobal('WebSocket', Socket)
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    resume = vi.fn()
    close = vi.fn().mockResolvedValue(undefined)
  })
  const client = new VoiceClient(vi.fn())
  try {
    await client.start()
    expect(vad.options.onnxWASMBasePath).toBe(new URL('/vad/', location.href).href)
    vad.options.onSpeechStart!()
    expect(frames.map(frame => frame.type)).toEqual(['cancel'])
    vad.options.onVADMisfire!()
    expect(frames).toHaveLength(1)
    vad.options.onSpeechStart!()
    vad.options.onSpeechRealStart!()
    const audio = new Float32Array([.8, -.6, .3, .1])
    vad.options.onSpeechEnd!(audio)
    expect(frames.map(frame => frame.type)).toEqual(['cancel', 'cancel', 'speech'])
    expect(frames.at(-1)?.pcm).toBe(encodePCM(audio))
  } finally { client.stop() }
})
