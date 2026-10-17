import { describe, expect, it } from 'vitest'
import { initialState, reducer } from './state'

describe('conversation state', () => {
  it('does not label a completed reply interrupted when the next utterance starts', () => {
    let state = reducer(initialState, { type: 'begin', turn: 1 })
    state = reducer(state, { type: 'server', event: { type: 'text_delta', turn_id: 1, text: 'Finished.' } })
    state = reducer(state, { type: 'complete' })
    state = reducer(state, { type: 'interrupt' })
    expect(state.messages[0].interrupted).not.toBe(true)
  })
  it('ignores stale turn results after an interruption', () => {
    let state = reducer(initialState, { type: 'begin', turn: 1 })
    state = reducer(state, { type: 'server', event: { type: 'text_delta', turn_id: 1, text: 'Old' } })
    state = reducer(state, { type: 'interrupt' })
    state = reducer(state, { type: 'server', event: { type: 'text_delta', turn_id: 1, text: ' late' } })
    expect(state.messages[0].text).toBe('Old')
    expect(state.messages[0].interrupted).toBe(true)
  })

  it('clears transcript and metrics while keeping the microphone connected', () => {
    const state = reducer({ ...initialState, active: true, metrics: { stt_ms: 200 } }, { type: 'clear' })
    expect(state.messages).toEqual([])
    expect(state.metrics).toEqual({})
    expect(state.active).toBe(true)
  })

  it('accumulates streamed text into one assistant message', () => {
    let state = reducer(initialState, { type: 'begin', turn: 4 })
    for (const text of ['Hello', ' there.']) {
      state = reducer(state, { type: 'server', event: { type: 'text_delta', turn_id: 4, text } })
    }
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].text).toBe('Hello there.')
  })
})
