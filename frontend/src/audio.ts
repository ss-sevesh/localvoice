export function encodePCM(audio: Float32Array): string {
  const bytes = new Uint8Array(audio.length * 2)
  const view = new DataView(bytes.buffer)
  audio.forEach((sample, i) => view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true))
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(binary)
}

type Chunk = { wav: string; turn: number; index: number }

export class AudioPlayer {
  private queue: Chunk[] = []
  private source: AudioBufferSourceNode | null = null
  private generation = 0
  private running = false

  constructor(
    readonly context: AudioContext,
    private onStart: (turn: number) => void,
    private onPlayed: (turn: number, index: number) => void,
    private onIdle: () => void,
    private onError: (error: unknown) => void,
  ) {}

  get busy() { return this.running || this.queue.length > 0 }

  enqueue(chunk: Chunk) {
    this.queue.push(chunk)
    if (!this.running) void this.pump(this.generation)
  }

  stop() {
    this.generation++
    this.queue = []
    if (this.source) {
      this.source.onended = null
      this.source.stop()
      this.source.disconnect()
    }
    this.source = null
    this.running = false
  }

  private async pump(generation: number) {
    this.running = true
    try {
      const chunk = this.queue.shift()
      if (!chunk) {
        this.running = false
        this.onIdle()
        return
      }
      const bytes = Uint8Array.from(atob(chunk.wav), c => c.charCodeAt(0))
      const buffer = await this.context.decodeAudioData(bytes.buffer)
      if (generation !== this.generation) return
      const source = this.context.createBufferSource()
      source.buffer = buffer
      source.connect(this.context.destination)
      this.source = source
      source.onended = () => {
        source.disconnect()
        if (generation !== this.generation) return
        this.source = null
        this.onPlayed(chunk.turn, chunk.index)
        void this.pump(generation)
      }
      source.start()
      this.onStart(chunk.turn)
    } catch (error) {
      if (generation !== this.generation) return
      this.stop()
      this.onError(error)
    }
  }
}
