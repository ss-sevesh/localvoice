export type Phase = 'idle' | 'connecting' | 'listening' | 'transcribing' | 'generating' | 'speaking' | 'error'
export type Metrics = Record<string, number>
export type InputLanguage = 'auto' | 'en' | 'hi'
export type ServerEvent = {
  type: string
  turn_id?: number
  text?: string
  state?: Phase
  index?: number
  wav?: string
  metrics?: Metrics
  message?: string
  language?: 'en' | 'hi'
  recoverable?: boolean
  code?: string
}
export type Message = { turn: number; role: 'user' | 'assistant'; text: string; interrupted?: boolean; language?: 'en' | 'hi' }
export type State = {
  active: boolean
  phase: Phase
  turn: number
  messages: Message[]
  metrics: Metrics
  error: string | null
  userSpeaking: boolean
  detectedLanguage: 'en' | 'hi' | null
}
export type Action =
  | { type: 'begin'; turn: number }
  | { type: 'interrupt' }
  | { type: 'complete' }
  | { type: 'clear' }
  | { type: 'active'; value: boolean }
  | { type: 'phase'; value: Phase }
  | { type: 'mic'; value: boolean }
  | { type: 'error'; message: string }
  | { type: 'recoverable'; message: string }
  | { type: 'metrics'; value: Metrics }
  | { type: 'server'; event: ServerEvent }

export const initialState: State = {
  active: false, phase: 'idle', turn: -1, messages: [], metrics: {}, error: null, userSpeaking: false,
  detectedLanguage: null,
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'begin': return { ...state, turn: action.turn, phase: 'transcribing', metrics: {}, error: null }
    case 'complete': return { ...state, turn: -1, phase: state.active ? 'listening' : 'idle' }
    case 'interrupt': return {
      ...state, turn: -1,
      messages: state.messages.map(m => m.turn === state.turn && m.role === 'assistant'
        ? { ...m, interrupted: true } : m),
    }
    case 'clear': return { ...initialState, active: state.active, phase: state.active ? 'listening' : 'idle' }
    case 'active': return { ...state, active: action.value, userSpeaking: false, phase: action.value ? 'listening' : 'idle' }
    case 'phase': return { ...state, phase: action.value }
    case 'mic': return { ...state, userSpeaking: action.value }
    case 'error': return { ...state, error: action.message, phase: 'error' }
    case 'recoverable': return {
      ...state, turn: -1, error: action.message, phase: state.active ? 'listening' : 'idle',
      userSpeaking: false,
      messages: state.messages.map(m => m.turn === state.turn && m.role === 'assistant'
        ? { ...m, interrupted: true } : m),
    }
    case 'metrics': return { ...state, metrics: { ...state.metrics, ...action.value } }
    case 'server': {
      const event = action.event
      if (event.turn_id !== state.turn) return state
      if (event.type === 'transcript') return {
        ...state, detectedLanguage: event.language ?? null,
        messages: [...state.messages, { turn: state.turn, role: 'user', text: event.text ?? '', language: event.language }].slice(-80) as Message[],
      }
      if (event.type === 'text_delta') {
        const last = state.messages.at(-1)
        const messages: Message[] = last?.turn === state.turn && last.role === 'assistant'
          ? [...state.messages.slice(0, -1), { ...last, text: last.text + event.text }]
          : [...state.messages, { turn: state.turn, role: 'assistant', text: event.text ?? '' }]
        return { ...state, messages }
      }
      return state
    }
  }
}
