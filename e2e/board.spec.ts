import { test, expect, type Page } from '@playwright/test'

/** 나 창을 맨 아래(도장판)까지 넘긴다 */
const toBottom = (page: Page) =>
  page.locator('[data-testid=skills] .sheet').evaluate((el) => (el.scrollTop = el.scrollHeight))

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 운동 m분 */
const day = (date: string, m = 30) => ({
  id: `exercise-${date}`,
  activity: 'exercise',
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('나 창 도장판에 이번 달 찍은 날, 모은 도장, 이어 온 날을 보여 줌', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T12:00:00+09:00') })
  await page.goto('./')
  const records = ['2026-09-30', '2026-10-02', '2026-10-22', '2026-10-23', '2026-10-24'].map((d) => day(d))
  records.push(day('2026-10-25', 10))
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('board-title')).toHaveText('🗓️ 10월 도장판')
  await expect(page.getByTestId('board-stamps')).toHaveText('🌟 모은 도장 5개')
  // 오늘은 아직이라 어제까지 센다
  await expect(page.getByTestId('board-streak')).toHaveText('🔥 3일 이어 왔어요')
  await expect(page.getByTestId('board-day-2')).toHaveText('🌟')
  await expect(page.getByTestId('board-day-24')).toHaveText('🌟')
  await expect(page.getByTestId('board-day-25')).toHaveText('25')
  await expect(page.getByTestId('board-day-25')).toHaveClass(/today/)
  await expect(page.locator('[data-testid^=board-day-]')).toHaveCount(31)

  // 달력은 화면 안에 들어가고 칸끼리 겹치지 않음
  await toBottom(page)
  const board = (await page.getByTestId('board').boundingBox())!
  expect(board.x).toBeGreaterThanOrEqual(0)
  expect(board.x + board.width).toBeLessThanOrEqual(390)
  const d1 = (await page.getByTestId('board-day-1').boundingBox())!
  const d2 = (await page.getByTestId('board-day-2').boundingBox())!
  expect(d1.x + d1.width).toBeLessThanOrEqual(d2.x)
  // 끝까지 넘기면 달력 마지막 줄이 닫기 띠에 가리지 않고, 닫기는 화면 안
  const last = (await page.getByTestId('board-day-31').boundingBox())!
  const close = (await page.getByTestId('skills-close').boundingBox())!
  expect(last.y + last.height).toBeLessThanOrEqual(close.y)
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/screens/board.png' })

  // 켜 둔 타이머로 오늘을 채우면 창을 연 채로 도장이 찍힌다
  await page.getByTestId('skills-close').click()
  await page.getByTestId('toggle').click()
  await page.getByTestId('tab-me').click()
  await page.clock.fastForward('20:00')
  await expect(page.getByTestId('board-day-25')).toHaveText('🌟')
  await expect(page.getByTestId('board-stamps')).toHaveText('🌟 모은 도장 6개')
  await expect(page.getByTestId('board-streak')).toHaveText('🔥 4일 이어 왔어요')
  await toBottom(page)
  await page.screenshot({ path: 'test-results/screens/board-today.png' })
})

test('도장이 없을 때 도장판', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T12:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('board-stamps')).toHaveText('🌟 모은 도장 0개')
  await expect(page.getByTestId('board-streak')).toHaveText('🔥 0일 이어 왔어요')
  await expect(page.getByTestId('board-day-25')).toHaveClass(/today/)
  await page.screenshot({ path: 'test-results/screens/board-empty.png' })
})

test('쉼표로 지킨 날은 도장판에 🛟, 들고 있는 쉼표 수를 보여 줌', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T12:00:00+09:00') })
  await page.goto('./')
  // 10월 1~24일 중 9일·18일만 빠짐: 도장 22개, 두 날 모두 쉼표가 지켜 줌
  const records = []
  for (let d = 1; d <= 24; d++) if (d !== 9 && d !== 18) records.push(day(`2026-10-${String(d).padStart(2, '0')}`))
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('board-stamps')).toHaveText('🌟 모은 도장 22개')
  await expect(page.getByTestId('board-streak')).toHaveText('🔥 24일 이어 왔어요')
  await expect(page.getByTestId('board-rest')).toHaveText('🛟 쉼표 1 / 2개 · 다음 쉼표까지 도장 6개')
  await expect(page.getByTestId('board-day-9')).toHaveText('🛟')
  await expect(page.getByTestId('board-day-9')).toHaveClass(/rested/)
  await expect(page.getByTestId('board-day-18')).toHaveText('🛟')
  await expect(page.getByTestId('board-day-8')).toHaveText('🌟')
  await expect(page.getByTestId('board-day-25')).toHaveText('25')

  // 쉼표 칩은 화면 안에 들어가고 다른 칩과 겹치지 않음
  await page.getByTestId('board-title').scrollIntoViewIfNeeded()
  const rest = (await page.getByTestId('board-rest').boundingBox())!
  expect(rest.x).toBeGreaterThanOrEqual(0)
  expect(rest.x + rest.width).toBeLessThanOrEqual(390)
  const missions = (await page.getByTestId('board-missions').boundingBox())!
  expect(missions.y + missions.height <= rest.y || missions.x + missions.width <= rest.x).toBe(true)
  await page.getByTestId('board-day-18').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: 'test-results/screens/board-rest.png' })
})
