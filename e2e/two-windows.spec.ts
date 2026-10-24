import { test, expect } from '@playwright/test'

// 설치한 앱과 브라우저 탭을 함께 열어 둔 경우. 오래된 창이 새 기록을 덮어쓰면 안 된다
test('다른 창에서 한 운동을 따라가고 덮어쓰지 않음', async ({ context }) => {
  const other = await context.newPage()
  await other.goto('./')
  await expect(other.getByTestId('level')).toHaveText('Lv.1')

  const page = await context.newPage()
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  // 먼저 열어 둔 창도 새로 고치지 않고 Lv.3이 된다
  await expect(other.getByTestId('level')).toHaveText('Lv.3')
  await other.screenshot({ path: 'test-results/screens/two-windows.png' })

  // 먼저 열어 둔 창에서 무언가 해도 기록은 남는다
  await other.getByTestId('toggle').click()
  await expect(other.getByTestId('toggle')).toHaveText('그만하기')
  await other.getByTestId('toggle').click()
  expect((await other.evaluate(() => window.__debug.getSave().records.length))).toBe(2)
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  expect((await page.evaluate(() => window.__debug.getSave().records.length))).toBe(2)
})
