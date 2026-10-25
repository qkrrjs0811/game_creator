import { test, expect, type Page } from '@playwright/test'

async function seed(page: Page, stageProgress: number) {
  await page.goto('./')
  await page.evaluate(
    (n) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: n, cosmetics: [] }),
      ),
    stageProgress,
  )
  await page.reload()
}

/** data-fill("hills:7 trees:2 tufts:9 puffs:2")을 수로 읽는다 */
async function fillCounts(page: Page): Promise<Record<string, number>> {
  const raw = (await page.getByTestId('scene').getAttribute('data-fill')) ?? ''
  return Object.fromEntries(raw.split(' ').map((p) => p.split(':')).map(([k, v]) => [k, Number(v)]))
}

test('홈 장면은 먼 언덕·나무·풀·작은 구름으로 채워진다', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('scene')).toHaveAttribute('data-fill', /trees:/)
  const n = await fillCounts(page)
  expect(n.hills).toBeGreaterThanOrEqual(4)
  expect(n.trees).toBeGreaterThanOrEqual(2)
  expect(n.tufts).toBeGreaterThanOrEqual(6)
  expect(n.puffs).toBeGreaterThanOrEqual(2)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/scenery-fill-home.png' })
})

test('다른 장 배경과 보스 전투에서도 채워진 장면', async ({ page }) => {
  await seed(page, 20)
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-decor', 'stars')
  await expect(scene).toHaveAttribute('data-fill', /tufts:/)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/scenery-fill-chapter3.png' })

  await seed(page, 9)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-10').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await expect(scene).toHaveAttribute('data-fill', /trees:/)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: 'test-results/screens/scenery-fill-boss.png' })
})
