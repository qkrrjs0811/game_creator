import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 7시부터 운동 m분 */
const rec = (date: string, m: number) => ({
  id: `exercise-${date}`,
  activity: 'exercise',
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('기록이 없어도 나 창 맨 위에 곧 받을 보상 3개가 보인다', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('rewards')).toBeVisible()
  await expect(page.getByTestId('reward-list').locator('li')).toHaveCount(3)
  await expect(page.getByTestId('reward-need-stamp')).toHaveText('도장 7개 더')
})

test('도장 5개면 도장 모자가 가장 먼저, 막대와 남은 양이 보인다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T20:00:00+09:00') })
  await page.goto('./')
  const records = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map((d) => rec(d, 30))
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  await page.getByTestId('tab-me').click()

  const items = page.getByTestId('reward-list').locator('li')
  await expect(items).toHaveCount(3)
  await expect(items.first()).toHaveAttribute('data-testid', 'reward-stamp')
  await expect(page.getByTestId('reward-name-stamp')).toHaveText('반짝 도장 별핀')
  await expect(page.getByTestId('reward-need-stamp')).toHaveText('도장 2개 더')

  // 글자가 칸 밖으로 넘치거나 잘리지 않는다
  for (const li of await items.all()) {
    const box = (await li.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    for (const t of await li.locator('b, small').all()) {
      const over = await t.evaluate((el) => el.scrollWidth > el.clientWidth)
      expect(over).toBe(false)
    }
  }
  await page.screenshot({ path: 'test-results/screens/me-rewards.png' })
})
