import { openWorkspace } from './account.mjs'
import { chromium, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const directory = path.resolve('../artifacts/latency')
const fixtures = JSON.parse(await fs.readFile(path.join(directory, 'fixtures.json'), 'utf8'))
const health = await (await fetch('http://127.0.0.1:8000/api/health')).json()
if (!health.ready || health.stt_device !== 'cuda' || health.tts_device !== 'cuda') throw new Error('GPU recognition and synthesis must be ready for this benchmark')
const warmups = ['english', 'hindi', 'hinglish'].map(language => fixtures.find(f => f.language === language))
const results = []

for (const [index, fixture] of [...warmups, ...fixtures].entries()) {
  const browser = await chromium.launch({ channel: 'chrome', args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.join(directory, fixture.file)}%noloop`,
  ] })
  try {
    const page = await browser.newPage({ permissions: ['microphone'], viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await openWorkspace(page)
    await page.getByText('Under the hood', { exact: true }).click()
    const start = page.getByRole('button', { name: 'Start conversation' })
    await expect(start).toBeEnabled()
    await start.click()
    const timing = page.locator('dd').nth(3)
    await expect(timing).not.toHaveText('—', { timeout: 45_000 })
    const milliseconds = Number((await timing.innerText()).replace(/[^\d]/g, ''))
    const transcript = await page.locator('article.user').innerText()
    if (/[\u0b80-\u0bff]/u.test(transcript)) throw new Error('Unsupported Tamil script reached transcript')
    if (errors.length) throw new Error(errors.join('\n'))
    if (index >= warmups.length) {
      results.push({ ...fixture, first_audible_ms: milliseconds, transcript })
      console.log(`${results.length}/30 ${fixture.language}: ${milliseconds} ms`)
    }
    await page.getByRole('button', { name: 'End conversation' }).click()
  } finally { await browser.close() }
}
function summary(rows) {
  const values = rows.map(r => r.first_audible_ms).sort((a, b) => a - b)
  return { count: values.length, median_ms: Math.round((values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2),
    p95_ms: values[Math.ceil(values.length * .95) - 1] }
}
const overall = summary(results)
const report = {
  method: 'Synthetic microphone in Chrome; real local models and playback. App measures last VAD speech frame to AudioBufferSource.start. Not acoustic latency. Three warmups excluded.',
  health, overall, by_language: Object.fromEntries(['english', 'hindi', 'hinglish'].map(l => [l, summary(results.filter(r => r.language === l))])),
  target_passed: overall.median_ms <= 3000 && overall.p95_ms <= 5000, turns: results,
}
await fs.writeFile(path.join(directory, 'playback-results.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ overall, by_language: report.by_language, target_passed: report.target_passed }, null, 2))
if (!report.target_passed) process.exitCode = 1
