import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 7시부터 활동 m분 */
const rec = (activity: string, date: string, m: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('공부 1시간을 채우면 홈에 새 소품 배지를 한 번 띄우고, 다시 열어도 또 띄우지 않는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  // 어제 공부 50분: 연필꽂이까지 10분
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records: [rec('study', '2026-10-24', 50)] })
  await page.reload()

  // 나 창 곧 받을 보상에 다음 소품이 보인다
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('reward-name-prop')).toHaveText('연필꽂이')
  await expect(page.getByTestId('reward-need-prop')).toHaveText('공부 10분 더')
  await page.screenshot({ path: 'test-results/screens/me-rewards-prop.png' })
  await page.reload()

  await page.getByTestId('tab-study').click()
  await page.getByTestId('toggle').click()
  const badge = page.getByTestId('prop-stamp')
  await page.clock.fastForward('09:00')
  await expect(badge).toBeHidden()
  await page.clock.fastForward('01:00')
  await expect(badge).toBeVisible({ timeout: 8000 })
  await expect(badge).toHaveText('🎁 새 소품: 연필꽂이')
  await page.waitForTimeout(500)

  // 폰 화면 안에 들어오고 시작 버튼·탭을 가리지 않는다
  const box = (await badge.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  for (const id of ['toggle', 'tab-study']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(box.y + box.height <= b.y || box.y >= b.y + b.height).toBe(true)
  }
  expect(await badge.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/screens/prop-toast.png' })

  await page.clock.fastForward('00:05')
  await expect(badge).toBeHidden()
  await page.reload()
  await page.waitForTimeout(1500)
  await expect(badge).toBeHidden()
})

test('처음 여는 창은 이미 가진 소품을 알리지 않고 기억만 한다', async ({ page }) => {
  await page.addInitScript((s) => {
    if (!localStorage.getItem('growth-game:save')) localStorage.setItem('growth-game:save', s)
  }, JSON.stringify({ ...base, records: [rec('study', '2026-10-20', 120), rec('relax', '2026-10-21', 30), rec('relax', '2026-10-22', 30)] }))
  await page.goto('./')
  await expect(page.getByTestId('toggle')).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('prop-stamp')).toBeHidden()
  const seen = await page.evaluate(() => localStorage.getItem('growth-game:save:seen-props'))
  expect(JSON.parse(seen!)).toEqual(['prop-study-1', 'prop-relax-1'])
})
