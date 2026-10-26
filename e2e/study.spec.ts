import { test, expect } from '@playwright/test'

test('공부 탭에서 공부 타이머를 켜면 지능이 오르고, 그동안 운동은 켤 수 없음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.locator('[data-mood]')
  await page.getByTestId('tab-study').click()
  await expect(page.getByTestId('tab-study')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('toggle')).toHaveText('공부 시작')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분')
  await expect(page.getByTestId('timer-label')).toHaveText('공부하는 동안 지능이 올라요')

  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'study')
  await expect(page.getByTestId('tab-live-study')).toBeVisible()
  // 레벨업 배지가 말풍선을 가리지 않게 Lv.2 전(8분)에 찍는다
  await page.clock.fastForward('08:00')
  await expect(page.getByTestId('timer-label')).toHaveText('공부 중 · 지능이 오르고 있어요')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/study-running.png' })

  // 공부 중에는 운동 탭에서 운동을 켤 수 없다
  await page.getByTestId('tab-exercise').click()
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await expect(page.getByTestId('toggle')).toBeDisabled()
  await expect(page.getByTestId('timer-label')).toHaveText('공부 중이에요 · 그만하면 운동을 켤 수 있어요')
  await expect(page.getByTestId('timer')).toHaveText('00:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분')
  await page.screenshot({ path: 'test-results/screens/study-busy.png' })
  expect((await page.evaluate(() => window.__debug.getSave().active))?.activity).toBe('study')

  // 공부 25분 → 지능 5+5, 힘·체력은 그대로
  await page.getByTestId('tab-study').click()
  await page.clock.fastForward('17:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary-title')).toHaveText('🎉 공부 25분 했어요!')
  await expect(page.getByTestId('session-summary-detail')).toHaveText('EXP +250 · 🧠 지능 +5')
  await expect(host).toHaveAttribute('data-mood', 'rest')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/study-summary.png' })

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-int')).toHaveText('10')
  await expect(page.getByTestId('stat-value-str')).toHaveText('5')
  await expect(page.getByTestId('stat-next-int')).toHaveText('공부 5분 더')
  await page.screenshot({ path: 'test-results/screens/study-stats.png' })
})

test('공부는 하루 2시간까지, 다 채우면 안내하고 운동은 따로 셈', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('tab-study').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('02:00:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 120분 / 120분')
  await expect(page.getByTestId('cap-toast')).toBeVisible()
  await expect(page.getByTestId('cap-toast')).toContainText('오늘 공부는 여기까지!')
  await expect(page.locator('[data-mood]')).toHaveAttribute('data-mood', 'full')

  // 새로 고쳐도 켜져 있는 공부 탭으로 연다
  await page.reload()
  await expect(page.getByTestId('tab-study')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('toggle')).toHaveText('그만하기')
  await page.getByTestId('toggle').click()

  // 운동은 상한이 따로라 오늘 더 할 수 있다
  await page.getByTestId('tab-exercise').click()
  await expect(page.getByTestId('toggle')).toBeEnabled()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 10분')
  await page.getByTestId('toggle').click()
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-int')).toHaveText('29')
  await expect(page.getByTestId('stat-value-str')).toHaveText('6')
  await expect(page.getByTestId('stat-next-int')).toHaveText('내일 공부 5분 더')
})

test('아래 탭: 운동·공부·독서 모두 누를 수 있음', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('tab-exercise')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('tab-study')).toBeEnabled()
  await expect(page.getByTestId('tab-reading')).toBeEnabled()
  await expect(page.locator('nav.tabs .tab:disabled')).toHaveCount(0)
})
