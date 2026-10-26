import { test, expect } from '@playwright/test'

test('앱을 닫아 둔 채 자정을 넘겨도 타이머가 흐르고, 오늘 분은 새 날짜로 다시 셈', async ({ context }) => {
  // 밤 11시 30분에 시작한다(시험 기계의 시간대에 맞춰 로컬 시각으로 잡는다)
  await context.clock.install({ time: new Date(2026, 9, 25, 23, 30) })
  let page = await context.newPage()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('20:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 20분')

  // 앱을 닫아 둔 사이에도 시간은 흐른다
  await page.close()
  page = await context.newPage()
  // 40분 뒤(00:30)에 시계를 멈춰 연다. 느린 검사에서도 실제 시간만큼 타이머가 더 흐르지 않는다
  await page.clock.pauseAt(new Date(2026, 9, 26, 0, 30, 3))
  await page.goto('./')

  // 00:30 — 어제 30분 + 오늘 30분이 모두 인정되고, 오늘 분은 자정부터 센다
  await expect(page.getByTestId('toggle')).toHaveText('그만하기')
  await expect(page.getByTestId('timer')).toHaveText(/^(59:5\d|1:00:0\d)$/)
  await expect(page.getByTestId('today')).toHaveText(/^오늘 (29|30)분$/)
  await page.screenshot({ path: 'test-results/screens/midnight.png' })

  await page.getByTestId('toggle').click()
  const save = await page.evaluate(() => window.__debug.getSave())
  expect(save.active).toBeNull()
  expect(save.records).toHaveLength(1)
  // 60분 = 600 EXP → Lv.4(100+150+200=450, 남은 150 / 250)
  await expect(page.getByTestId('level')).toHaveText('Lv.4')
  await expect(page.getByTestId('exp-text')).toHaveText(/^EXP 1[45]\d \/ 250$/)
})

test('어제 상한에 닿은 채 자정을 넘기면 오늘 경험치가 다시 쌓임', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 25, 20, 30) })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('03:10:00')
  // 23:40 — 오늘 상한에 닿았다
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')
  await expect(page.getByTestId('timer-label')).toContainText('오늘은 충분히 했어요')
  await page.getByTestId('cap-toast-close').click()

  await page.clock.fastForward('30:00')
  // 00:10 — 새 날이라 다시 쌓인다
  await expect(page.getByTestId('today')).toHaveText(/^오늘 (9|10)분$/)
  await expect(page.getByTestId('timer-label')).toHaveText('운동 중 · 힘·체력이 오르고 있어요')
  await expect(page.getByTestId('today')).not.toHaveClass(/full/)
  await expect(page.getByTestId('cap-toast')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/midnight-after-cap.png' })
})
