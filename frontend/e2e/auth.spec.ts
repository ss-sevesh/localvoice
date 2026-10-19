import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('public landing, local signup, session restore, logout and login work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const email = `account-${crypto.randomUUID()}@example.com`
  const password = 'my private thinking space'
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('big thoughts.')
  await page.getByRole('link', { name: 'Find your thinking space' }).click()
  await page.getByLabel('Your name').fill('Mira')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Let’s talk it through.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.goto('/#/app')
  await expect(page.getByRole('button', { name: 'Start conversation' })).toHaveCount(0)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('wrong password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Start conversation' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()
  expect(errors).toEqual([])
})

test('landing and account screens are responsive, accessible and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const route of ['/', '/#/signup', '/#/login']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(result.violations).toEqual([])
      const label = route.includes('signup') ? 'signup' : route.includes('login') ? 'login' : 'landing'
      await page.screenshot({ path: `../artifacts/${label}-${width}.png`, fullPage: true })
    }
  }
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
})
