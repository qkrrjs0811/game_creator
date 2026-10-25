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

/** 9월 1일부터 n일 동안 날마다 그 활동 m분 */
const longDays = (activity: string, n: number, m: number) =>
  Array.from({ length: n }, (_, i) => {
    const start = at('2026-09-01T09:00:00') + i * 86_400_000
    return { id: `${activity}-long-${i}`, activity, startedAt: start, endedAt: start + m * 60_000 }
  })
const PROPS = ['exercise', 'study', 'reading', 'relax'].flatMap((a) => [1, 5, 20].map((h) => `prop-${a}-${h}`))

test('장면에 소품 놓기: 고른 소품이 말랑이 왼쪽 땅에 놓이고 말랑이·몬스터·말풍선을 가리지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  // 네 활동 모두 20시간을 넘겨 소품 12개를 다 가진다(휴식은 하루 30분 × 41일)
  const records = [...longDays('exercise', 8, 180), ...longDays('study', 11, 120), ...longDays('reading', 11, 120), ...longDays('relax', 41, 30)]
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-prop', '')

  const nums = async (name: string) => (await scene.getAttribute(name))!.split(',').map(Number)
  const sceneBox = (await scene.boundingBox())!
  for (const id of PROPS) {
    await page.getByTestId('open-cosmetics').click()
    await page.getByTestId('cosmetic-tab-prop').click()
    await page.getByTestId(`wear-${id}`).click()
    await page.getByTestId('cosmetics-close').click()
    await expect(scene).toHaveAttribute('data-prop', id)

    // 소품 칸은 장면 안, 자란 말랑이(특징 그림 포함)·몬스터·말풍선과 겹치지 않는다
    const [px, py, pw, ph] = await nums('data-prop-box')
    const [mx, , mw] = await nums('data-mascot-tap')
    const [bx, by, bw, bh] = await nums('data-bubble-tap')
    const s = mw / 88
    expect(px).toBeGreaterThanOrEqual(0)
    expect(px + pw).toBeLessThanOrEqual(mx + mw / 2 - 49 * s)
    expect(px + pw).toBeLessThan(sceneBox.width * 0.72 - 45)
    expect(py + ph <= by || py >= by + bh || px >= bx + bw || px + pw <= bx).toBe(true)
    expect(py + ph).toBeLessThanOrEqual(sceneBox.height)
    await page.screenshot({
      path: `test-results/screens/prop-${id.slice(5)}.png`,
      clip: { x: sceneBox.x, y: sceneBox.y + py - 70, width: 200, height: 130 },
    })
  }
  await page.screenshot({ path: 'test-results/screens/home-prop.png' })

  // 치우면 장면에서도 사라진다
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('cosmetic-tab-prop').click()
  await page.getByTestId('wear-prop-relax-20').click()
  await page.getByTestId('cosmetics-close').click()
  await expect(scene).toHaveAttribute('data-prop', '')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual([])
})
