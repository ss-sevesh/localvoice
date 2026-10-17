import type { MicVAD } from '@ricky0123/vad-web'

// vad-web 0.0.31 destroy() assumes initialization succeeded. This narrow adapter
// also releases its ONNX session after permission/worklet failure; revisit on upgrade.
type VadInternals = {
  model: { release: () => Promise<void> }
  _stream?: MediaStream | null
  _audioContext?: AudioContext | null
  _vadNode?: AudioNode | null
  _mediaStreamAudioSourceNode?: MediaStreamAudioSourceNode | null
  ownsAudioContext?: boolean
}

export async function disposeVad(vad: MicVAD) {
  const resources = vad as unknown as VadInternals
  const { _stream: stream, _audioContext: context } = resources
  try {
    if (stream && context && resources._vadNode && resources._mediaStreamAudioSourceNode) {
      await vad.destroy()
    } else {
      resources._mediaStreamAudioSourceNode?.disconnect()
      resources._vadNode?.disconnect()
      await resources.model.release()
    }
  } finally {
    stream?.getTracks().forEach(track => track.stop())
    if (resources.ownsAudioContext && context && context.state !== 'closed') await context.close()
  }
}
