import { test, expect } from '@playwright/test'

test('오늘 운동 시간을 보여 주고, 상한에 닿으면 안내', async ({ page }) => {
  // 자정을 넘기지 않도록 아침에서 시작한다
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분 / 180분')

  await page.getByTestId('toggle').click()
  await page.clock.fastForward('42:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 42분 / 180분')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/today-42.png' })

  await page.clock.fastForward('02:18:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')
  await expect(page.getByTestId('cap-toast')).toBeVisible()
  await expect(page.getByTestId('timer-label')).toContainText('오늘은 충분히 했어요')
  await page.screenshot({ path: 'test-results/screens/daily-cap.png' })
  await page.getByTestId('cap-toast-close').click()
  await expect(page.getByTestId('cap-toast')).toBeHidden()

  // 더 해도 오늘 분은 늘지 않는다
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')

  // 다시 시작해도 하루 한 번만 띄운다
  await page.getByTestId('toggle').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
})
