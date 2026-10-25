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

test('이길 만한 스테이지가 있으면 자동 진행으로 줄줄이 깨고 결과 카드를 띄움', async ({ page }) => {
  const records = threeDays()
  await useSave(page, 3, records)
  await page.getByTestId('open-stages').click()
  const auto = page.getByTestId('auto-run')
  await expect(auto).toBeVisible()
  await expect(auto).toHaveText(/^⏩ 자동 진행 · 이길 만한 \d+개( 이상)?$/)
  // 손가락으로 누르기 충분하고, 버튼이 들어서도 닫기 버튼은 화면 안에 있다
  const box = (await auto.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  const close = (await page.getByTestId('stages-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/screens/stages-autorun.png' })

  await auto.click()
  await expect(page.getByTestId('stages')).toBeHidden()
  await expect(page.getByTestId('battle-result')).toBeVisible()
  await expect(page.getByTestId('battle-result-title')).toHaveText('🏁 자동 진행 끝!')
  const detail = await page.getByTestId('battle-result-detail').textContent()
  const m = detail!.match(/^3 → (\d+)스테이지까지 깼어요$/)
  expect(m).not.toBeNull()
  const to = Number(m![1])
  expect(to).toBeGreaterThan(3)
  expect(to).toBeLessThanOrEqual(13)
  await expect(page.getByTestId('battle-result-note')).toHaveText(
    /^💪 다음은 운동 .+ 더 하면 이길 만해요$|^🍀 지금도 이길 만해요 · 다시 도전해 봐요$|^⏩ 10판 다 이겼어요!$/,
  )
  await expect(page.getByTestId('battle-result-damage')).toBeHidden()
  await expect(page.getByTestId('battle-action')).toHaveText('돌아가기')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/autorun-result.png' })

  // 바뀌는 건 깬 스테이지 수와 꾸미기뿐(기록·스킬·레벨 그대로)
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.stageProgress).toBe(to)
  expect(s.records).toEqual(records)
  expect(s.skills).toEqual([])

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await expect(page.getByTestId('battle')).toBeHidden()

  // 새로고침해도 깬 곳이 남아 있다
  await page.reload()
  await expect(page.getByTestId('level')).toBeVisible()
  expect(await page.evaluate(() => window.__debug.getSave().stageProgress)).toBe(to)
})

test('이길 만한 스테이지가 없으면 자동 진행 버튼을 숨김', async ({ page }) => {
  await useSave(page, 2)
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-3')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('auto-run')).toBeHidden()
})
