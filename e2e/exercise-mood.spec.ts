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

test('오늘 상한을 채우면 말랑이가 쉬자고 하고, 다음 날엔 다시 같이 운동함', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.locator('[data-mood]')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('02:59:00')
  await expect(host).toHaveAttribute('data-mood', 'exercise')

  await page.clock.fastForward('01:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')
  await expect(host).toHaveAttribute('data-mood', 'full')
  await page.getByTestId('cap-toast-close').click()
  // 레벨업 연출이 끝나고 말풍선이 다시 나온 뒤 찍는다
  await page.clock.runFor(5000)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/exercise-mood-full.png' })

  // 새로 고쳐도 그대로, 그만하면 쉼
  await page.reload()
  await expect(host).toHaveAttribute('data-mood', 'full')
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'rest')

  // 다음 날 다시 시작하면 같이 운동한다
  await page.clock.fastForward('24:00:00')
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'exercise')
})

test('운동 중에 연 앱도 말랑이가 같이 운동함', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.reload()
  await expect(page.locator('[data-mood]')).toHaveAttribute('data-mood', 'exercise')
})
