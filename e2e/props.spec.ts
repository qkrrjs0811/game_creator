import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 10월 1일부터 n일 동안 날마다 그 활동 m분 */
const days = (activity: string, n: number, m: number) =>
  Array.from({ length: n }, (_, i) => {
    const start = at(`2026-10-${String(i + 1).padStart(2, '0')}T09:00:00`)
    return { id: `${activity}-${i}`, activity, startedAt: start, endedAt: start + m * 60_000 }
  })

test('꾸미기 창 소품 칸: 활동 시간으로 얻은 소품을 놓고 치우며, 잠긴 소품은 몇 시간 필요한지 알려 줌', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  // 공부 하루 60분 × 6일 = 6시간(연필꽂이·공책), 독서 하루 60분 × 2일 = 2시간(책 더미)
  const records = [...days('study', 6, 60), ...days('reading', 2, 60)]
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()

  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetic-tab-prop')).toContainText('소품 3')
  await expect(page.getByTestId('worn-prop')).toContainText('안 놓음')
  await page.getByTestId('cosmetic-tab-prop').click()
  await expect(page.getByTestId('cosmetic-tab-prop')).toHaveAttribute('aria-selected', 'true')
  // 소품 칸엔 소품만
  await expect(page.locator('[data-testid=cosmetic-grid] .cosmetic')).toHaveCount(12)
  await expect(page.getByTestId('cosmetic-prop-study-1')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-prop-study-5')).toContainText('공책')
  await expect(page.getByTestId('cosmetic-prop-reading-5')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-prop-reading-5')).toContainText('🔒 독서 5시간')
  await expect(page.getByTestId('cosmetic-prop-exercise-1')).toContainText('🔒 운동 1시간')
  await expect(page.getByTestId('cosmetic-prop-relax-20')).toContainText('🔒 휴식 20시간')

  // 놓기 → 하나만 놓인다
  await page.getByTestId('wear-prop-study-1').click()
  await expect(page.getByTestId('cosmetic-prop-study-1')).toHaveAttribute('data-state', 'worn')
  await expect(page.getByTestId('wear-prop-study-1')).toHaveText('치우기')
  await expect(page.getByTestId('cosmetic-prop-study-1')).toContainText('소품 · 놓는 중')
  await expect(page.getByTestId('worn-prop')).toContainText('연필꽂이')
  await page.getByTestId('wear-prop-reading-1').click()
  await expect(page.getByTestId('cosmetic-prop-study-1')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('wear-prop-study-1')).toHaveText('놓기')
  await expect(page.getByTestId('worn-prop')).toContainText('책 더미')
  await page.screenshot({ path: 'test-results/screens/cosmetics-props.png' })

  // 소품 버튼은 손가락으로 누르기 충분한 크기
  for (const id of ['cosmetic-tab-prop', 'worn-prop', 'wear-prop-study-1']) {
    const box = (await page.getByTestId(id).boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  // 저장엔 놓은 소품 이름만 남고 기록·능력치는 그대로
  let s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual(['prop-reading-1'])
  expect(s.records).toHaveLength(8)

  // 다시 누르면 치운다
  await page.getByTestId('wear-prop-reading-1').click()
  await expect(page.getByTestId('worn-prop')).toContainText('안 놓음')
  s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual([])
})
