import { expect, it, vi } from 'vitest'
import type { MicVAD } from '@ricky0123/vad-web'
import { disposeVad } from './vad-cleanup'

it('releases a loaded model when microphone permission was denied', async () => {
  const release = vi.fn()
  const destroy = vi.fn().mockRejectedValue(new Error('null stream'))
  const vad = { model: { release }, destroy, _stream: null } as unknown as MicVAD
  await disposeVad(vad)
  expect(release).toHaveBeenCalledOnce()
  expect(destroy).not.toHaveBeenCalled()
})

it('stops acquired tracks and closes the owned context after worklet setup fails', async () => {
  const stop = vi.fn(), close = vi.fn(), release = vi.fn()
  const vad = {
    model: { release }, _stream: { getTracks: () => [{ stop }] },
    _audioContext: { close, state: 'running' }, ownsAudioContext: true,
  } as unknown as MicVAD
  await disposeVad(vad)
  expect(stop).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
  expect(release).toHaveBeenCalledOnce()
})
