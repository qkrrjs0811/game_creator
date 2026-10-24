import { test, expect } from '@playwright/test'

test('처음 열면 Lv.1, 콘솔 오류 없음, 스크린샷 저장', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await page.screenshot({ path: 'test-results/screens/home.png' })
  expect(errors).toEqual([])
})

test('30분 운동하면 Lv.3', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('timer')).toHaveText('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('exp-text')).toHaveText('EXP 50 / 200')
  await page.screenshot({ path: 'test-results/screens/after-30min.png' })
})

test('세션 중 새로고침해도 이어서 흐름', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await page.reload()
  await expect(page.getByTestId('toggle')).toHaveText('그만하기')
  await expect(page.getByTestId('timer')).toHaveText(/^10:0\d$/)
})
