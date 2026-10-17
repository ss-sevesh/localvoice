// Automated showcase: synthetic microphone, real local inference and playback buffers.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('../artifacts/demo')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${path.resolve('../artifacts/demo-microphone.wav')}%noloop`,
] })
const context = await browser.newContext({
  permissions: ['microphone'], viewport: { width: 1280, height: 900 },
  recordVideo: { dir: output, size: { width: 1280, height: 900 } },
})
const page = await context.newPage()
const events = []
await page.exposeFunction('captureDemoAudio', event => events.push(event))
await page.addInitScript(() => {
  let nextId = 0
  const ids = new WeakMap()
  const originalStart = AudioBufferSourceNode.prototype.start
  const originalStop = AudioBufferSourceNode.prototype.stop
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer) {
      const id = nextId++
      ids.set(this, id)
      const samples = this.buffer.getChannelData(0)
      const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
      }
      window.captureDemoAudio({ type: 'start', id, at: Date.now(), rate: this.buffer.sampleRate, pcm: btoa(binary) })
    }
    return originalStart.apply(this, args)
  }
  AudioBufferSourceNode.prototype.stop = function (...args) {
    if (ids.has(this)) window.captureDemoAudio({ type: 'stop', id: ids.get(this), at: Date.now() })
    return originalStop.apply(this, args)
  }
  const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = async (...args) => {
    const stream = await getUserMedia(...args)
    window.captureDemoAudio({ type: 'microphone', at: Date.now() })
    return stream
  }
})
await page.goto('http://127.0.0.1:8000/')
const started = Date.now()
const at = async second => {
  const delay = second * 1000 - (Date.now() - started)
  if (delay > 0) await page.waitForTimeout(delay)
}
const caption = async (title, text) => page.evaluate(({ title, text }) => {
  let overlay = document.getElementById('demo-caption')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'demo-caption'
    overlay.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:18px 48px;background:#183f35;color:#fff;z-index:1000;font:16px Segoe UI;box-shadow:0 -2px 20px #0001'
    document.body.append(overlay)
  }
  overlay.replaceChildren()
  const heading = document.createElement('strong')
  heading.textContent = title
  const body = document.createElement('span')
  body.style.cssText = 'margin-left:20px;color:#d7e6dd;font-size:13px'
  body.textContent = text
  overlay.append(heading, body)
}, { title, text })

await caption('LOCAL VOICE / TECHNICAL DEMO', 'Synthetic microphone audio · real local models · actual browser session')
await at(6)
await caption('01 / LOCAL BY DESIGN', 'Whisper → Qwen through Ollama → Piper. No hosted inference API.')
await at(12)
await page.getByRole('button', { name: 'Start conversation' }).click()
await caption('02 / SPEAK NATURALLY', 'Local Silero VAD detects the end of each utterance.')
await at(30)
await caption('03 / CONVERSATION MEMORY', 'A follow-up asks for the name and hobby from the previous turn.')
await at(48)
await caption('04 / SPOKEN INTERRUPTION', 'A new utterance stops queued audio and supersedes the old turn.')
await at(76)
await page.getByText('Under the hood', { exact: true }).click()
await page.locator('.timings').scrollIntoViewIfNeeded()
await caption('05 / MEASURED, NOT ASSUMED', 'The panel separates endpoint detection, transcription, first voice and synthesis timings.')
await at(90)
await page.getByRole('button', { name: 'End conversation' }).click()
await page.evaluate(() => window.scrollTo(0, 0))
await caption('06 / HOW IT WORKS', 'React + TypeScript / WebSocket / FastAPI / serialized CPU model workers')
await at(103)
await caption('07 / VERIFIED BEHAVIOR', 'Context recall · playback acknowledgements · stale-turn rejection · local runtime assets')
await at(115)
await caption('LOCAL VOICE / OPEN MODELS, OPEN CONVERSATION', 'Automated showcase. A real microphone and headphone check is still recommended.')
await at(126)
const video = page.video()
await context.close()
await writeFile(path.join(output, 'audio-events.json'), JSON.stringify({ started, duration: 126, events }))
await video.saveAs(path.join(output, 'browser.webm'))
await browser.close()
console.log(`Demo browser capture: ${output}`)
