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
test('이번 주 목표를 홈·도장판에 보여 주고, 채우는 순간 한 번만 축하', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T08:00:00+09:00') })
  await page.goto('./')
  const records = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((d) => day(d))
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()

  // 홈 오늘 목표 줄 끝에 작은 칩. 줄은 한 줄로 카드 안에
  await expect(page.getByTestId('goal-week')).toHaveText('📅 4/5')
  const row = (await page.getByTestId('goal').boundingBox())!
  expect(row.height).toBeLessThan(24)
  const chip = (await page.getByTestId('goal-week').boundingBox())!
  expect(chip.x + chip.width).toBeLessThanOrEqual(390 - 14)

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

  // 오늘 목표를 채우면 오늘 도장 뒤에 주간 도장으로 바뀐다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('stamp')).toBeVisible()
  await expect(page.getByTestId('week-stamp')).toBeHidden()
  await page.clock.fastForward('00:02')
  await expect(page.getByTestId('week-stamp')).toBeVisible()
  await expect(page.getByTestId('week-stamp')).toHaveText('🏅 이번 주 목표 달성!')
  await expect(page.getByTestId('stamp')).toBeHidden()
  await expect(page.getByTestId('goal-week')).toHaveText('🏅 5/5')
  await page.waitForTimeout(600)
  const badge = (await page.getByTestId('week-stamp').boundingBox())!
  expect(badge.x).toBeGreaterThanOrEqual(0)
  expect(badge.x + badge.width).toBeLessThanOrEqual(390)
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(badge.y + badge.height).toBeLessThanOrEqual(toggle.y)
  await page.screenshot({ path: 'test-results/screens/week-stamp.png' })

  // 잠깐 뒤 사라지고, 다시 열어도 이번 주에는 다시 안 뜬다
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('week-stamp')).toBeHidden()
  await page.reload()
  await page.clock.fastForward('00:03')
  await expect(page.getByTestId('week-stamp')).toBeHidden()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('week-goal-text')).toHaveText('🏅 이번 주 목표 달성 5 / 5일')
  await expect(page.getByTestId('week-done')).toHaveText('🏅 채운 주 1번')
  await expect(page.getByTestId('week-day-4')).toHaveText('금🌟')
  await toWeek(page)
  await page.screenshot({ path: 'test-results/screens/week-board-done.png' })
})

test('닫아 둔 사이 이번 주 목표를 채웠으면 다시 열 때 주간 도장', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T12:00:00+09:00') })
  const records = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].map((d) => day(d))
  // 앱이 뜨기 전에 저장을 넣어 둔다(먼저 띄운 창이 저장을 따라가 축하를 먼저 해 버리지 않게)
  await page.addInitScript((s) => {
    if (!localStorage.getItem('growth-game:save')) localStorage.setItem('growth-game:save', s)
  }, JSON.stringify({ ...base, records }))
  await page.goto('./')
  // 오늘 도장을 먼저 보여 준 뒤 주간 도장
  await expect(page.getByTestId('stamp')).toBeVisible()
  await page.clock.fastForward('00:02')
  await expect(page.getByTestId('week-stamp')).toBeVisible()
  await expect(page.getByTestId('goal-week')).toHaveText('🏅 5/5')
})
