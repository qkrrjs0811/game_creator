import { test, expect, type Page } from '@playwright/test'

async function useSave(page: Page, stageProgress: number, records: unknown[] = []) {
  await page.goto('./')
  await page.evaluate(
    ([p, r]) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: r, active: null, skills: [], stageProgress: p, cosmetics: [] }),
      ),
    [stageProgress, records] as const,
  )
  await page.reload()
}

test('이기면 결과 카드와 함께 다음 스테이지가 열리고 저장됨', async ({ page }) => {
  await useSave(page, 0)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await page.getByTestId('battle-action').click()

  await expect(page.getByTestId('battle-result')).toBeVisible()
  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await expect(page.getByTestId('battle-result-detail')).toContainText('이겼어요')
  await expect(page.getByTestId('battle-result-note')).toContainText('2스테이지가 열렸어요')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-win.png' })

  // 바뀌는 건 깬 스테이지 수뿐
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.stageProgress).toBe(1)
  expect(s.records).toEqual([])
  expect(s.skills).toEqual([])
  await expect(page.getByTestId('level')).toHaveText('Lv.1')

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'mushroom')

  // 새로고침해도 남아 있음
  await page.reload()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-2')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-3')).toHaveAttribute('data-state', 'locked')
})

test('지면 결과 카드가 다시 오라고 하고, 스테이지는 그대로', async ({ page }) => {
  await useSave(page, 1)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-2').click()
  await page.getByTestId('battle-action').click()

  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요')
  await expect(page.getByTestId('battle-result-note')).toContainText('운동으로')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-lose.png' })
  expect(await page.evaluate(() => window.__debug.getSave().stageProgress)).toBe(1)
})

test('이미 깬 스테이지를 다시 이기면 깬 수는 그대로', async ({ page }) => {
  await useSave(page, 3)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-note')).toContainText('이미 깬 스테이지')
  expect(await page.evaluate(() => window.__debug.getSave().stageProgress)).toBe(3)
})

test('보스를 이기면 모든 스테이지를 깸', async ({ page }) => {
  // 사흘 동안 하루 3시간씩 운동한 말랑이
  const day = 24 * 60 * 60 * 1000
  const base = Date.now() - 5 * day
  const records = [0, 1, 2].map((d) => ({
    id: `r${d}`,
    activity: 'exercise',
    startedAt: base + d * day,
    endedAt: base + d * day + 180 * 60 * 1000,
  }))
  await useSave(page, 5, records)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-6').click()
  await page.getByTestId('battle-action').click()

  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await expect(page.getByTestId('battle-result-note')).toContainText('모든 스테이지를 깼어요')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-boss.png' })
  expect(await page.evaluate(() => window.__debug.getSave().stageProgress)).toBe(6)
})
