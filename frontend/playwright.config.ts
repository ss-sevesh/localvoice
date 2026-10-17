import { defineConfig } from '@playwright/test'
import path from 'node:path'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  outputDir: '../artifacts/browser',
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:8000',
    permissions: ['microphone'],
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    launchOptions: { args: [
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.resolve('../artifacts/microphone-fixture.wav')}%noloop`,
    ] },
  },
})
