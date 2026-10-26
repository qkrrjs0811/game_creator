import { test, expect, type Locator } from '@playwright/test'

async function box(l: Locator) {
  return (await l.boundingBox())!
}

test('오늘의 미션은 펼침 없이 오늘 목표 줄 안의 한 마디와 그 활동 탭의 ⭐로 보인다', async ({ page }) => {
  // 2026-10-25는 휴식 10분 미션
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const goal = page.getByTestId('goal')
  const mission = page.getByTestId('mission')

  // "오늘 더 보기" 펼침은 없다
  await expect(page.getByTestId('today-more')).toHaveCount(0)
  await expect(page.getByTestId('goal-more')).toHaveCount(0)
  // 미션 한 마디는 오늘 목표 줄 안에 바로 보인다
  await expect(mission).toBeVisible()
  await expect(mission).toHaveText('📜 휴식 0 / 10분')
  const g = await box(goal)
  const m = await box(mission)
  const t = await box(page.getByTestId('goal-text'))
  expect(m.y).toBeGreaterThanOrEqual(g.y)
  expect(m.y + m.height).toBeLessThanOrEqual(g.y + g.height + 1)
  expect(t.x + t.width).toBeLessThanOrEqual(m.x)
  expect(m.x + m.width).toBeLessThanOrEqual(390 - 14)
  // 막대도 사라지지 않는다
  expect((await box(page.locator('.goal-bar'))).width).toBeGreaterThan(30)

  // 미션 활동 탭에만 작은 ⭐
  const star = page.getByTestId('tab-mission-relax')
  await expect(star).toBeVisible()
  await expect(star).toHaveText('⭐')
  for (const id of ['exercise', 'study', 'reading']) await expect(page.getByTestId(`tab-mission-${id}`)).toBeHidden()
  const s = await box(star)
  const tab = await box(page.getByTestId('tab-relax'))
  expect(s.x).toBeGreaterThanOrEqual(tab.x)
  expect(s.x + s.width).toBeLessThanOrEqual(tab.x + tab.width)
  // 오늘의 다짐·이번 주 칩은 그대로 없다
  await expect(page.getByTestId('pledge')).toHaveCount(0)
  await expect(page.getByTestId('goal-week')).toHaveCount(0)
  // 시작 버튼과 겹치지 않는다
  const toggle = await box(page.getByTestId('toggle'))
  expect(g.y + g.height).toBeLessThanOrEqual(toggle.y)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/today-more.png' })

  // 미션을 채우면 한 마디는 완료가 되고 ⭐는 사라진다
  await page.getByTestId('tab-relax').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await expect(mission).toHaveText('📜 휴식 완료!')
  await expect(star).toBeHidden()
  await page.clock.fastForward('00:05')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/mission-inline-done.png' })
})
