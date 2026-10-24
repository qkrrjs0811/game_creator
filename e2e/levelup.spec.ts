import { test, expect } from '@playwright/test'

test('레벨이 오르는 순간 축하 연출, 새로 열 때는 띄우지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('levelup')).toBeHidden()

  // 10분(경험치 100)이면 Lv.2
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('09:58')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  await expect(page.getByTestId('levelup')).toBeHidden()

  await page.clock.fastForward('00:03')
  await expect(page.getByTestId('level')).toHaveText('Lv.2')
  await expect(page.getByTestId('levelup')).toBeVisible()
  await expect(page.getByTestId('levelup-level')).toHaveText('Lv.2 달성!')
  // 배지가 다 커지고 색종이가 퍼진 순간을 찍는다
  await page.clock.runFor(450)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/screens/levelup.png' })

  // 잠시 뒤 사라진다
  await page.clock.runFor(4000)
  await expect(page.getByTestId('levelup')).toBeHidden()

  // 새로고침하면 지금 레벨은 축하하지 않는다
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.2')
  await page.clock.runFor(1500)
  await expect(page.getByTestId('levelup')).toBeHidden()
})
