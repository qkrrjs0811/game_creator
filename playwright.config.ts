import { defineConfig } from '@playwright/test'

const baseURL = 'http://localhost:4173/game_creator/'

export default defineConfig({
  testDir: 'e2e',
  // 여러 테스트가 함께 돌면 기기 부하로 한 테스트가 30초를 넘기곤 한다(따로 돌리면 통과)
  timeout: 60_000,
  use: { baseURL, viewport: { width: 390, height: 844 } },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: false },
})
