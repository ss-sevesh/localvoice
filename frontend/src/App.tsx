import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { VoiceClient } from './client'
import { initialState, reducer } from './state'
import type { Metrics, Phase } from './state'

type Health = {
  ready: boolean
  error: string | null
  load_seconds: number
  models: { stt: string; llm: string; tts: string }
}

const phaseLabels: Record<Phase, string> = {
  idle: 'Ready when you are', connecting: 'Connecting your microphone', listening: 'Listening',
  transcribing: 'Finding your words', generating: 'Thinking it through', speaking: 'Speaking', error: 'Let’s try that again',
}

function WaveMark({ small = false }: { small?: boolean }) {
  return <span className={`wave-mark ${small ? 'small' : ''}`} aria-hidden="true">
    {[0, 1, 2, 3, 4].map(i => <span key={i} />)}
  </span>
}

function MicIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-4 0h8" />
  </svg>
}

function TimingPanel({ metrics, health }: { metrics: Metrics; health: Health | null }) {
  const items = [
    ['endpoint_ms', 'End-of-speech detection'], ['stt_ms', 'Speech to text'],
    ['first_text_ms', 'First text · after upload'], ['first_audible_ms', 'First voice · after speech'],
    ['tts_ms', 'Voice synthesis · cumulative'], ['total_ms', 'Complete turn · after upload'],
    ['interruption_ms', 'Playback stop dispatch'],
  ]
  return <details className="timings">
    <summary><span>Under the hood</span><span className="detail-hint">Models & timings <span aria-hidden="true">↗</span></span></summary>
    <div className="timing-content">
      <div className="model-list">
        <p className="eyebrow">THE LOCAL PIPELINE</p>
        <p><span>Hear</span>{health?.models.stt ?? 'Faster-Whisper'}</p>
        <p><span>Think</span>{health?.models.llm ?? 'Qwen via Ollama'}</p>
        <p><span>Speak</span>{health?.models.tts ?? 'Piper'}</p>
        <small>CPU inference · session-only memory</small>
      </div>
      <dl>{items.map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{metrics[key] === undefined ? '—' : `${Math.round(metrics[key]).toLocaleString()} ms`}</dd>
      </div>)}</dl>
      <p className="timing-note">Timings describe the latest turn. Playback stop measures the browser stop call, not acoustic silence. First voice includes endpoint detection; other stages are measured separately.</p>
    </div>
  </details>
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [health, setHealth] = useState<Health | null>(null)
  const [healthError, setHealthError] = useState(false)
  const client = useMemo(() => new VoiceClient(dispatch), [])
  const scrollArea = useRef<HTMLDivElement>(null)
  const follow = useRef(true)

  useEffect(() => {
    const controller = new AbortController()
    async function check() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
        if (!response.ok) throw new Error('Health check failed')
        setHealth(await response.json() as Health)
        setHealthError(false)
      } catch {
        if (!controller.signal.aborted) setHealthError(true)
      }
    }
    void check()
    const timer = setInterval(() => void check(), 3000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [])

  useEffect(() => () => client.stop(), [client])

  useEffect(() => {
    const area = scrollArea.current
    if (area && follow.current) area.scrollTop = area.scrollHeight
  }, [state.messages])

  const connecting = state.phase === 'connecting'
  const unavailable = !health?.ready || healthError
  const status = healthError ? 'Backend disconnected' : health?.error ? 'Setup needed'
    : health?.ready ? 'All models local' : 'Warming up models'
  const replyActive = ['transcribing', 'generating', 'speaking'].includes(state.phase)

  return <div className="app-shell">
    <header className="site-header">
      <a href="/" className="brand" aria-label="Local Voice home"><WaveMark small /><span>local<span className="brand-light">voice</span><span className="brand-dot">.</span></span></a>
      <div className={`local-badge ${unavailable ? 'pending' : ''}`}><span className="status-dot" />{status}</div>
    </header>

    <main>
      <section className="conversation-heading" aria-labelledby="page-title">
        <div><p className="eyebrow">A SPACE TO SPEAK FREELY</p><h1 id="page-title">A little more <em>human.</em></h1>
          <p className="intro">Think out loud. I’ll keep up.</p></div>
        <button className="text-button" onClick={() => client.clear()} disabled={!state.messages.length}>
          <span aria-hidden="true">↺</span> Clear conversation
        </button>
      </section>

      <section className="conversation" aria-label="Voice conversation">
        <div className="conversation-topline"><span><span className="tiny-dot" /> YOUR CONVERSATION</span><span>Just here. Just this session.</span></div>
        <div className="transcript" ref={scrollArea} onScroll={() => {
          const area = scrollArea.current
          if (area) follow.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80
        }} role="log" aria-live="off" aria-label="Conversation transcript">
          {state.messages.length === 0 ? <div className="empty-state">
            <div className={`voice-emblem ${state.active ? 'is-active' : ''}`}><WaveMark /></div>
            <h2>{state.active ? 'You have my attention.' : 'Good conversations start here.'}</h2>
            <p>{state.active ? 'Speak naturally. Pause when you’re done.' : 'Turn on your microphone and say what’s on your mind.'}</p>
            <div className="suggestions"><span>“Help me think through an idea.”</span><span>“Explain something simply.”</span></div>
          </div> : <div className="message-list">{state.messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.turn}-${message.role}`}>
            <div className="speaker"><span className="speaker-mark">{message.role === 'user' ? 'Y' : <WaveMark small />}</span>
              {message.role === 'user' ? 'You' : 'Local Voice'}<span className="message-number">{String(index + 1).padStart(2, '0')}</span></div>
            <p>{message.text}</p>{message.interrupted && <small className="interrupted">Interrupted · some text may not have been spoken</small>}
          </article>)}</div>}
        </div>
        {(state.error || health?.error || healthError) && <div className="error-notice" role="alert">
          <strong>Something needs attention.</strong><p>{state.error ?? health?.error ?? 'Start the local backend, then try again.'}</p>
        </div>}
        <div className="voice-toolbar">
          <div className="voice-status" role="status" aria-live="polite">
            <div className={`activity-light ${state.active ? 'on' : ''} ${state.userSpeaking ? 'hearing' : ''}`}><WaveMark small /></div>
            <div><strong>{state.userSpeaking ? 'I hear you' : phaseLabels[state.phase]}</strong><span>{state.active ? 'Your mic is on · speak to interrupt' : 'Use headphones for the best experience'}</span></div>
          </div>
          <div className="voice-actions">
            {replyActive && <button className="secondary-button" onClick={() => client.interrupt()}>Stop reply</button>}
            <button className={`primary-button ${state.active || connecting ? 'stop' : ''}`}
              disabled={!state.active && !connecting && unavailable}
              onClick={() => state.active || connecting ? client.stop() : void client.start()}>
              {state.active || connecting ? <span className="stop-icon" aria-hidden="true" /> : <MicIcon />}
              {connecting ? 'Cancel' : state.active ? 'End conversation' : 'Start conversation'}
            </button>
          </div>
        </div>
      </section>

      <TimingPanel metrics={state.metrics} health={health} />
      <footer><span><span aria-hidden="true">⌁</span> Your voice stays on your machine.</span><span>Open models. Open conversation.</span></footer>
    </main>
  </div>
}
