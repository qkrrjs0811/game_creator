import { test, expect } from '@playwright/test'

test('홈에 오늘 목표를 보여 주고, 여러 활동을 합쳐 채우면 도장을 한 번 쾅', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('goal-text')).toHaveText('🎯 오늘 목표 0 / 30분')
  await expect(page.getByTestId('stamp')).toBeHidden()

  // 켜 둔 타이머도 바로 센다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('12:00')
  await expect(page.getByTestId('goal-text')).toHaveText('🎯 오늘 목표 12 / 30분')
  const bar = (await page.getByTestId('goal-bar').boundingBox())!
  expect(bar.width).toBeGreaterThan(0)
  // 목표 줄은 카드 안에서 한 줄(누르면 더 보기가 펼쳐지는 버튼이라 손가락 크기)
  const row = (await page.getByTestId('goal').boundingBox())!
  expect(row.height).toBeGreaterThanOrEqual(44)
  expect(row.height).toBeLessThan(52)
  expect(row.x + row.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/screens/goal-12.png' })

  // 운동을 그만하고 독서로 나머지를 채운다
  await page.getByTestId('toggle').click()
  await page.getByTestId('tab-reading').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('17:00')
  await expect(page.getByTestId('goal-text')).toHaveText('🎯 오늘 목표 29 / 30분')
  await expect(page.getByTestId('stamp')).toBeHidden()
  await page.clock.fastForward('01:00')
  await expect(page.getByTestId('goal-text')).toHaveText('🌟 오늘 목표 달성 30 / 30분')
  await expect(page.getByTestId('stamp')).toBeVisible()
  await expect(page.getByTestId('stamp')).toHaveText('🌟 오늘 도장 쾅!')
  await page.waitForTimeout(600)
  const stamp = (await page.getByTestId('stamp').boundingBox())!
  expect(stamp.x).toBeGreaterThanOrEqual(0)
  expect(stamp.x + stamp.width).toBeLessThanOrEqual(390)
  // 도장은 시작·그만하기 버튼을 덮지 않는다
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(stamp.y + stamp.height).toBeLessThanOrEqual(toggle.y)
  await page.screenshot({ path: 'test-results/screens/goal-stamp.png' })

  // 잠깐 뒤 사라지고, 더 해도 오늘은 다시 찍지 않는다
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('stamp')).toBeHidden()
  await page.clock.fastForward('05:00')
  await expect(page.getByTestId('goal-text')).toHaveText('🌟 오늘 목표 달성 35 / 30분')
  await expect(page.getByTestId('stamp')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/goal-done.png' })

  // 다시 열어도 오늘은 한 번만
  await page.reload()
  await expect(page.getByTestId('goal-text')).toHaveText('🌟 오늘 목표 달성 35 / 30분')
  await page.clock.fastForward('00:02')
  await expect(page.getByTestId('stamp')).toBeHidden()

  // 다음 날이 되면 다시 0분부터
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('24:00:00')
  await expect(page.getByTestId('goal-text')).toHaveText('🎯 오늘 목표 0 / 30분')
})

test('닫아 둔 사이 목표를 채웠으면 다시 열 때 도장을 찍는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('31:00')
  // 찍힌 도장 기억을 지워 닫아 둔 사이 채운 것처럼 한다
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.endsWith(':stamp-day')) localStorage.removeItem(k)
  })
  await page.reload()
  await expect(page.getByTestId('stamp')).toBeVisible()
  await expect(page.getByTestId('goal-text')).toHaveText('🌟 오늘 목표 달성 31 / 30분')
})
