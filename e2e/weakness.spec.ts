import { test, expect } from '@playwright/test'

const saveWith = (stageProgress: number) =>
  JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress, cosmetics: [] })

test('모험 지도의 열린 칸에 몬스터 성격과 약점이 붙고, 잠긴 칸에는 없음', async ({ page }) => {
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', s), saveWith(2))
  await page.reload()
  await page.getByTestId('open-stages').click()
  // 1스테이지 말랑 슬라임은 무난해서 붙이지 않는다
  await expect(page.getByTestId('stage-trait-1')).toHaveCount(0)
  await expect(page.getByTestId('stage-trait-2')).toHaveText('🪨 단단함 · 약점: 🧠 지능')
  await expect(page.getByTestId('stage-trait-3')).toHaveText('💨 날쌤 · 약점: 🎯 집중')
  // 잠긴 곳은 몬스터가 비밀이라 약점도 숨긴다
  await expect(page.getByTestId('stage-trait-4')).toHaveCount(0)
  // 글이 칸 안에서 잘리지 않는다
  for (const no of [2, 3]) {
    const tag = (await page.getByTestId(`stage-trait-${no}`).boundingBox())!
    const row = (await page.getByTestId(`stage-${no}`).boundingBox())!
    const btn = (await page.getByTestId(`stage-go-${no}`).boundingBox())!
    expect(tag.x).toBeGreaterThanOrEqual(row.x)
    expect(tag.x + tag.width).toBeLessThanOrEqual(btn.x)
  }
  await page.screenshot({ path: 'test-results/screens/weakness-map.png' })
})

test('홈 몬스터 곁에 약점 이름표가 붙고, 무난한 몬스터면 숨김', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('monster-trait')).toBeHidden()
  await page.evaluate((s) => localStorage.setItem('growth-game:save', s), saveWith(2))
  await page.reload()
  const tag = page.getByTestId('monster-trait')
  await expect(tag).toHaveText('💨 날쌤 · 약점: 🎯 집중')
  await expect(tag).toBeVisible()
  // 모험 버튼 위에 있고, 장면 밖으로 나가지 않는다
  const box = (await tag.boundingBox())!
  const go = (await page.getByTestId('open-stages').boundingBox())!
  const scene = (await page.getByTestId('scene').boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(go.y)
  expect(box.x).toBeGreaterThanOrEqual(scene.x)
  expect(box.x + box.width).toBeLessThanOrEqual(scene.x + scene.width)
  await page.screenshot({ path: 'test-results/screens/weakness-home.png' })
})
