import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { VoiceClient } from './client'
import Background from './Background'
import Brand from './Brand'
import type { User } from './auth'
import { initialState, reducer } from './state'
import type { InputLanguage, Metrics, Phase } from './state'

type Health = {
  ready: boolean
  error: string | null
  warning?: string | null
  stt_device?: string
  tts_device?: string
  stt_compute_type?: string
  load_seconds: number
  models: { stt: string; llm: string; tts: string }
}

const phaseLabels: Record<Phase, string> = {
  idle: 'Ready when you are', connecting: 'Connecting your microphone', listening: 'Listening',
  transcribing: 'Transcribing your words', generating: 'Thinking it through',
  speaking: 'Speaking', error: 'Let’s try that again',
}
const modes: { value: InputLanguage; label: string }[] = [
  { value: 'auto', label: 'Auto' }, { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi / Hinglish' },
]

function WaveMark({ small = false, speaking = false }: { small?: boolean; speaking?: boolean }) {
  return <span className={`wave-mark ${small ? 'small' : ''} ${speaking ? 'is-speaking' : ''}`} aria-hidden="true">
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
    ['interruption_ms', 'Playback stop dispatch'], ['stt_queue_ms', 'Recognition queue'],
    ['language_detect_ms', 'Input language detection'], ['stt_decode_ms', 'Recognition decoding'],
    ['reply_language_ms', 'Reply language selection'], ['llm_first_token_ms', 'Generation to first token'],
    ['repair_ms', 'Mixed-language continuation'], ['tts_first_chunk_ms', 'First audio synthesis'],
  ]
  return <details className="timings">
    <summary><span>Under the hood</span><span className="detail-hint">Models & timings <span aria-hidden="true">↗</span></span></summary>
    <div className="timing-content">
      <div className="model-list">
        <p className="eyebrow">RUNNING ON YOUR DEVICE</p>
        <p><span>Hear</span>{health?.models.stt ?? 'Faster-Whisper'}</p>
        <p><span>Think</span>{health?.models.llm ?? 'Qwen via Ollama'}</p>
        <p><span>Speak</span>{health?.models.tts ?? 'Kokoro Omega'} · {health?.tts_device ?? 'Loading'}</p>
        <p><span>Device</span>{health?.stt_device ?? 'Loading'} · {health?.stt_compute_type ?? '—'}</p>
        <small>Local inference · session-only memory</small>
      </div>
      <dl>{items.map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{metrics[key] === undefined ? '—' : `${Math.round(metrics[key]).toLocaleString()} ms`}</dd>
      </div>)}</dl>
      <p className="timing-note">First voice includes end-of-speech detection and browser playback start. Playback stop measures the browser stop call, not acoustic silence. Other stages are measured separately.</p>
    </div>
  </details>
}

export default function App({ user, onLogout }: { user?: User; onLogout?: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [health, setHealth] = useState<Health | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>('auto')
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
  const isSpeaking = state.active && state.phase === 'speaking' && state.turn >= 0 && !state.userSpeaking
  const languageLabel = state.detectedLanguage === 'hi' ? 'Hindi' : 'English'

  return <div className="app-shell">
    <Background />
    <header className="site-header">
      <Brand />
      <div className="workspace-account"><div className={`local-badge ${unavailable ? 'pending' : ''}`}><span className="status-dot" />{status}</div>{user && <><span className="account-name">{user.name}</span><button className="secondary-button" onClick={() => { client.stop(); onLogout?.() }}>Log out</button></>}</div>
    </header>
    <main id="main-content" tabIndex={-1}>
      <section className="conversation-heading" aria-labelledby="page-title">
        <div><p className="eyebrow">A LITTLE SPACE TO THINK</p><h1 id="page-title" tabIndex={-1}>Let’s talk it through.</h1>
          <p className="intro">Your thoughts. Your language. A conversation that stays here.</p></div>
        <button className="text-button" onClick={() => client.clear()} disabled={!state.messages.length}>
          <span aria-hidden="true">↺</span> Clear conversation
        </button>
      </section>
      <section className="conversation" aria-label="Voice conversation">
        <div className="conversation-topline">
          <div className="language-controls" role="group" aria-label="Speech recognition language">
            <span className="control-label">Speak in</span>
            {modes.map(mode => <button key={mode.value} className="mode-pill" aria-pressed={inputLanguage === mode.value}
              disabled={state.userSpeaking} onClick={() => { client.inputLanguage = mode.value; setInputLanguage(mode.value) }}>{mode.label}</button>)}
          </div>
          <span className="detected-language">{state.detectedLanguage ? `Detected ${languageLabel}` : 'English · हिंदी'}</span>
        </div>
        {health?.warning && <p className="runtime-warning" role="note">{health.warning}</p>}
        <div className="transcript" ref={scrollArea} onScroll={() => {
          const area = scrollArea.current
          if (area) follow.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80
        }} role="log" aria-live="off" aria-label="Conversation transcript">
          {state.messages.length === 0 ? <div className="empty-state">
            <div className={`voice-emblem ${state.active ? 'is-active' : ''}`}><WaveMark /></div>
            <p className="empty-kicker">NO PROMPT NEEDED. JUST YOU.</p>
            <h2>{state.active ? 'You have my attention.' : 'What’s on your mind?'}</h2>
            <p>{state.active ? 'Speak naturally. Pause when you’re done.' : 'Start your microphone and speak in English, Hindi, or a little of both.'}</p>
            <div className="suggestions"><span>“Help me think through an idea.”</span><span lang="hi">“मुझे कुछ नया सिखाओ।”</span></div>
          </div> : <div className="message-list">{state.messages.map(message => <article className={`message ${message.role}`} key={`${message.turn}-${message.role}`}>
            <div className="speaker"><span className="speaker-mark">{message.role === 'user' ? 'Y' : <WaveMark small speaking={isSpeaking && message.turn === state.turn && !message.interrupted} />}</span>
              {message.role === 'user' ? 'You' : 'Local Voice'}
              {message.language && <span className="message-language">{message.language === 'hi' ? 'Hindi' : 'English'}</span>}</div>
            <p>{message.text}</p>{message.interrupted && <small className="interrupted">Interrupted · some text may not have been spoken</small>}
          </article>)}</div>}
        </div>
        {(state.error || health?.error || healthError) && <div className="error-notice" role="alert">
          <strong>Let’s try that again.</strong><p>{state.error ?? health?.error ?? 'Start the local backend, then try again.'}</p>
        </div>}
        <div className="voice-toolbar">
          <div className="voice-status" role="status" aria-live="polite">
            <div className={`activity-light ${state.active ? 'on' : ''} ${state.userSpeaking ? 'hearing' : ''} ${isSpeaking ? 'is-speaking' : ''}`}><WaveMark small speaking={isSpeaking} /></div>
            <div><strong>{state.userSpeaking ? 'I hear you' : phaseLabels[state.phase]}</strong><span>{state.active ? 'Mic is on · speak to interrupt' : 'Headphones on. Make yourself comfortable.'}</span></div>
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
      <div className="privacy-line"><span className="tiny-dot" /> No cloud inference. No saved conversations.</div>
      <TimingPanel metrics={state.metrics} health={health} />
      <footer><span>Built for the way you think.</span><span>Local Voice · English & Hindi</span></footer>
    </main>
  </div>
}
