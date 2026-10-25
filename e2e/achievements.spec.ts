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

test('기록이 없으면 업적 칸은 0개이고 먼 업적은 흐리다', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('ach-title')).toHaveText('🏆 업적 0 / 19')
  await expect(page.getByTestId('ach-value-exercise-1')).toHaveText('운동 0 / 1시간')
  await expect(page.getByTestId('ach-exercise-1')).not.toHaveClass(/far/)
  await expect(page.getByTestId('ach-exercise-10')).toHaveClass(/far/)
})

test('나 창 업적: 달성 수, 진행 글자, 달성 표시와 칭호', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T20:00:00+09:00') })
  await page.goto('./')
  // 운동 150분씩 3일(7시간 30분) = 운동 1시간, 도장 3개·3일 이어 하기. 독서 42분
  const records = [
    rec('exercise', '2026-10-20', 150),
    rec('exercise', '2026-10-21', 150),
    rec('exercise', '2026-10-22', 150),
    rec('reading', '2026-10-22', 42, 12),
  ]
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  await page.getByTestId('tab-me').click()

  await expect(page.getByTestId('ach-title')).toHaveText('🏆 업적 2 / 19')
  await expect(page.getByTestId('ach-exercise-1')).toHaveClass(/done/)
  await expect(page.getByTestId('ach-value-exercise-1')).toHaveText('🏅 칭호 “땀방울 새싹”')
  await expect(page.getByTestId('ach-value-exercise-10')).toHaveText('운동 7 / 10시간')
  await expect(page.getByTestId('ach-exercise-10')).not.toHaveClass(/far/)
  await expect(page.getByTestId('ach-exercise-50')).toHaveClass(/far/)
  await expect(page.getByTestId('ach-value-reading-1')).toHaveText('독서 42분 / 1시간')
  await expect(page.getByTestId('ach-streak-3')).toHaveClass(/done/)
  await expect(page.getByTestId('ach-value-stamps-10')).toHaveText('도장 3 / 10개')
  await expect(page.getByTestId('ach-value-variety-4')).toHaveText('해 본 활동 2 / 4가지')

  // 칸이 폰 화면 안에 들어오고 글자가 넘치지 않는다
  const sheetBox = (await page.getByTestId('skills').locator('.sheet').boundingBox())!
  for (const id of ['exercise-10', 'variety-4', 'streak-30']) {
    const box = (await page.getByTestId(`ach-${id}`).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(sheetBox.x)
    expect(box.x + box.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + 1)
  }

  await page.getByTestId('ach-title').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: 'test-results/screens/achievements.png' })
  await page.getByTestId('ach-streak-3').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: 'test-results/screens/achievements-more.png' })
})
