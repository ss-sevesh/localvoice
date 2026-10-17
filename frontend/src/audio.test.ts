import { describe, expect, it, vi } from 'vitest'
import { AudioPlayer, encodePCM } from './audio'

describe('audio transport and playback', () => {
  it('encodes bounded little endian PCM samples', () => {
    const bytes = Uint8Array.from(atob(encodePCM(new Float32Array([-2, 0, 2]))), c => c.charCodeAt(0))
    const view = new DataView(bytes.buffer)
    expect([view.getInt16(0, true), view.getInt16(2, true), view.getInt16(4, true)]).toEqual([-32767, 0, 32767])
  })

  it('does not start or acknowledge audio decoded after an interruption', async () => {
    let resolve!: (audio: AudioBuffer) => void
    const createBufferSource = vi.fn()
    const context = {
      decodeAudioData: () => new Promise<AudioBuffer>(done => { resolve = done }),
      createBufferSource,
    } as unknown as AudioContext
    const played = vi.fn()
    const player = new AudioPlayer(context, vi.fn(), played, vi.fn(), vi.fn())
    player.enqueue({ wav: btoa('wav'), turn: 1, index: 0 })
    player.stop()
    resolve({} as AudioBuffer)
    await Promise.resolve()
    expect(createBufferSource).not.toHaveBeenCalled()
    expect(played).not.toHaveBeenCalled()
    expect(player.busy).toBe(false)
  })

  it('acknowledges a chunk only after playback finishes', async () => {
    const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null }
    const context = { decodeAudioData: async () => ({}), createBufferSource: () => source } as unknown as AudioContext
    const played = vi.fn()
    const player = new AudioPlayer(context, vi.fn(), played, vi.fn(), vi.fn())
    player.enqueue({ wav: btoa('wav'), turn: 3, index: 0 })
    await Promise.resolve()
    expect(played).not.toHaveBeenCalled()
    source.onended!()
    expect(played).toHaveBeenCalledWith(3, 0)
  })
})
