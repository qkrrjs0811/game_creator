import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const MINUTES = { exercise: 20, study: 15, reading: 15, relax: 10 } as const
/** first 날부터 n일 동안 날마다 네 활동을 미션 분만큼(미션 별 n개) */
const missionDays = (first: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    (Object.keys(MINUTES) as (keyof typeof MINUTES)[]).map((activity, j) => {
      const start = Date.parse(`${first}T08:00:00+09:00`) + i * 86_400_000 + j * 2 * 3_600_000
      return { id: `m${i}-${j}`, activity, startedAt: start, endedAt: start + MINUTES[activity] * 60_000 }
    }),
  ).flat()

test('미션 별 5개를 모으면 미션 모자를 얻고, 20·50개 모자는 잠겨서 얼마나 모을지 알려 줌', async ({ page }) => {
  // 2026-10-25는 휴식 10분 미션. 21~24일 미션 별 4개
  await page.clock.install({ time: new Date('2026-10-25T07:00:00+09:00') })
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records: missionDays('2026-10-21', 4) })
  await page.reload()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('board-missions')).toHaveText('📜 모은 미션 별 4개')
  // 칩이 아래 닫기 띠에 가리지 않게 도장판 아래까지 올려 본다
  await page.getByTestId('board').scrollIntoViewIfNeeded()
  const chip = (await page.getByTestId('board-missions').boundingBox())!
  const close = (await page.getByTestId('skills-close').boundingBox())!
  expect(chip.y + chip.height).toBeLessThanOrEqual(close.y)
  expect(chip.x + chip.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/screens/mission-board-stars.png' })
  await page.getByTestId('skills-close').click()

  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetic-hat-mission5')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-hat-mission5')).toContainText('🔒 미션 별 5개')
  await expect(page.getByTestId('cosmetic-hat-mission20')).toContainText('🔒 미션 별 20개')
  await expect(page.getByTestId('cosmetic-hat-mission50')).toContainText('🔒 미션 별 50개')
  await page.getByTestId('cosmetic-hat-mission50').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screens/mission-hats-locked.png' })
  await page.getByTestId('cosmetics-close').click()

  // 오늘 휴식 10분을 채우면 다섯째 미션 별 → 그만하기 전에도 모자를 얻는다
  await page.getByTestId('tab-relax').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await expect(page.getByTestId('mission')).toHaveText('📜 휴식 완료!')
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetic-hat-mission5')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-hat-mission5')).toContainText('네잎클로버 핀')
  await expect(page.getByTestId('cosmetic-hat-mission20')).toHaveAttribute('data-state', 'locked')
  await page.getByTestId('wear-hat-mission5').click()
  await expect(page.getByTestId('worn-hat')).toContainText('네잎클로버 핀')
  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-mission5')
  await page.getByTestId('toggle').click()

  // 입은 것만 저장되고 미션 모자는 기록에서 센다
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-mission5')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual(['hat-mission5'])
  expect(s.cosmetics).toEqual([])
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('board-missions')).toHaveText('📜 모은 미션 별 5개')
  await page.getByTestId('skills-close').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/home-mission-hat-5.png' })
})

test('미션 별 50개면 세 미션 모자를 모두 쓸 수 있음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-31T12:00:00+09:00') })
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records: missionDays('2026-10-01', 50) })
  await page.reload()
  await page.getByTestId('open-cosmetics').click()
  for (const n of [5, 20, 50]) await expect(page.getByTestId(`cosmetic-hat-mission${n}`)).toHaveAttribute('data-state', 'owned')
  for (const n of [20, 50]) {
    await page.getByTestId(`wear-hat-mission${n}`).click()
    await page.getByTestId('cosmetics-close').click()
    await expect(page.getByTestId('scene')).toHaveAttribute('data-look', `hat-mission${n}`)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/screens/home-mission-hat-${n}.png` })
    await page.getByTestId('open-cosmetics').click()
  }
})
