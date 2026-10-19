import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { openWorkspace } from './accounts'

test('real microphone fixture goes through VAD, STT, LLM and audible playback', async ({ page }) => {
  const errors: string[] = []
  const offsite: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8000/')) offsite.push(request.url())
  })
  await openWorkspace(page)
  const start = page.getByRole('button', { name: 'Start conversation' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(page.getByRole('button', { name: 'End conversation' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('article.user')).toContainText('Mira', { timeout: 45_000 })
  await expect(page.locator('article.assistant')).not.toBeEmpty({ timeout: 45_000 })
  const voiceBars = page.locator('.activity-light .wave-mark.is-speaking > span').first()
  await expect(voiceBars).toBeVisible({ timeout: 30_000 })
  await expect(voiceBars).toHaveCSS('animation-name', 'voice-wave')
  await page.screenshot({ path: '../artifacts/speaking-desktop.png', fullPage: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(voiceBars).toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(page.getByRole('status')).toContainText('Listening', { timeout: 60_000 })
  await expect(page.locator('.wave-mark.is-speaking')).toHaveCount(0)
  await expect(page.locator('.interrupted')).toHaveCount(0)
  await page.getByText('Under the hood', { exact: true }).click()
  await expect(page.locator('dd').nth(3)).not.toHaveText('—')
  await page.screenshot({ path: '../artifacts/conversation-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Clear conversation' }).click()
  await expect(page.getByRole('heading', { name: 'You have my attention.' })).toBeVisible()
  await page.getByRole('button', { name: 'End conversation' }).click()
  await expect(start).toBeVisible()
  expect(errors).toEqual([])
  expect(offsite).toEqual([])
})

test('responsive page has accessible controls and no horizontal overflow', async ({ page }) => {
  await openWorkspace(page)
  await expect(page.getByRole('button', { name: 'Start conversation' })).toBeEnabled({ timeout: 60_000 })
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../artifacts/layout-${width}.png`, fullPage: true })
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(accessibility.violations).toEqual([])
})

test('recognition errors keep the mic connected and allow a language override', async ({ playwright }) => {
  const browser = await playwright.chromium.launch({ channel: 'chrome', args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.resolve('../artifacts/interruption-fixture.wav')}%noloop`,
  ] })
  try {
    const page = await browser.newPage({ permissions: ['microphone'] })
    let speechCount = 0
    let secondLanguage = ''
    await page.routeWebSocket('**/ws/conversation', socket => {
      socket.onMessage(raw => {
        const event = JSON.parse(String(raw))
        if (event.type !== 'speech') return
        speechCount++
        if (speechCount === 1) socket.send(JSON.stringify({
          type: 'error', turn_id: event.turn_id, recoverable: true,
          code: 'unsupported_language', message: 'Choose English or Hindi and try again.',
        }))
        else {
          secondLanguage = event.input_language
          socket.send(JSON.stringify({ type: 'transcript', turn_id: event.turn_id, language: 'en', text: 'A second utterance.' }))
          socket.send(JSON.stringify({ type: 'turn_done', turn_id: event.turn_id, metrics: {} }))
        }
      })
    })
    await openWorkspace(page)
    await page.getByRole('button', { name: 'Start conversation' }).click()
    await expect(page.getByRole('alert')).toContainText('Choose English', { timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'End conversation' })).toBeVisible()
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.locator('article.user')).toContainText('A second utterance.', { timeout: 30_000 })
    expect(secondLanguage).toBe('en')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: 'End conversation' }).click()
  } finally { await browser.close() }
})

for (const language of ['hindi', 'hinglish']) {
  test(`${language} speech produces a local spoken reply`, async ({ playwright }) => {
    const browser = await playwright.chromium.launch({ channel: 'chrome', args: [
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.resolve(`../artifacts/${language}-microphone.wav`)}%noloop`,
    ] })
    try {
      const context = await browser.newContext({ permissions: ['microphone'] })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await openWorkspace(page)
      const start = page.getByRole('button', { name: 'Start conversation' })
      await expect(start).toBeEnabled()
      await start.click()
      await expect(page.locator('article.user')).toContainText(/[\u0900-\u097f]/, { timeout: 45_000 })
      await expect(page.locator('article.assistant')).toContainText(/[\u0900-\u097f]/, { timeout: 45_000 })
      if (language === 'hinglish') await expect(page.locator('article.assistant')).toContainText(/[A-Za-z]{2,}/)
      await expect(page.getByRole('status')).toContainText('Listening', { timeout: 60_000 })
      await page.getByText('Under the hood', { exact: true }).click()
      await expect(page.locator('dd').nth(3)).not.toHaveText('—')
      expect(errors).toEqual([])
      await page.screenshot({ path: `../artifacts/${language}-browser.png`, fullPage: true })
      await page.getByRole('button', { name: 'End conversation' }).click()
    } finally { await browser.close() }
  })
}

for (const { label, fixture, expected } of [
  { label: 'full English', fixture: 'interruption-fixture.wav', expected: 'cats' },
  { label: 'short English', fixture: 'interruption-short-english.wav', expected: /no.*wait/i },
  { label: 'short Hindi', fixture: 'interruption-short-hindi.wav', expected: 'सुनो' },
]) test(`spoken interruption stops old audio and starts the new turn (${label})`, async ({ playwright }) => {
  const browser = await playwright.chromium.launch({ channel: 'chrome', args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.resolve('../artifacts', fixture)}%noloop`,
  ] })
  try {
    const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const events: { type: string; turn_id?: number }[] = []
    page.on('websocket', socket => socket.on('framesent', frame => {
      const event = JSON.parse(String(frame.payload))
      events.push({ type: event.type, turn_id: event.turn_id })
    }))
    await openWorkspace(page)
    await expect(page.getByRole('button', { name: 'Start conversation' })).toBeEnabled()
    await page.getByRole('button', { name: 'Start conversation' }).click()
    await expect(page.locator('article.assistant')).toHaveCount(1, { timeout: 45_000 })
    await expect(page.locator('.interrupted')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('article.user')).toHaveCount(2, { timeout: 30_000 })
    await expect(page.locator('article.user').last()).toContainText(expected)
    await expect(page.locator('article.assistant')).toHaveCount(2, { timeout: 30_000 })
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 60_000 })
    expect(events.filter(e => e.type === 'speech')).toHaveLength(2)
    const secondSpeech = events.findLastIndex(e => e.type === 'speech')
    expect(events.slice(secondSpeech + 1).filter(e => e.type === 'played' && e.turn_id === 1)).toEqual([])
    await page.screenshot({ path: '../artifacts/interruption-desktop.png', fullPage: true })
    await page.getByRole('button', { name: 'End conversation' }).click()
  } finally { await browser.close() }
})

test('microphone denial is recoverable and retry can start a conversation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    let denied = false
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (!denied) { denied = true; throw new DOMException('Microphone permission denied', 'NotAllowedError') }
      return original(constraints)
    }
  })
  await openWorkspace(page)
  const start = page.getByRole('button', { name: 'Start conversation' })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByRole('alert')).toContainText('Microphone permission denied', { timeout: 30_000 })
  await start.click()
  await expect(page.getByRole('button', { name: 'End conversation' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'End conversation' }).click()
  await expect(start).toBeVisible()
})

test('cancel during VAD loading does not resurrect the microphone', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/vad/silero_vad_v5.onnx', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.continue()
  })
  await openWorkspace(page)
  const start = page.getByRole('button', { name: 'Start conversation' })
  await expect(start).toBeEnabled()
  await start.click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(start).toBeVisible()
  await page.waitForTimeout(2500) // Allow the intentionally delayed initializer to settle.
  await expect(page.getByRole('button', { name: 'End conversation' })).toHaveCount(0)
  expect(errors).toEqual([])
})
