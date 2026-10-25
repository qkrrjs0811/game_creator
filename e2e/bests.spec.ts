import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 hour 시부터 활동 m분 */
const rec = (activity: string, date: string, m: number, hour = 7) => ({
  id: `${activity}-${date}-${hour}`,
  activity,
  startedAt: at(`${date}T${String(hour).padStart(2, '0')}:00:00`),
  endedAt: at(`${date}T${String(hour).padStart(2, '0')}:00:00`) + m * 60_000,
})

test('기록이 없으면 내 최고 기록 칸을 숨긴다', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skills')).toBeVisible()
  await expect(page.getByTestId('bests')).toBeHidden()
})

// 2026-10-23(금) 아침
test('나 창 내 최고 기록: 활동별 한 번 최고, 하루·주 최고, 가장 길게 이어 온 날', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T08:00:00+09:00') })
  await page.goto('./')
  const records = [
    rec('exercise', '2026-10-14', 100),
    rec('exercise', '2026-10-17', 20),
    rec('exercise', '2026-10-19', 30),
    rec('study', '2026-10-19', 40, 9),
    rec('exercise', '2026-10-21', 60),
    rec('reading', '2026-10-21', 50, 9),
    rec('relax', '2026-10-21', 20, 11),
    rec('study', '2026-10-23', 15),
  ]
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  await page.getByTestId('tab-me').click()

  const bests = page.getByTestId('bests')
  await bests.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await expect(bests).toBeVisible()
  await expect(page.getByTestId('best-session-exercise')).toHaveText('🏃운동 1시간 40분')
  await expect(page.getByTestId('best-session-study')).toHaveText('✏️공부 40분')
  await expect(page.getByTestId('best-session-reading')).toHaveText('📚독서 50분')
  await expect(page.getByTestId('best-session-relax')).toHaveText('🍵휴식 20분')
  await expect(page.getByTestId('best-day')).toContainText('10월 21일')
  await expect(page.getByTestId('best-day')).toContainText('2시간 10분')
  await expect(page.getByTestId('best-week')).toContainText('10월 19일~25일')
  await expect(page.getByTestId('best-week')).toContainText('3시간 35분')
  await expect(page.getByTestId('best-streak')).toContainText(/\d+일/)

  // 글자가 칸 밖으로 넘치지 않는다
  const overflow = await page
    .getByTestId('best-card')
    .locator('li')
    .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
  expect(overflow).toBe(0)
  await page.screenshot({ path: 'test-results/screens/bests.png' })
})
