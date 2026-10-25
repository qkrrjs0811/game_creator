import { test, expect, type Page } from '@playwright/test'

/** 나 창을 내 기록 칸까지 넘긴다 */
const toHistory = (page: Page) => page.getByTestId('history').evaluate((el) => el.scrollIntoView({ block: 'center' }))

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 hour 시부터 활동 m분 */
const rec = (activity: string, date: string, m: number, hour = 7) => ({
  id: `${activity}-${date}-${hour}`,
  activity,
  startedAt: at(`${date}T${String(hour).padStart(2, '0')}:00:00`),
  endedAt: at(`${date}T${String(hour).padStart(2, '0')}:00:00`) + m * 60_000,
})

test('기록이 없으면 내 기록 칸이 비었다고 알려 준다', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('hist-empty')).toBeVisible()
  await expect(page.getByTestId('hist-empty')).toContainText('아직 기록이 없어요')
  await expect(page.getByTestId('hist-body')).toBeHidden()
})

// 2026-10-23(금) 아침. 최근 7일은 10-17(토) ~ 10-23(금)
test('나 창 내 기록: 최근 7일 막대·이번 주 합계·누적·가장 많이 한 날', async ({ page }) => {
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

  await expect(page.getByTestId('hist-empty')).toBeHidden()
  await expect(page.getByTestId('hist-week')).toHaveText('이번 주 3시간 35분 · 지난주보다 +1시간 35분')
  await expect(page.getByTestId('hist-best')).toHaveText('🏆 가장 많이 한 날 · 10월 21일 2시간 10분')
  await expect(page.getByTestId('hist-total-exercise')).toHaveText('운동 3시간 30분')
  await expect(page.getByTestId('hist-total-study')).toHaveText('공부 55분')
  await expect(page.getByTestId('hist-total-reading')).toHaveText('독서 50분')
  await expect(page.getByTestId('hist-total-relax')).toHaveText('휴식 20분')

  // 요일 글자, 오늘 표시, 도장 찍은 날 별
  await expect(page.getByTestId('hist-day-0')).toHaveText('토')
  await expect(page.getByTestId('hist-day-2')).toHaveText('🌟월')
  await expect(page.getByTestId('hist-day-6')).toHaveText('오늘')
  await expect(page.getByTestId('hist-day-6')).toHaveClass(/now/)
  // 21일은 운동·독서·휴식 세 색이 쌓이고, 가장 많이 한 날이라 칸을 꽉 채운다
  const best = page.getByTestId('hist-day-4')
  await expect(best.locator('.hist-seg')).toHaveCount(3)
  const bar = (await best.locator('.hist-bar').boundingBox())!
  const segs = await best.locator('.hist-seg').evaluateAll((els) => els.reduce((s, e) => s + e.getBoundingClientRect().height, 0))
  expect(Math.abs(segs - bar.height)).toBeLessThan(2)
  // 쉬는 날은 빈 막대
  await expect(page.getByTestId('hist-day-1').locator('.hist-seg')).toHaveCount(0)

  await toHistory(page)
  // 7칸과 누적 칸은 화면 안에서 겹치지 않고, 닫기 띠에 가리지 않는다
  const first = (await page.getByTestId('hist-day-0').boundingBox())!
  const second = (await page.getByTestId('hist-day-1').boundingBox())!
  const last = (await page.getByTestId('hist-day-6').boundingBox())!
  expect(first.x).toBeGreaterThanOrEqual(0)
  expect(first.x + first.width).toBeLessThanOrEqual(second.x)
  expect(last.x + last.width).toBeLessThanOrEqual(390)
  for (const id of ['exercise', 'study', 'reading', 'relax']) {
    const chip = (await page.getByTestId(`hist-total-${id}`).boundingBox())!
    expect(chip.height).toBeLessThan(40)
    expect(chip.x + chip.width).toBeLessThanOrEqual(390)
  }
  const close = (await page.getByTestId('skills-close').boundingBox())!
  const week = (await page.getByTestId('hist-week').boundingBox())!
  expect(week.y + week.height).toBeLessThanOrEqual(close.y)
  await page.screenshot({ path: 'test-results/screens/history.png' })
})

test('막대를 누르면 그날 말풍선, 앞뒤 주로 넘겨 본다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T08:00:00+09:00') })
  await page.goto('./')
  const records = [
    rec('exercise', '2026-10-06', 40),
    rec('exercise', '2026-10-21', 60),
    rec('reading', '2026-10-21', 50, 9),
    rec('relax', '2026-10-21', 20, 11),
    rec('study', '2026-10-23', 12),
  ]
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  await page.getByTestId('tab-me').click()
  await toHistory(page)

  await expect(page.getByTestId('hist-range')).toHaveText('최근 7일')
  await expect(page.getByTestId('hist-next')).toBeDisabled()
  await expect(page.getByTestId('hist-tip')).toBeHidden()

  // 21일(수) 막대를 누르면 활동별 분과 도장
  await page.getByTestId('hist-day-4').click()
  const tip = page.getByTestId('hist-tip')
  await expect(tip).toBeVisible()
  await expect(page.getByTestId('hist-tip-title')).toHaveText('10월 21일 수요일 · 2시간 10분')
  await expect(page.getByTestId('hist-tip-parts')).toHaveText('운동 1시간독서 50분휴식 20분')
  await expect(page.getByTestId('hist-tip-stamp')).toHaveText('🌟 도장 찍은 날')
  await expect(page.getByTestId('hist-day-4')).toHaveClass(/sel/)
  // 말풍선은 막대 아래, 누적 칸 위에 겹치지 않고 화면 안에 있다
  const bars = (await page.getByTestId('hist-bars').boundingBox())!
  const box = (await tip.boundingBox())!
  const totals = (await page.getByTestId('hist-totals').boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(bars.y + bars.height)
  expect(box.y + box.height).toBeLessThanOrEqual(totals.y)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  // 막대 칸은 손가락으로 누르기 충분히 크다
  const cell = (await page.getByTestId('hist-day-4').boundingBox())!
  expect(cell.width).toBeGreaterThanOrEqual(44)
  await tip.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: 'test-results/screens/history-tip.png' })

  // 오늘은 도장까지 남은 분
  await page.getByTestId('hist-day-6').click()
  await expect(page.getByTestId('hist-tip-title')).toHaveText('오늘 10월 23일 · 12분')
  await expect(page.getByTestId('hist-tip-stamp')).toHaveText('🎯 도장까지 18분 더')
  // 같은 막대를 다시 누르면 닫힌다
  await page.getByTestId('hist-day-6').click()
  await expect(tip).toBeHidden()

  // 앞 주로 넘기기: 10-10 ~ 10-16, 그 앞 10-03 ~ 10-09 에서 멈춘다
  await page.getByTestId('hist-prev').click()
  await expect(page.getByTestId('hist-range')).toHaveText('10월 10일 ~ 16일')
  await expect(page.getByTestId('hist-next')).toBeEnabled()
  await page.getByTestId('hist-prev').click()
  await expect(page.getByTestId('hist-range')).toHaveText('10월 3일 ~ 9일')
  await expect(page.getByTestId('hist-prev')).toBeDisabled()
  await page.getByTestId('hist-day-3').click()
  await expect(page.getByTestId('hist-tip-title')).toHaveText('10월 6일 화요일 · 40분')
  await expect(page.getByTestId('hist-tip-stamp')).toHaveText('🌟 도장 찍은 날')
  await page.getByTestId('hist-day-0').click()
  await expect(page.getByTestId('hist-tip-stamp')).toHaveText('😴 쉬어 간 날')
  await page.getByTestId('hist-bars').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: 'test-results/screens/history-older.png' })

  // 다시 최근으로 넘기면 말풍선은 닫히고, 창을 닫았다 열면 최근 7일부터
  await page.getByTestId('hist-next').click()
  await expect(tip).toBeHidden()
  await page.getByTestId('skills-close').click()
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('hist-range')).toHaveText('최근 7일')
})
