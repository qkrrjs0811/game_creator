import { test, expect, type Page } from '@playwright/test'

/** 나 창을 이번 주 목표 칸까지 넘긴다 */
const toWeek = (page: Page) =>
  page.getByTestId('week-goal').evaluate((el) => el.scrollIntoView({ block: 'center' }))

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 운동 m분 */
const day = (date: string, m = 30) => ({
  id: `exercise-${date}`,
  activity: 'exercise',
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

// 2026-10-19(월) ~ 2026-10-25(일). 오늘은 금요일
test('이번 주 목표는 도장판에서만 보여 주고, 채워도 홈에 따로 배지를 띄우지 않는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T08:00:00+09:00') })
  await page.goto('./')
  const records = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((d) => day(d))
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()

  // 홈에는 이번 주 칩·배지가 없다(펼친 칸에도)
  await page.getByTestId('goal').click()
  await expect(page.getByTestId('goal-week')).toHaveCount(0)
  await expect(page.getByTestId('week-stamp')).toHaveCount(0)
  await page.getByTestId('goal').click()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('week-goal-text')).toHaveText('📅 이번 주 4 / 5일')
  await expect(page.getByTestId('week-done')).toHaveText('🏅 채운 주 아직 없어요')
  for (const i of [0, 1, 2, 3]) await expect(page.getByTestId(`week-day-${i}`)).toHaveText('월화수목'[i] + '🌟')
  await expect(page.getByTestId('week-day-4')).toHaveText('금23')
  await expect(page.getByTestId('week-day-4')).toHaveClass(/now/)
  await expect(page.getByTestId('week-day-6')).toHaveClass(/future/)
  await toWeek(page)
  // 7칸은 화면 안에서 겹치지 않는다
  const first = (await page.getByTestId('week-day-0').boundingBox())!
  const second = (await page.getByTestId('week-day-1').boundingBox())!
  const last = (await page.getByTestId('week-day-6').boundingBox())!
  expect(first.x).toBeGreaterThanOrEqual(0)
  expect(first.x + first.width).toBeLessThanOrEqual(second.x)
  expect(last.x + last.width).toBeLessThanOrEqual(390)
  // 가운데로 넘기면 닫기 띠에 가리지 않는다
  const close = (await page.getByTestId('skills-close').boundingBox())!
  expect(last.y + last.height).toBeLessThanOrEqual(close.y)
  await page.screenshot({ path: 'test-results/screens/week-board.png' })
  await page.getByTestId('skills-close').click()

  // 오늘 목표를 채우면 오늘 도장만 찍히고, 이번 주 목표는 도장판에서 채워진다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('stamp')).toBeVisible()
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('stamp')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/week-home-quiet.png' })

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('week-goal-text')).toHaveText('🏅 이번 주 목표 달성 5 / 5일')
  await expect(page.getByTestId('week-done')).toHaveText('🏅 채운 주 1번')
  await expect(page.getByTestId('week-day-4')).toHaveText('금🌟')
  await toWeek(page)
  await page.screenshot({ path: 'test-results/screens/week-board-done.png' })
})
