import { test, expect, type Page } from '@playwright/test'

async function useSave(page: Page, stageProgress: number) {
  await page.goto('./')
  await page.evaluate(
    (p) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: p, cosmetics: [] }),
      ),
    stageProgress,
  )
  await page.reload()
}

async function loseAt(page: Page, no: number) {
  await page.getByTestId('open-stages').click()
  await page.getByTestId(`stage-go-${no}`).click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요')
}

test('지면 운동보다 짧은 약점 활동을 함께 알려 준다', async ({ page }) => {
  // 3스테이지 물방울 퐁은 날쌤(약점 집중): 운동 20분보다 독서 15분이 짧다
  await useSave(page, 2)
  await loseAt(page, 3)
  await expect(page.getByTestId('battle-result-note')).toHaveText('💪 운동 20분 더 하면 이길 만해요')
  await expect(page.getByTestId('battle-result-weak')).toBeVisible()
  await expect(page.getByTestId('battle-result-weak')).toHaveText('📚 독서 15분이면 이길 만해요')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/weak-advice-lose.png' })

  // 줄이 늘어도 카드가 HP 막대까지 내려오지 않게 "지쳐 버렸어요" 줄은 숨긴다
  await expect(page.getByTestId('battle-result-detail')).toBeHidden()
  // 카드 안에 한 줄로 들어가 잘리지 않는다
  const card = await page.getByTestId('battle-result').boundingBox()
  const weak = await page.getByTestId('battle-result-weak').boundingBox()
  expect(weak!.x).toBeGreaterThanOrEqual(card!.x)
  expect(weak!.x + weak!.width).toBeLessThanOrEqual(card!.x + card!.width)
  expect(weak!.height).toBeLessThan(24)
})

test('약점 활동이 운동보다 짧지 않으면 보이지 않는다', async ({ page }) => {
  // 4스테이지는 날쌔지만 독서로도 운동(20분)보다 빠르지 않다
  await useSave(page, 3)
  await loseAt(page, 4)
  await expect(page.getByTestId('battle-result-note')).toContainText('운동')
  await expect(page.getByTestId('battle-result-weak')).toBeHidden()
  await expect(page.getByTestId('battle-result-detail')).toBeVisible()
})
