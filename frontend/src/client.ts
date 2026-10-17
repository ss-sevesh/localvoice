import type { MicVAD } from '@ricky0123/vad-web'
import { AudioPlayer, encodePCM } from './audio'
import type { Action, ServerEvent } from './state'
import { disposeVad } from './vad-cleanup'

/** Owns browser resources; React only observes their user-visible state. */
export class VoiceClient {
  private socket: WebSocket | null = null
  private vad: MicVAD | null = null
  private player: AudioPlayer | null = null
  private context: AudioContext | null = null
  private epoch = 0
  private nextTurn = 0
  private turn = -1
  private sentAt = 0
  private lastVoiceAt = 0
  private firstPlayed = false
  private serverDone = false
  private limitTimer: ReturnType<typeof setTimeout> | undefined
  private active = false
  private openingStream: MediaStream | null = null

  constructor(private dispatch: (action: Action) => void) {}

  private send(event: object) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event))
  }

  async start() {
    const epoch = ++this.epoch
    this.dispatch({ type: 'phase', value: 'connecting' })
    try {
      this.context = new AudioContext()
      await this.context.resume()
      if (epoch !== this.epoch) return
      this.player = new AudioPlayer(this.context,
        turn => {
          if (turn !== this.turn) return
          if (!this.firstPlayed) {
            this.firstPlayed = true
            this.dispatch({ type: 'metrics', value: { first_audible_ms: performance.now() - this.lastVoiceAt } })
          }
          this.dispatch({ type: 'phase', value: 'speaking' })
        },
        (turn, index) => this.send({ type: 'played', turn_id: turn, index }),
        () => this.finishIfIdle(),
        error => this.fail(error),
      )
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/conversation`)
      this.socket = socket
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = () => reject(new Error('Cannot connect to the local backend.'))
        socket.onclose = () => reject(new Error('The local backend closed the connection.'))
      })
      if (epoch !== this.epoch) return
      socket.onmessage = event => {
        try { this.handle(JSON.parse(event.data) as ServerEvent) }
        catch { this.fail(new Error('Received an invalid server response.')) }
      }
      socket.onclose = () => {
        if (epoch === this.epoch) this.fail(new Error('Connection lost. Start a new conversation to reconnect.'))
      }
      const { MicVAD } = await import('@ricky0123/vad-web')
      if (epoch !== this.epoch) return
      const vad = await MicVAD.new({
        ortConfig: ort => { ort.env.wasm.numThreads = 1; ort.env.logLevel = 'error' },
        model: 'v5', startOnLoad: false,
        baseAssetPath: '/vad/', onnxWASMBasePath: '/vad/',
        redemptionMs: 600, preSpeechPadMs: 300, minSpeechMs: 250,
        positiveSpeechThreshold: 0.6, negativeSpeechThreshold: 0.35,
        getStream: async () => {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
          } })
          if (epoch !== this.epoch) {
            stream.getTracks().forEach(track => track.stop())
            throw new DOMException('Microphone startup was cancelled.', 'AbortError')
          }
          this.openingStream = stream
          return stream
        },
        onFrameProcessed: (probability) => {
          if (epoch !== this.epoch) return
          if (probability.isSpeech > 0.35) this.lastVoiceAt = performance.now()
        },
        onSpeechRealStart: () => {
          if (epoch !== this.epoch || !this.active) return
          this.interrupt()
          this.dispatch({ type: 'mic', value: true })
          this.limitTimer = setTimeout(() => {
            this.fail(new Error('Recording reached 30 seconds. Start again with a shorter message.'))
          }, 30_000)
        },
        onVADMisfire: () => {
          if (epoch !== this.epoch) return
          this.dispatch({ type: 'mic', value: false })
        },
        onSpeechEnd: audio => {
          if (epoch !== this.epoch) return
          clearTimeout(this.limitTimer)
          if (!this.active) return
          this.dispatch({ type: 'mic', value: false })
          if (audio.length > 480_000) {
            this.fail(new Error('Recording exceeds 30 seconds. Please use shorter messages.'))
            return
          }
          this.turn = ++this.nextTurn
          this.sentAt = performance.now()
          this.serverDone = false
          this.firstPlayed = false
          this.dispatch({ type: 'begin', turn: this.turn })
          this.dispatch({ type: 'metrics', value: { endpoint_ms: this.sentAt - this.lastVoiceAt } })
          this.send({ type: 'speech', turn_id: this.turn, pcm: encodePCM(audio) })
        },
      })
      if (epoch !== this.epoch) { await disposeVad(vad); return }
      try {
        await vad.start()
      } catch (error) {
        await disposeVad(vad)
        throw error
      }
      if (epoch !== this.epoch) { await disposeVad(vad); return }
      this.vad = vad
      this.openingStream = null
      this.active = true
      this.dispatch({ type: 'active', value: true })
    } catch (error) {
      if (epoch === this.epoch) this.fail(error)
    }
  }

  interrupt() {
    clearTimeout(this.limitTimer)
    const wasResponding = this.turn !== -1
    const stoppedAt = performance.now()
    this.player?.stop()
    this.send({ type: 'cancel' })
    this.turn = -1
    this.serverDone = false
    this.dispatch({ type: 'interrupt' })
    this.dispatch({ type: 'phase', value: this.active ? 'listening' : 'idle' })
    if (wasResponding) this.dispatch({ type: 'metrics', value: { interruption_ms: performance.now() - stoppedAt } })
  }

  clear() {
    this.interrupt()
    this.send({ type: 'reset' })
    this.dispatch({ type: 'clear' })
  }

  stop() {
    ++this.epoch
    this.active = false
    this.interrupt()
    const vad = this.vad
    this.vad = null
    if (vad) void disposeVad(vad).catch(error => console.error('VAD cleanup failed', error))
    this.openingStream?.getTracks().forEach(track => track.stop())
    this.openingStream = null
    const socket = this.socket
    this.socket = null
    if (socket) socket.close()
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') void context.close().catch(() => {})
    this.player = null
    this.dispatch({ type: 'active', value: false })
  }

  private fail(error: unknown) {
    this.stop()
    this.dispatch({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }

  private finishIfIdle() {
    if (this.serverDone && !this.player?.busy && this.turn !== -1) {
      this.dispatch({ type: 'metrics', value: { total_ms: performance.now() - this.sentAt } })
      this.dispatch({ type: 'complete' })
      this.turn = -1
    }
  }

  private handle(event: ServerEvent) {
    if (event.type === 'error' && (event.turn_id === undefined || event.turn_id === this.turn)) {
      this.fail(new Error(event.message ?? 'The local pipeline failed.'))
      return
    }
    if (event.turn_id !== this.turn || this.turn === -1) return
    this.dispatch({ type: 'server', event })
    if (event.type === 'state' && event.state && !this.player?.busy) {
      this.dispatch({ type: 'phase', value: event.state })
    } else if (event.type === 'audio' && event.wav && event.index !== undefined) {
      this.player?.enqueue({ wav: event.wav, turn: this.turn, index: event.index })
    } else if (event.type === 'turn_done') {
      this.serverDone = true
      this.dispatch({ type: 'metrics', value: event.metrics ?? {} })
      this.finishIfIdle()
    } else if (event.type === 'empty') {
      this.dispatch({ type: 'phase', value: 'listening' })
      this.turn = -1
    }
  }
}
