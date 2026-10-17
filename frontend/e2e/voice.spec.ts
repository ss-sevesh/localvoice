import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'

test('real microphone fixture goes through VAD, STT, LLM and audible playback', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const start = page.getByRole('button', { name: 'Start conversation' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(page.getByRole('button', { name: 'End conversation' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('article.user')).toContainText('Mira', { timeout: 45_000 })
  await expect(page.locator('article.assistant')).not.toBeEmpty({ timeout: 45_000 })
  await expect(page.getByRole('status')).toContainText('Listening', { timeout: 60_000 })
  await page.getByText('Under the hood', { exact: true }).click()
  await expect(page.locator('dd').nth(3)).not.toHaveText('—')
  await page.screenshot({ path: '../artifacts/conversation-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Clear conversation' }).click()
  await expect(page.getByRole('heading', { name: 'You have my attention.' })).toBeVisible()
  await page.getByRole('button', { name: 'End conversation' }).click()
  await expect(start).toBeVisible()
  expect(errors).toEqual([])
})

test('responsive page has accessible controls and no horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start conversation' })).toBeEnabled({ timeout: 60_000 })
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `../artifacts/layout-${width}.png`, fullPage: true })
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(accessibility.violations).toEqual([])
})

test('spoken interruption stops old audio and starts the new turn', async ({ playwright }) => {
  const browser = await playwright.chromium.launch({ channel: 'chrome', args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.resolve('../artifacts/interruption-fixture.wav')}%noloop`,
  ] })
  try {
    const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const events: { type: string; turn_id?: number }[] = []
    page.on('websocket', socket => socket.on('framesent', frame => {
      const event = JSON.parse(String(frame.payload))
      events.push({ type: event.type, turn_id: event.turn_id })
    }))
    await page.goto('http://127.0.0.1:8000/')
    await expect(page.getByRole('button', { name: 'Start conversation' })).toBeEnabled()
    await page.getByRole('button', { name: 'Start conversation' }).click()
    await expect(page.locator('article.assistant')).toHaveCount(1, { timeout: 45_000 })
    await expect(page.locator('.interrupted')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('article.user')).toHaveCount(2, { timeout: 30_000 })
    await expect(page.locator('article.user').last()).toContainText('cats')
    await expect(page.locator('article.assistant')).toHaveCount(2, { timeout: 30_000 })
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 60_000 })
    expect(events.filter(e => e.type === 'speech')).toHaveLength(2)
    const secondSpeech = events.findLastIndex(e => e.type === 'speech')
    expect(events.slice(secondSpeech + 1).filter(e => e.type === 'played' && e.turn_id === 1)).toEqual([])
    await page.screenshot({ path: '../artifacts/interruption-desktop.png', fullPage: true })
    await page.getByRole('button', { name: 'End conversation' }).click()
  } finally { await browser.close() }
})
