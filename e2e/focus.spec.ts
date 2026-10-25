import { test, expect, type Page } from '@playwright/test'

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
  // 시계는 실제 시간으로도 흐르므로 초 끝자리는 조금 넘어갈 수 있다
  await expect(page.getByTestId('timer')).toHaveText(/^32:3\d$/)
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

/** 진동 부름을 세어 둔다(테스트 브라우저에는 진동이 없다) */
// Phaser가 navigator.vibrate에 다시 넣으므로 쓸 수 있게 둔다
const countVibrate = {
  content: `window.__vibrated = 0
Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: () => { window.__vibrated++; return true } })`,
}
const vibrated = (page: Page) => page.evaluate(() => (window as unknown as { __vibrated: number }).__vibrated)

test('집중 목표에 닿는 순간 배지를 한 번 찍고 진동하며, 타이머는 계속 흐른다', async ({ page }) => {
  await page.addInitScript(countVibrate)
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('focus-15').click()
  await page.getByTestId('toggle').click()
  const badge = page.getByTestId('focus-stamp')
  await page.clock.fastForward('14:00')
  await expect(page.getByTestId('focus-text')).toHaveText('🎯 15분 중 14분 · 1분 남음')
  await expect(badge).toBeHidden()

  await page.clock.fastForward('01:30')
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText('⏰ 목표 15분 채웠어요!')
  expect(await vibrated(page)).toBe(1)
  await expect(page.getByTestId('timer')).toHaveText(/^15:3\d$/)
  // 배지는 폰 화면 안에 들어가고 시작 버튼·목표 줄을 가리지 않는다(톡 찍히는 연출이 끝난 뒤 잰다)
  await page.clock.runFor(600)
  const b = (await badge.boundingBox())!
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(390)
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(toggle.y)
  const live = (await page.getByTestId('focus-live').boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(live.y)
  await page.screenshot({ path: 'test-results/screens/focus-done.png' })

  // 잠깐 뒤 사라지고, 다시 열어도 같은 타이머로는 또 찍지 않는다
  await page.clock.runFor(4000)
  await expect(badge).toBeHidden()
  await page.reload()
  await page.clock.runFor(2000)
  await expect(page.getByTestId('focus-text')).toHaveText(/^⏰ 목표 15분 채웠어요 · \d+분째$/)
  await expect(badge).toBeHidden()

  // 새 타이머는 다시 축하한다
  await page.getByTestId('toggle').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('15:00')
  // 오늘 운동이 30분을 넘어 오늘 도장이 먼저 찍히고, 그게 사라진 뒤 목표 배지가 찍힌다. 조금씩 넘기며 기다린다
  await expect
    .poll(
      async () => {
        await page.clock.runFor(300)
        return badge.isVisible()
      },
      { timeout: 20_000 },
    )
    .toBe(true)
})

test('닫아 둔 사이 집중 목표에 닿았으면 다시 열 때 오늘 도장 다음에 한 번 찍는다', async ({ context }) => {
  await context.addInitScript(countVibrate)
  await context.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  let page = await context.newPage()
  await page.goto('./')
  await page.getByTestId('focus-25').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:02')
  await page.close()

  page = await context.newPage()
  await page.clock.fastForward('40:00')
  await page.goto('./')
  const badge = page.getByTestId('focus-stamp')
  // 같은 자리의 오늘 도장이 먼저 찍히고, 그게 사라진 뒤 목표 배지가 찍힌다(겹치지 않는다)
  await expect(page.getByTestId('stamp')).toBeVisible()
  await expect(badge).toBeHidden()
  // 시계가 실제 시간으로도 흘러 검사가 느리면 3.5초 배지를 지나칠 수 있으므로 조금씩 넘기며 기다린다
  await expect
    .poll(async () => {
      await page.clock.runFor(300)
      return badge.isVisible()
    }, { timeout: 20_000 })
    .toBe(true)
  await expect(page.getByTestId('stamp')).toBeHidden()
  await expect(badge).toHaveText('⏰ 목표 25분 채웠어요!')
  expect(await vibrated(page)).toBe(1)
  await page.screenshot({ path: 'test-results/screens/focus-done-away.png' })

  // 목표는 보여 줄 값일 뿐 기록은 실제로 켜 둔 시간만
  await page.getByTestId('toggle').click()
  const records = await page.evaluate(() => window.__debug.getSave().records)
  expect(records.map((r) => Math.floor((r.endedAt - r.startedAt) / 60_000))).toEqual([40])
})
