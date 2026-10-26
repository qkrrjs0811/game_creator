import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
/** 2026-10-05(월)부터 n주 동안 주마다 월~금 아침 운동 30분(채운 주 n번) */
const weeks = (n: number) =>
  Array.from({ length: n * 5 }, (_, i) => {
    const day = 5 + Math.floor(i / 5) * 7 + (i % 5)
    const start = Date.parse('2026-10-05T07:00:00+09:00') + (day - 5) * 86_400_000
    return { id: `exercise-${i}`, activity: 'exercise', startedAt: start, endedAt: start + 30 * 60_000 }
  })

test('주간 목표를 처음 채우면 레몬 말랑을 얻고, 4·12번 색은 잠겨서 몇 번 채울지 알려 줌', async ({ page }) => {
  // 2026-10-05 주에 4일만 채움. 오늘은 금요일 10-09
  await page.clock.install({ time: new Date('2026-10-09T06:00:00+09:00') })
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records: weeks(1).slice(0, 4) })
  await page.reload()

  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('cosmetic-tab-color').click()
  await expect(page.getByTestId('cosmetic-color-week1')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-color-week1')).toContainText('🔒 주간 목표 1번')
  await expect(page.getByTestId('cosmetic-color-week4')).toContainText('🔒 주간 목표 4번')
  await expect(page.getByTestId('cosmetic-color-week12')).toContainText('🔒 주간 목표 12번')
  await page.getByTestId('cosmetic-color-week12').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screens/week-colors-locked.png' })
  await page.getByTestId('cosmetics-close').click()

  // 오늘 30분을 채우면 다섯째 도장 → 이번 주 목표 달성 → 레몬 말랑
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('stamp')).toBeVisible()
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('cosmetic-tab-color').click()
  await expect(page.getByTestId('cosmetic-color-week1')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-color-week1')).toContainText('레몬 말랑')
  await expect(page.getByTestId('cosmetic-color-week4')).toHaveAttribute('data-state', 'locked')
  await page.getByTestId('wear-color-week1').click()
  await expect(page.getByTestId('worn-color')).toContainText('레몬 말랑')
  await page.screenshot({ path: 'test-results/screens/week-colors-owned.png' })
  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'color-week1')
  await page.getByTestId('toggle').click()

  // 입은 것만 저장되고 주간 색은 기록에서 센다
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'color-week1')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual(['color-week1'])
  expect(s.cosmetics).toEqual([])
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/home-week-color-1.png' })
})

test('주간 목표를 12번 채웠으면 세 주간 색을 모두 입을 수 있음', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-01-04T12:00:00+09:00') })
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records: weeks(12) })
  await page.reload()
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('cosmetic-tab-color').click()
  await expect(page.getByTestId('cosmetic-tab-color')).toContainText('색 3')
  for (const n of [4, 12]) {
    await page.getByTestId(`wear-color-week${n}`).click()
    await page.getByTestId('cosmetics-close').click()
    await expect(page.getByTestId('scene')).toHaveAttribute('data-look', `color-week${n}`)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/screens/home-week-color-${n}.png` })
    await page.getByTestId('open-cosmetics').click()
  }
})
