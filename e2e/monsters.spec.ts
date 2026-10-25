import { test, expect } from '@playwright/test'

/** 깬 스테이지 수 → 홈에 나오는 몬스터. 1장 앞쪽 5종, 새 6스테이지, 장 보스, 2장 첫 몬스터 */
const HOME: [number, string][] = [
  [0, 'leaf'],
  [1, 'mushroom'],
  [2, 'drop'],
  [3, 'cloud'],
  [4, 'rock'],
  [5, 'c1-s6'],
  [9, 'king'],
  [10, 'c2-s1'],
]

test('홈 장면에는 다음에 도전할 스테이지의 몬스터가 나옴(끝없는 스테이지)', async ({ page }) => {
  await page.goto('./')
  for (const [progress, id] of HOME) {
    await page.evaluate(
      (p) =>
        localStorage.setItem(
          'growth-game:save',
          JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: p, cosmetics: [] }),
        ),
      progress,
    )
    await page.reload()
    await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', id)
    await page.waitForTimeout(300)
    await page.getByTestId('scene').screenshot({ path: `test-results/screens/monster-${progress + 1}-${id}.png` })
  }
})

test('도전하면 그 스테이지 몬스터와 싸우고, 끝나면 홈 몬스터로 돌아옴', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 2, cosmetics: [] }),
    ),
  )
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'drop')
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-2')).toContainText('버섯 뽀짝')
  await expect(page.getByTestId('stage-4')).not.toContainText('뭉게')
  await page.getByTestId('stage-go-2').click()

  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'mushroom')
  await expect(page.getByTestId('battle-status')).toContainText('vs 버섯 뽀짝')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/screens/battle-mushroom.png' })

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'drop')
})
