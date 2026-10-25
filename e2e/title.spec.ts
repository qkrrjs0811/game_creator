import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 1, cosmetics: [], worn: ['hat-sprout'] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 hour 시부터 활동 m분 */
const rec = (activity: string, date: string, m: number, hour = 7) => ({
  id: `${activity}-${date}-${hour}`,
  activity,
  startedAt: at(`${date}T${String(hour).padStart(2, '0')}:00:00`),
  endedAt: at(`${date}T${String(hour).padStart(2, '0')}:00:00`) + m * 60_000,
})
const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('growth-game:save')!) as { worn: string[] })

test('기록이 없으면 칭호 달기 버튼도 이름 옆 칭호도 없다', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('char-title')).toBeHidden()
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('ach-hint')).toBeHidden()
  await expect(page.getByTestId('wear-title-exercise-1')).toHaveCount(0)
})

test('얻은 칭호를 골라 이름 옆에 달고, 바꾸고, 뗀다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T20:00:00+09:00') })
  await page.goto('./')
  // 운동 150분 3일 = 땀방울 새싹, 사흘 친구. 독서 60분 = 책장 새싹
  const records = [
    rec('exercise', '2026-10-20', 150),
    rec('exercise', '2026-10-21', 150),
    rec('exercise', '2026-10-22', 150),
    rec('reading', '2026-10-22', 60, 12),
  ]
  // 처음 열 때 업적 알림이 뜨지 않게 이미 알린 것으로 둔다
  await page.evaluate((s) => {
    localStorage.setItem('growth-game:save', JSON.stringify(s))
    localStorage.setItem('growth-game:save:seen-achievements', JSON.stringify(['exercise-1', 'reading-1', 'streak-3']))
  }, { ...base, records })
  await page.reload()
  const level = await page.getByTestId('level').textContent()
  await page.getByTestId('tab-me').click()

  await expect(page.getByTestId('ach-hint')).toBeVisible()
  await expect(page.getByTestId('wear-title-exercise-1')).toHaveText('달기')
  await expect(page.getByTestId('wear-title-exercise-10')).toHaveCount(0)

  await page.getByTestId('wear-title-exercise-1').click()
  await expect(page.getByTestId('wear-title-exercise-1')).toHaveText('✓ 달았어요')
  await expect(page.getByTestId('wear-title-exercise-1')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ach-exercise-1')).toHaveClass(/worn/)
  expect((await saved(page)).worn).toEqual(['hat-sprout', 'title:exercise-1'])

  // 칸이 폰 화면 안에 있고 버튼이 손가락 크기
  const btn = (await page.getByTestId('wear-title-exercise-1').boundingBox())!
  expect(btn.height).toBeGreaterThanOrEqual(44)
  expect(btn.x + btn.width).toBeLessThanOrEqual(390)
  await page.getByTestId('ach-title').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: 'test-results/screens/title-pick.png' })

  // 다른 칭호로 바꾸면 하나만 달린다
  await page.getByTestId('wear-title-reading-1').click()
  await expect(page.getByTestId('wear-title-reading-1')).toHaveText('✓ 달았어요')
  await expect(page.getByTestId('wear-title-exercise-1')).toHaveText('달기')
  expect((await saved(page)).worn).toEqual(['hat-sprout', 'title:reading-1'])

  await page.getByTestId('skills-close').click()
  await expect(page.getByTestId('char-title')).toHaveText('🏅 책장 새싹')
  // 레벨은 그대로, 이름·칭호·EXP·설정 버튼이 겹치지 않고 화면 안에 있다
  await expect(page.getByTestId('level')).toHaveText(level!)
  const name = (await page.getByTestId('char-name').boundingBox())!
  const title = (await page.getByTestId('char-title').boundingBox())!
  const exp = (await page.getByTestId('exp-text').boundingBox())!
  const gear = (await page.getByTestId('open-settings').boundingBox())!
  expect(title.x).toBeGreaterThanOrEqual(name.x + name.width)
  expect(title.x + title.width).toBeLessThanOrEqual(exp.x)
  expect(exp.x + exp.width).toBeLessThanOrEqual(gear.x)
  expect(gear.x + gear.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/screens/title-home.png' })

  // 다시 열어도 달려 있고, 단 칭호를 다시 누르면 뗀다
  await page.reload()
  await expect(page.getByTestId('char-title')).toHaveText('🏅 책장 새싹')
  await page.getByTestId('tab-me').click()
  await page.getByTestId('wear-title-reading-1').click()
  await expect(page.getByTestId('wear-title-reading-1')).toHaveText('달기')
  expect((await saved(page)).worn).toEqual(['hat-sprout'])
  await page.getByTestId('skills-close').click()
  await expect(page.getByTestId('char-title')).toBeHidden()
})

test('긴 칭호와 큰 레벨에서도 윗줄이 넘치지 않는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T20:00:00+09:00') })
  await page.goto('./')
  // 운동 10시간(꾸준한 운동러)을 넘게 쌓아 레벨도 올린다
  const records = Array.from({ length: 6 }, (_, i) => rec('exercise', `2026-10-${String(10 + i).padStart(2, '0')}`, 180))
  await page.evaluate((s) => {
    localStorage.setItem('growth-game:save', JSON.stringify(s))
    localStorage.setItem('growth-game:save:seen-achievements', JSON.stringify(['exercise-1', 'exercise-10', 'streak-3']))
  }, { ...base, records, worn: ['title:exercise-10'] })
  await page.reload()
  await expect(page.getByTestId('char-title')).toHaveText('🏅 꾸준한 운동러')
  const title = (await page.getByTestId('char-title').boundingBox())!
  const exp = (await page.getByTestId('exp-text').boundingBox())!
  const gear = (await page.getByTestId('open-settings').boundingBox())!
  expect(title.x + title.width).toBeLessThanOrEqual(exp.x)
  expect(exp.x + exp.width).toBeLessThanOrEqual(gear.x)
  expect(gear.x + gear.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/screens/title-long.png' })
})
