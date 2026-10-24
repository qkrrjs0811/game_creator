import { test, expect } from '@playwright/test'

test('운동하는 동안 말랑이도 같이 운동하고, 그만하면 다시 쉼', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.locator('[data-mood]')
  await expect(host).toHaveAttribute('data-mood', 'rest')

  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'exercise')
  // 레벨업 배지가 말풍선을 가리지 않게 Lv.2 전(8분)에 찍는다
  await page.clock.fastForward('08:00')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/exercise-mood.png' })

  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'rest')
})

test('운동 중에 연 앱도 말랑이가 같이 운동함', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.reload()
  await expect(page.locator('[data-mood]')).toHaveAttribute('data-mood', 'exercise')
})
