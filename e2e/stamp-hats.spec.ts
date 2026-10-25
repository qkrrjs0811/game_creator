import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 10월 1일부터 n일 동안 날마다 아침 운동 30분(도장 n개) */
const days = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const start = at(`2026-10-${String(i + 1).padStart(2, '0')}T07:00:00`)
    return { id: `exercise-${i}`, activity: 'exercise', startedAt: start, endedAt: start + 30 * 60_000 }
  })

test('도장 7개를 모으면 도장 모자를 얻고, 30·100개 모자는 잠겨서 얼마나 모을지 알려 줌', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records: days(6) })
  await page.reload()

  // 도장 6개: 모두 잠김
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetic-hat-stamp7')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-hat-stamp7')).toContainText('🔒 도장 7개')
  await expect(page.getByTestId('cosmetic-hat-stamp30')).toContainText('🔒 도장 30개')
  await expect(page.getByTestId('cosmetic-hat-stamp100')).toContainText('🔒 도장 100개')
  await expect(page.getByTestId('cosmetic-tab-hat')).toContainText('모자 0')
  await page.getByTestId('cosmetic-hat-stamp100').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screens/stamp-hats-locked.png' })
  await page.getByTestId('cosmetics-close').click()

  // 오늘 켜 둔 타이머로 30분을 채우면 7번째 도장 → 그만하기 전에도 모자를 얻는다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('goal-text')).toContainText('달성')
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetic-hat-stamp7')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-hat-stamp7')).toContainText('반짝 도장 별핀')
  await expect(page.getByTestId('cosmetic-hat-stamp30')).toHaveAttribute('data-state', 'locked')
  await page.getByTestId('wear-hat-stamp7').click()
  await expect(page.getByTestId('worn-hat')).toContainText('반짝 도장 별핀')
  await page.screenshot({ path: 'test-results/screens/stamp-hats-owned.png' })
  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-stamp7')
  await page.getByTestId('toggle').click()

  // 입은 것만 저장되고, 도장 모자는 저장에 따로 남기지 않는다(기록에서 센다)
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-stamp7')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual(['hat-stamp7'])
  expect(s.cosmetics).toEqual([])
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/home-stamp-hat-7.png' })
})

test('도장 100개면 세 도장 모자를 모두 쓸 수 있음', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-02-01T12:00:00+09:00') })
  await page.goto('./')
  const records = Array.from({ length: 100 }, (_, i) => {
    const start = at('2026-10-01T07:00:00') + i * 86_400_000
    return { id: `exercise-${i}`, activity: 'exercise', startedAt: start, endedAt: start + 30 * 60_000 }
  })
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  await page.getByTestId('open-cosmetics').click()
  // 도장 모자 3 + 날마다 운동한 날 중 운동 미션 날(25일)로 미션 모자 2
  await expect(page.getByTestId('cosmetic-tab-hat')).toContainText('모자 5')
  for (const n of [30, 100]) {
    await page.getByTestId(`wear-hat-stamp${n}`).click()
    await page.getByTestId('cosmetics-close').click()
    await expect(page.getByTestId('scene')).toHaveAttribute('data-look', `hat-stamp${n}`)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/screens/home-stamp-hat-${n}.png` })
    await page.getByTestId('open-cosmetics').click()
  }
})
