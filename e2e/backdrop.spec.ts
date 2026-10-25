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

const sceneBg = (page: Page) => page.getByTestId('scene').evaluate((el) => getComputedStyle(el).backgroundImage)

test('1장 배경은 원래 하늘색→연두 그대로', async ({ page }) => {
  await page.goto('./')
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-chapter', '1')
  expect(await sceneBg(page)).toContain('rgb(191, 230, 255)')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/backdrop-chapter1.png' })
})

test('장 보스를 깨 2장이 열리면 홈 배경도 2장 것으로 바뀜', async ({ page }) => {
  await seed(page, 10)
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-chapter', '2')
  const bg = await sceneBg(page)
  expect(bg).toContain('rgb(255, 216, 200)')
  expect(bg).not.toContain('rgb(191, 230, 255)')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/backdrop-chapter2.png' })
})

test('전투 중에는 도전한 스테이지의 장 배경, 끝나면 다시 지금 장', async ({ page }) => {
  await seed(page, 12)
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-chapter', '2')

  await page.getByTestId('open-stages').click()
  await page.getByTestId('chapter-prev').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await expect(scene).toHaveAttribute('data-chapter', '1')
  expect(await sceneBg(page)).toContain('rgb(191, 230, 255)')

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toBeHidden()
  await expect(scene).toHaveAttribute('data-chapter', '2')
  expect(await sceneBg(page)).toContain('rgb(255, 216, 200)')
})
