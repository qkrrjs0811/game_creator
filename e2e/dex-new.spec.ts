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

/** 사흘 동안 하루 3시간씩 운동한 기록 */
function threeDays() {
  const day = 24 * 60 * 60 * 1000
  const base = Date.now() - 5 * day
  return [0, 1, 2].map((d) => ({
    id: `r${d}`,
    activity: 'exercise',
    startedAt: base + d * day,
    endedAt: base + d * day + 180 * 60 * 1000,
  }))
}

test('처음 보는 몬스터를 이기면 결과 카드에 도감 알림이 붙고, 도감에 들어감', async ({ page }) => {
  await useSave(page, 0)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await page.getByTestId('battle-action').click()

  const dex = page.getByTestId('battle-result-dex')
  await expect(dex).toBeVisible()
  await expect(dex).toHaveText('📚 도감에 새 몬스터 +1')
  // 카드가 장면 밖으로 넘치거나 알림 띠와 겹치지 않는다
  const card = (await page.getByTestId('battle-result').boundingBox())!
  const bar = (await page.getByTestId('battle').boundingBox())!
  expect(card.y).toBeGreaterThanOrEqual(0)
  expect(card.y + card.height).toBeLessThanOrEqual(bar.y)
  const chip = (await dex.boundingBox())!
  expect(chip.x).toBeGreaterThanOrEqual(card.x)
  expect(chip.x + chip.width).toBeLessThanOrEqual(card.x + card.width)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-dex-new.png' })

  // 저장은 깬 스테이지 수와 꾸미기만 바뀐다(도감은 계산일 뿐)
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.stageProgress).toBe(1)
  expect(s.records).toEqual([])

  await page.getByTestId('battle-action').click()
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('cosmetics').getByTestId('collect-tab-dex').click()
  await expect(page.getByTestId('dex-count')).toContainText('1')
})

test('이미 깬 스테이지나 진 판에는 도감 알림이 없음', async ({ page }) => {
  await useSave(page, 3)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-note')).toContainText('이미 깬 스테이지')
  await expect(page.getByTestId('battle-result-dex')).toBeHidden()
  await page.getByTestId('battle-action').click()

  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-4').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요')
  await expect(page.getByTestId('battle-result-dex')).toBeHidden()
})

test('자동 진행으로 새 몬스터를 여럿 이기면 결과 카드에 모은 수만큼 알림', async ({ page }) => {
  await useSave(page, 3, threeDays())
  await page.getByTestId('open-stages').click()
  await page.getByTestId('auto-run').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-title')).toHaveText('🏁 자동 진행 끝!')
  const dex = page.getByTestId('battle-result-dex')
  await expect(dex).toBeVisible()
  await expect(dex).toHaveText(/^📚 도감에 새 몬스터 \+\d+$/)
  const shown = Number((await dex.textContent())!.split('+')[1])
  expect(shown).toBeGreaterThan(0)
  const card = (await page.getByTestId('battle-result').boundingBox())!
  const bar = (await page.getByTestId('battle').boundingBox())!
  expect(card.y).toBeGreaterThanOrEqual(0)
  expect(card.y + card.height).toBeLessThanOrEqual(bar.y)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/autorun-dex-new.png' })
})
