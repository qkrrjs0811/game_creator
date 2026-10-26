import { test, expect, type Locator } from '@playwright/test'

async function box(l: Locator) {
  return (await l.boundingBox())!
}

test('홈 타이머 카드는 시작 버튼·오늘 한 시간·오늘 목표만 두고, 목표 줄을 누르면 미션이 펼쳐진다', async ({ page }) => {
  // 2026-10-25는 휴식 10분 미션
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const goal = page.getByTestId('goal')
  const more = page.getByTestId('today-more')

  // 기본은 접혀 있다
  await expect(more).toBeHidden()
  await expect(page.getByTestId('mission')).toBeHidden()
  await expect(goal).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('goal-more')).toHaveText('더 보기 ▾')
  // 오늘 한 시간은 시작 버튼 옆 한 줄
  const toggle = await box(page.getByTestId('toggle'))
  const today = await box(page.getByTestId('today'))
  expect(Math.abs(today.y + today.height / 2 - (toggle.y + toggle.height / 2))).toBeLessThan(2)
  expect(toggle.x + toggle.width).toBeLessThanOrEqual(today.x)
  expect(today.x + today.width).toBeLessThanOrEqual(390 - 14)
  // 목표 줄은 누르기 충분히 크고 카드 안
  const g = await box(goal)
  expect(g.height).toBeGreaterThanOrEqual(44)
  expect(g.x + g.width).toBeLessThanOrEqual(390 - 14)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/home-folded.png' })

  // 누르면 펼쳐진다
  await goal.click()
  await expect(more).toBeVisible()
  await expect(goal).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('goal-more')).toHaveText('접기 ▴')
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 0 / 10분')
  // 이번 주 목표는 도장판에서만 보여 준다
  await expect(page.getByTestId('goal-week')).toHaveCount(0)
  // 오늘의 다짐은 뺐다
  await expect(page.getByTestId('pledge')).toHaveCount(0)
  await expect(more).not.toContainText('다짐')
  const m = await box(more)
  const card = await box(page.locator('.timer-card'))
  expect(m.x).toBeGreaterThanOrEqual(card.x)
  expect(m.x + m.width).toBeLessThanOrEqual(card.x + card.width)
  // 펼친 칸은 시작 버튼 위에 있고 겹치지 않는다
  const t2 = await box(page.getByTestId('toggle'))
  expect(m.y + m.height).toBeLessThanOrEqual(t2.y)
  const tabs = await box(page.locator('.tabs'))
  expect(t2.y + t2.height).toBeLessThanOrEqual(tabs.y)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/today-more.png' })

  // 다시 누르면 접힌다
  await goal.click()
  await expect(more).toBeHidden()
  await expect(goal).toHaveAttribute('aria-expanded', 'false')
})
