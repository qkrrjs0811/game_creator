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

async function seedBests(page: import('@playwright/test').Page, records: object[], seen: string | null) {
  await page.goto('./')
  await page.evaluate(
    ([s, v]) => {
      localStorage.setItem('growth-game:save', JSON.stringify(s))
      // 빈 저장으로 처음 연 창이 남긴 값은 지운다
      if (v === null) localStorage.removeItem('growth-game:save:seen-bests')
      else localStorage.setItem('growth-game:save:seen-bests', v)
    },
    [{ ...base, records }, seen] as const,
  )
  await page.reload()
}

// 2026-10-24(토) 아침. 22일(목)에 운동 40분 한 게 지금까지의 최고
test('타이머를 마쳐 하루 최고를 넘으면 배지를 한 번, 새로고침엔 다시 안 띄움', async ({ page }) => {
  // 45분을 흘리고 같은 자리의 다른 배지가 사라지길 기다려 느린 실행에선 오래 걸린다
  test.setTimeout(90_000)
  await page.clock.install({ time: new Date('2026-10-24T09:00:00+09:00') })
  await seedBests(page, [rec('exercise', '2026-10-22', 40)], null)
  const best = page.getByTestId('best-stamp')
  await page.clock.runFor(1500)
  // 처음 여는 창은 기억만 한다
  await expect(best).toBeHidden()
  const seen = await page.evaluate(() => localStorage.getItem('growth-game:save:seen-bests'))
  expect(JSON.parse(seen!)).toMatchObject({ day: 40, week: 40 })
  // 시계가 실제로도 흐르면 느린 실행에서 3.5초짜리 배지가 재기 전에 사라진다 — 멈춰 두고 runFor로만 흘린다
  const fakeNow = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(fakeNow + 1000)

  await page.getByTestId('toggle').click()
  await page.clock.fastForward('45:01')
  await page.clock.runFor(1500)
  // 켜 둔 동안은 아직 알리지 않는다
  await expect(best).toBeHidden()
  await page.getByTestId('toggle').click()
  // 같은 자리에 자람 배지 등이 먼저 떠 있으면 그게 사라진 뒤에 찍힌다
  for (let i = 0; i < 30 && (await best.isHidden()); i++) await page.clock.runFor(300)
  await expect(best).toBeVisible()
  await expect(page.locator('.stamp:not([hidden])')).toHaveCount(1)
  await expect(best).toHaveText('🥇 최고 기록 갱신! · 하루 45분')
  // 시작 버튼을 가리지 않고 화면 안에 있다(톡 찍히는 움직임이 끝난 뒤에 잰다)
  await page.waitForTimeout(700)
  const b = (await best.boundingBox())!
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(toggle.y)
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(390)
  await page.clock.runFor(300)
  await page.screenshot({ path: 'test-results/screens/best-broken.png' })

  await page.clock.runFor(4000)
  await expect(best).toBeHidden()
  await page.reload()
  await page.clock.runFor(6000)
  await expect(best).toBeHidden()
})

test('처음 해 본 활동이나 기록이 그대로면 갱신 배지를 띄우지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-24T09:00:00+09:00') })
  const records = [rec('exercise', '2026-10-22', 40), rec('study', '2026-10-24', 10, 7)]
  const seen = JSON.stringify({ session: { exercise: 40, study: 0, reading: 0, relax: 0 }, day: 40, week: 50, streak: 1 })
  await seedBests(page, records, seen)
  await page.clock.runFor(6000)
  await expect(page.getByTestId('best-stamp')).toBeHidden()
})
