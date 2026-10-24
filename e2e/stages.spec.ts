import { test, expect } from '@playwright/test'

test('처음에는 1스테이지만 열려 있고 나머지는 잠김', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stages')).toBeVisible()
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-2')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('stage-6')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('stage-6')).toContainText('보스')
  await expect(page.getByTestId('stage-go-2')).toHaveCount(0)

  await page.getByTestId('stages-close').click()
  await expect(page.getByTestId('stages')).toBeHidden()
})

test('깬 스테이지 수(stageProgress)에 따라 깸·도전·잠김을 보여 줌', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 2, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-2')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-3')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-4')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('stage-go-1')).toHaveText('다시')
  await expect(page.getByTestId('stage-go-3')).toHaveText('도전')
  await page.screenshot({ path: 'test-results/screens/stages.png' })

  await page.getByTestId('stages-close').click()
  await page.screenshot({ path: 'test-results/screens/home-adventure.png' })
})
