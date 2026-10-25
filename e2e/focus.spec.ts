import { test, expect } from '@playwright/test'

test('켜기 전 집중 목표를 고르면 켜 둔 동안 남은 분과 막대를 보여 주고, 다음에도 그 목표를 먼저 골라 둔다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  // 처음에는 목표 없음이 골라져 있다
  await expect(page.getByTestId('focus-chips')).toBeVisible()
  await expect(page.getByTestId('focus-0')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('focus-25').click()
  await expect(page.getByTestId('focus-25')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('focus-0')).toHaveAttribute('aria-pressed', 'false')

  // 칩은 손가락으로 누르기 충분하고 카드 안에 한 줄로 들어간다
  const chips = page.locator('.focus-chip')
  for (let i = 0; i < 5; i++) {
    const b = (await chips.nth(i).boundingBox())!
    expect(b.height).toBeGreaterThanOrEqual(44)
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.x).toBeGreaterThanOrEqual(14)
    expect(b.x + b.width).toBeLessThanOrEqual(390 - 14)
  }
  const row = (await page.getByTestId('focus-chips').boundingBox())!
  expect(row.height).toBeLessThan(50)
  // 칩이 시작 버튼을 덮지 않는다
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(row.y + row.height).toBeLessThanOrEqual(toggle.y)
  await page.screenshot({ path: 'test-results/screens/focus-pick.png' })

  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('focus-chips')).toBeHidden()
  await page.clock.fastForward('12:30')
  await expect(page.getByTestId('focus-text')).toHaveText('🎯 25분 중 12분 · 13분 남음')
  const track = (await page.getByTestId('focus-track').boundingBox())!
  // 막대는 부드럽게 늘어나므로 자리를 잡을 때까지 기다린다
  await expect
    .poll(async () => (await page.getByTestId('focus-bar').boundingBox())!.width / track.width)
    .toBeGreaterThan(0.45)
  expect((await page.getByTestId('focus-bar').boundingBox())!.width / track.width).toBeLessThan(0.55)
  const live = (await page.getByTestId('focus-live').boundingBox())!
  expect(live.x + live.width).toBeLessThanOrEqual(390 - 14)
  await page.screenshot({ path: 'test-results/screens/focus-running.png' })

  // 목표를 넘겨도 타이머는 계속 흐른다
  await page.clock.fastForward('20:00')
  await expect(page.getByTestId('focus-text')).toHaveText('⏰ 목표 25분 채웠어요 · 32분째')
  await expect(page.getByTestId('timer')).toHaveText('32:30')
  await expect
    .poll(
      async () =>
        (await page.getByTestId('focus-bar').boundingBox())!.width / (await page.getByTestId('focus-track').boundingBox())!.width,
    )
    .toBeGreaterThan(0.99)
  await page.screenshot({ path: 'test-results/screens/focus-reached.png' })

  // 다시 열어도 켜 둔 타이머의 목표는 그대로
  await page.reload()
  await expect(page.getByTestId('focus-text')).toHaveText('⏰ 목표 25분 채웠어요 · 32분째')

  // 그만두면 칩이 돌아오고, 고른 25분이 먼저 골라져 있다
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('focus-chips')).toBeVisible()
  await expect(page.getByTestId('focus-25')).toHaveAttribute('aria-pressed', 'true')

  // 목표 없이 켜면 이전 타이머의 목표가 붙지 않는다
  await page.getByTestId('focus-0').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('03:00')
  await expect(page.getByTestId('focus-live')).toBeHidden()
  await expect(page.getByTestId('timer-label')).toBeVisible()
  await expect(page.getByTestId('timer-label')).toHaveText('운동 중 · 경험치가 쌓이고 있어요')

  // 목표는 보여 줄 값일 뿐 기록은 실제로 켜 둔 시간만
  await page.getByTestId('toggle').click()
  const records = await page.evaluate(() => window.__debug.getSave().records)
  expect(records.map((r) => Math.floor((r.endedAt - r.startedAt) / 60_000))).toEqual([32, 3])
})
