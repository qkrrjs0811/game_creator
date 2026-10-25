import { test, expect, type Page } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 운동 30분 */
const day = (date: string) => ({
  id: `exercise-${date}`,
  activity: 'exercise',
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:30:00`),
})
const octDays = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => day(`2026-10-${String(from + i).padStart(2, '0')}`))

async function seed(page: Page, records: object[], seenRests: string | null) {
  await page.goto('./')
  await page.evaluate(
    ([s, seen]) => {
      localStorage.setItem('growth-game:save', JSON.stringify(s))
      // 빈 저장으로 처음 연 창이 남긴 값은 지운다
      if (seen === null) localStorage.removeItem('growth-game:save:seen-rests')
      else localStorage.setItem('growth-game:save:seen-rests', seen)
    },
    [{ ...base, records }, seenRests] as const,
  )
  await page.reload()
}

test('어제를 쉼표가 지켜 줬으면 말랑이가 맨 먼저 알려 줌', async ({ page }) => {
  // 16~22일 도장 7개로 쉼표 하나, 23일은 못 찍었고 오늘(24일)은 아직
  await page.clock.install({ time: new Date('2026-10-24T09:00:00+09:00') })
  await seed(page, octDays(16, 22), '1')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-bubble', '🛟 어제는 쉼표가 지켜 줬어!')
  await expect(page.getByTestId('rest-stamp')).toBeHidden()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/rest-chatter.png' })
})

test('쉼표를 새로 얻는 순간 배지를 한 번, 새로고침엔 다시 안 띄움', async ({ page }) => {
  // 18~23일 도장 6개, 오늘 채우면 7개째
  await page.clock.install({ time: new Date('2026-10-24T09:00:00+09:00') })
  await seed(page, octDays(18, 23), '0')
  const rest = page.getByTestId('rest-stamp')
  await page.clock.runFor(1500)
  await expect(rest).toBeHidden()
  // 시계가 실제로도 흐르면 느린 실행에서 3.5초짜리 배지가 재기 전에 사라진다 — 멈춰 두고 runFor로만 흘린다
  const fakeNow = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(fakeNow + 1000)

  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:01')
  // 오늘 도장이 먼저 찍히고, 그게 사라진 뒤 같은 자리에 쉼표 배지
  await expect(page.getByTestId('stamp')).toBeVisible()
  await expect(rest).toBeHidden()
  await page.clock.runFor(4200)
  await expect(rest).toBeVisible()
  await expect(rest).toHaveText('🛟 쉼표를 얻었어요!')
  // 시작 버튼을 가리지 않고 화면 안에 있다
  const r = (await rest.boundingBox())!
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(r.y + r.height).toBeLessThanOrEqual(toggle.y)
  expect(r.x).toBeGreaterThanOrEqual(0)
  expect(r.x + r.width).toBeLessThanOrEqual(390)
  await page.clock.runFor(300)
  await page.screenshot({ path: 'test-results/screens/rest-earned.png' })

  await page.clock.runFor(4000)
  await expect(rest).toBeHidden()
  await page.getByTestId('toggle').click()
  await page.reload()
  await page.clock.runFor(6000)
  await expect(rest).toBeHidden()
})

test('처음 여는 창은 이미 있는 쉼표를 알리지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-24T09:00:00+09:00') })
  await seed(page, octDays(10, 23), null)
  await page.clock.runFor(6000)
  await expect(page.getByTestId('rest-stamp')).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('growth-game:save:seen-rests'))).toBe('2')
})
