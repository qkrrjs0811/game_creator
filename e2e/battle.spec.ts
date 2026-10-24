import { test, expect } from '@playwright/test'

test('도전하면 장면에서 전투를 재생하고, 끝나면 홈으로 돌아감', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()

  await expect(page.getByTestId('stages')).toBeHidden()
  await expect(page.getByTestId('battle')).toBeVisible()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await expect(page.getByTestId('battle-title')).toContainText('1스테이지')
  await expect(page.getByTestId('open-stages')).toBeHidden()
  await page.waitForTimeout(1900)
  await page.screenshot({ path: 'test-results/screens/battle.png' })

  // 처음 시작한 말랑이도 1스테이지는 이긴다
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done', { timeout: 20_000 })
  await expect(page.getByTestId('battle')).toHaveAttribute('data-win', 'true')
  await expect(page.getByTestId('battle-status')).toContainText('이겼어요')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/battle-win.png' })

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toBeHidden()
  await expect(page.getByTestId('open-stages')).toBeVisible()
})

test('건너뛰면 바로 결과, 전투는 경험치·기록을 바꾸지 않음', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 1, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-2').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await page.getByTestId('battle-action').click()

  // 처음 시작한 말랑이에게 2스테이지는 아직 어렵다
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await expect(page.getByTestId('battle')).toHaveAttribute('data-win', 'false')
  await expect(page.getByTestId('battle-status')).toContainText('졌어요')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/battle-lose.png' })

  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.records).toEqual([])
  expect(s.skills).toEqual([])
  expect(s.stageProgress).toBe(1)
})

test('데미지 숫자는 HP 막대 위에서 떠올라 막대를 가리지 않음', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

  // 첫 공격 숫자가 뜨면 장면 칸에 숫자 아래끝과 HP 막대 위끝이 남는다
  const scene = page.locator('[data-hit-bottom]')
  await expect(scene).toHaveCount(1, { timeout: 5_000 })
  const hitBottom = Number(await scene.getAttribute('data-hit-bottom'))
  const barTop = Number(await scene.getAttribute('data-bar-top'))
  expect(hitBottom).toBeLessThanOrEqual(barTop)

  // 숫자는 뜨자마자 흐려지지 않고 0.3초 뒤에도 또렷해서 읽을 수 있다
  await expect(scene).toHaveAttribute('data-hit-alpha-300', /.+/, { timeout: 2_000 })
  expect(Number(await scene.getAttribute('data-hit-alpha-300'))).toBeGreaterThanOrEqual(0.95)
  await page.screenshot({ path: 'test-results/screens/battle-hit.png' })
})
