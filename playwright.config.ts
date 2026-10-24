import { defineConfig } from '@playwright/test'

const baseURL = 'http://localhost:4173/game_creator/'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL, viewport: { width: 390, height: 844 } },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: false },
})
