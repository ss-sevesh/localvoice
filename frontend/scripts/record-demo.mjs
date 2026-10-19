// Synthetic microphone; real app, model responses and captured playback buffers.
import { openWorkspace } from './account.mjs'
import { chromium, expect } from '@playwright/test'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('../artifacts/demo')
const script = JSON.parse(await readFile(path.join(output, 'script.json'), 'utf8'))
await rm(path.join(output, 'audio-events.json'), { force: true })
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${path.resolve('../artifacts/demo-microphone.wav')}%noloop`,
] })
const events = []
const frames = []
const errors = []
try {
  const authentication = await browser.newContext()
  await openWorkspace(await authentication.newPage())
  const storageState = await authentication.storageState()
  await authentication.close()
  const context = await browser.newContext({
    storageState, permissions: ['microphone'], viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
  })
  const started = Date.now()
  const page = await context.newPage()
  const health = await (await page.request.get('http://127.0.0.1:8000/api/health')).json()
  expect(health.ready).toBe(true)
  page.on('pageerror', error => errors.push(error.message))
  page.on('websocket', socket => {
    for (const [event, direction] of [['framesent', 'sent'], ['framereceived', 'received']]) {
      socket.on(event, frame => {
        const data = JSON.parse(String(frame.payload))
        delete data.wav
        delete data.pcm
        frames.push({ ...data, direction, at: Date.now() })
        if (data.type === 'transcript') console.log(`Heard: ${data.text}`)
        if (data.type === 'error') console.log(`Pipeline error: ${data.message}`)
      })
    }
  })
  await page.exposeFunction('captureDemoAudio', event => events.push(event))
  await page.addInitScript(() => {
    let nextId = 0
    const ids = new WeakMap()
    const start = AudioBufferSourceNode.prototype.start
    const stop = AudioBufferSourceNode.prototype.stop
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) {
        const id = nextId++
        ids.set(this, id)
        const samples = this.buffer.getChannelData(0)
        const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
        let binary = ''
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
        window.captureDemoAudio({ type: 'start', id, at: Date.now(), rate: this.buffer.sampleRate, pcm: btoa(binary) })
      }
      return start.apply(this, args)
    }
    AudioBufferSourceNode.prototype.stop = function (...args) {
      if (ids.has(this)) window.captureDemoAudio({ type: 'stop', id: ids.get(this), at: Date.now() })
      return stop.apply(this, args)
    }
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await getUserMedia(...args)
      window.captureDemoAudio({ type: 'microphone', at: Date.now() })
      return stream
    }
  })
  const at = async second => {
    const delay = second * 1000 - (Date.now() - started)
    if (delay > 0) await page.waitForTimeout(delay)
  }
  const caption = async (title, text) => {
    console.log(title)
    await page.evaluate(({ title, text }) => {
      let overlay = document.getElementById('demo-caption')
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'demo-caption'
        overlay.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:18px 48px;background:#100d1ef5;border-top:1px solid #d6baff40;color:#f4f0fc;z-index:10000;font:13px Segoe UI;line-height:1.6'
        document.body.append(overlay)
      }
      const heading = document.createElement('strong')
      heading.style.cssText = 'display:block;color:#d6baff;font-size:11px;letter-spacing:1.2px;margin-bottom:4px'
      heading.textContent = title
      const body = document.createElement('span')
      body.textContent = text
      const disclosure = document.createElement('small')
      disclosure.textContent = 'AUTOMATED DEMO · SYNTHETIC INPUT · REAL LOCAL REPLIES'
      disclosure.style.cssText = 'float:right;color:#c1b7d2;font-size:9px;letter-spacing:.6px;margin-left:24px;margin-top:4px'
      overlay.replaceChildren(heading, body, disclosure)
    }, { title, text })
  }
  const card = async (title, items, note) => page.evaluate(({ title, items, note }) => {
    document.getElementById('demo-card')?.remove()
    const overlay = document.createElement('section')
    overlay.id = 'demo-card'
    overlay.style.cssText = 'position:fixed;inset:140px 80px 180px;padding:64px;background:#100d1ef5;border:1px solid #d6baff40;border-radius:20px;color:#f4f0fc;z-index:9999;box-shadow:0 20px 100px #0008;font:16px Segoe UI'
    const label = document.createElement('p')
    label.textContent = 'LOCAL VOICE / DEMO OVERVIEW'
    label.style.cssText = 'color:#d6baff;font-size:11px;letter-spacing:2px'
    const heading = document.createElement('h2')
    heading.textContent = title
    heading.style.cssText = 'font-size:40px;font-weight:500;letter-spacing:-1px;margin:24px 0 52px'
    const grid = document.createElement('div')
    grid.style.cssText = 'display:flex;gap:28px'
    for (const [label, value] of items) {
      const box = document.createElement('div')
      box.style.cssText = 'flex:1;min-width:0;padding:28px;border:1px solid #d6baff33;border-radius:12px;background:#d6baff0c'
      const name = document.createElement('p')
      name.textContent = label
      name.style.cssText = 'font-size:11px;color:#d6baff;letter-spacing:1px;margin:0 0 18px'
      const content = document.createElement('p')
      content.textContent = value
      content.style.cssText = 'font-size:22px;line-height:1.6;overflow-wrap:anywhere;margin:0'
      box.append(name, content)
      grid.append(box)
    }
    const detail = document.createElement('p')
    detail.textContent = note
    detail.style.cssText = 'color:#c1b7d2;line-height:1.9;margin:32px 0 0;font-size:15px'
    overlay.append(label, heading, grid, detail)
    document.body.append(overlay)
  }, { title, items, note })

  await page.goto('http://127.0.0.1:8000/')
  await page.waitForTimeout(300)
  const syncAt = await page.evaluate(() => {
    const marker = document.createElement('div')
    marker.id = 'demo-sync'
    marker.style.cssText = 'position:fixed;right:0;bottom:0;width:16px;height:16px;background:white;z-index:20000'
    document.body.append(marker)
    return Date.now()
  })
  await page.waitForTimeout(240)
  await page.locator('#demo-sync').evaluate(marker => marker.remove())
  await caption('LOCAL VOICE / ENGLISH + हिंदी', 'A short conversation. Both the speaker and the assistant are audible.')
  await at(9)
  await openWorkspace(page)
  await caption('YOUR PRIVATE THINKING SPACE', 'Local accounts · no saved conversations · headphones recommended')
  await at(18)
  await page.getByRole('button', { name: 'Start conversation' }).click()
  await expect(page.getByRole('button', { name: 'End conversation' })).toBeVisible()
  await caption('01 / ENGLISH + AUTOMATIC VOICE DETECTION', '“Hello. My name is Sam. Please remember it.” The microphone stays on; a pause sends the turn.')
  await at(32)
  await caption('02 / A SIMPLE FOLLOW-UP', '“What is my name?” Session memory connects this question to the previous turn.')
  await at(46)
  await caption('03 / हिंदी में बातचीत', '“नमस्ते। आप कैसे हैं?” Hindi recognition and a Hindi spoken reply, without changing language mode.')
  await at(62)
  await caption('04 / HINDI + STREAMED RESPONSES', '“मेरा नाम क्या है? हिंदी में बताइए।” Watch the text arrive, then hear the sentence audio.')
  await at(79)
  await caption('05 / SPEAK TO INTERRUPT', 'First: “Tell me a short story about a cat.” Then: “No, wait. Just say hello.”')
  await at(96)
  await expect(page.getByRole('status')).toContainText('Listening', { timeout: 15000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(frames.filter(frame => frame.direction === 'sent' && frame.type === 'speech')).toHaveLength(6)
  const transcripts = frames.filter(frame => frame.type === 'transcript')
  expect(transcripts).toHaveLength(6)
  expect(transcripts[0].text).toMatch(/Sam/i)
  expect(transcripts[2].text).toMatch(/[\u0900-\u097f]/u)
  expect(await page.locator('.interrupted').count()).toBeGreaterThan(0)
  expect(events.some(event => event.type === 'stop')).toBe(true)
  expect(frames.filter(frame => frame.type === 'text_delta').length).toBeGreaterThan(10)
  expect(frames.some(frame => frame.direction === 'sent' && frame.type === 'played')).toBe(true)
  const conversation = await page.locator('.message-list').innerText()
  expect(conversation).toMatch(/Sam/i)
  await expect(page.locator('article.assistant').nth(1)).toContainText('Sam')
  expect(errors).toEqual([])
  await page.getByText('Under the hood', { exact: true }).click()
  await page.locator('.timings').scrollIntoViewIfNeeded()
  const firstVoice = await page.locator('dd').nth(3).innerText()
  await page.getByRole('button', { name: 'End conversation' }).click()
  const shift = Math.max(0, (Date.now() - started) / 1000 - 96)
  expect(script.duration + shift).toBeLessThan(180)
  await at(98 + shift)
  await caption('06 / OBSERVED RESPONSE DELAY', `Last turn: ${firstVoice} to first voice. Browser measurement; not acoustic latency.`)
  await at(111 + shift)
  await card('Speech → text → reply → voice', [
    ['STT / HEAR', 'Faster-Whisper medium'], ['LLM / THINK', health.models.llm], ['TTS / SPEAK', 'Kokoro · Omega'],
  ], 'Browser microphone → Silero VAD → WebSocket → FastAPI. Streamed text and sentence audio return to the browser. Speaking again cancels the current turn.')
  await caption('07 / ARCHITECTURE · STT → LLM → TTS', 'All inference runs locally. The assistant uses one Kokoro speaker across English and Hindi.')
  await at(125 + shift)
  await card('Real models. A real laptop.', [
    ['CPU + MEMORY', 'i7-13620H · 16 GB RAM'], ['GPU', 'RTX 4060 Laptop · 8 GB'], ['LAST RECORDED TURN', firstVoice],
  ], `Whisper: ${health.stt_device} / ${health.stt_compute_type}. Kokoro: ${health.tts_device}. First voice measures the last detected speech frame to browser playback start; latency varies with the prompt and hardware.`)
  await caption('08 / HARDWARE + MEASUREMENTS', 'See README, docs/models.md and docs/performance.md for setup, model details and the earlier 30-turn benchmark.')
  await at(139 + shift)
  await card('A conversation that stays here.', [
    ['DEMO LANGUAGES', 'English · Hindi'], ['BONUS FEATURES', 'Streaming · VAD · interruptions'], ['SOURCE + SETUP', 'github.com/ss-sevesh/localvoice'],
  ], 'Synthetic user speech and narration. All assistant text, voice, timings and interruptions were captured from the running application. No assistant replies were scripted.')
  await caption('LOCAL VOICE / THANK YOU', 'Source code, installation, architecture, models, hardware and observed latency are included on GitHub.')
  await at(150 + shift)
  const duration = (Date.now() - started) / 1000
  const video = page.video()
  await context.close()
  await video.saveAs(path.join(output, 'browser.webm'))
  await writeFile(path.join(output, 'audio-events.json'), JSON.stringify({
    started, duration, syncAt, events, frames, health, firstVoice, conversation,
    narration: script.narration.map(clip => ({ ...clip, start: clip.start >= 98 ? clip.start + shift : clip.start })),
  }))
  console.log(`Captured ${duration.toFixed(1)} seconds; six real turns; interruption and playback verified.`)
} finally { await browser.close() }
