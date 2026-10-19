import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

let cookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined

export async function openWorkspace(page: Page) {
  if (!cookies) {
    const response = await page.request.post('http://127.0.0.1:8000/api/auth/signup', {
      headers: { origin: 'http://127.0.0.1:8000' },
      data: { name: 'Voice Test', email: `voice-${crypto.randomUUID()}@example.com`, password: 'local voice test password' },
    })
    expect(response.status()).toBe(201)
    cookies = await page.context().cookies()
  } else await page.context().addCookies(cookies)
  await page.goto('http://127.0.0.1:8000/#/app')
}
