import { test, expect } from '@playwright/test'

test('홈에 오늘의 미션을 보여 주고, 그 활동으로 채우면 미션 도장을 한 번 찍는다', async ({ page }) => {
  // 2026-10-25는 휴식 10분 미션
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 0 / 10분')
  await expect(page.getByTestId('mission-stamp')).toBeHidden()

  // 다른 활동은 미션에 세지 않는다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('05:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 0 / 10분')

  // 휴식은 켜 둔 동안 바로 센다
  await page.getByTestId('tab-relax').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('04:00')
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 4 / 10분')
  // 미션 한 마디는 오늘 목표 줄 안에 바로 보인다
  const chip = (await page.getByTestId('mission').boundingBox())!
  expect(chip.x).toBeGreaterThanOrEqual(14)
  expect(chip.x + chip.width).toBeLessThanOrEqual(390 - 14)
  await page.screenshot({ path: 'test-results/screens/mission-progress.png' })

  await page.clock.fastForward('06:00')
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 완료!')
  await expect(page.getByTestId('mission-stamp')).toBeVisible()
  await expect(page.getByTestId('mission-stamp')).toHaveText('📜 미션 완료!')
  await page.waitForTimeout(600)
  const stamp = (await page.getByTestId('mission-stamp').boundingBox())!
  expect(stamp.x).toBeGreaterThanOrEqual(0)
  expect(stamp.x + stamp.width).toBeLessThanOrEqual(390)
  // 도장은 시작·그만하기 버튼을 덮지 않는다
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(stamp.y + stamp.height).toBeLessThanOrEqual(toggle.y)
  await page.screenshot({ path: 'test-results/screens/mission-stamp.png' })

  // 잠깐 뒤 사라지고, 다시 열어도 오늘은 다시 찍지 않는다
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('mission-stamp')).toBeHidden()
  await page.reload()
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 완료!')
  await page.clock.fastForward('00:02')
  await expect(page.getByTestId('mission-stamp')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/mission-done.png' })

  // 다음 날은 운동 20분 미션
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('24:00:00')
  await expect(page.getByTestId('mission')).toHaveText('📜 운동 0 / 20분')
})

test('오늘 도장과 미션을 함께 채우면 오늘 도장 뒤에 미션 도장을 찍는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('20:00')
  await page.getByTestId('toggle').click()
  await page.getByTestId('tab-relax').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await expect(page.getByTestId('stamp')).toBeVisible()
  await expect(page.getByTestId('mission-stamp')).toBeHidden()
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('stamp')).toBeHidden()
  await expect(page.getByTestId('mission-stamp')).toBeVisible()
})
