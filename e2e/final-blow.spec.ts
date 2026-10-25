import { test, expect } from '@playwright/test'

const ratios = (v: string | null) => (v ?? '').split(' ').map(Number)

test('HP 막대: 깎이면 앞 막대는 바로 줄고, 옅은 막대는 잠깐 남았다가 천천히 따라 줄어든다', async ({ page }) => {
  // 멈춘 시계로는 장면 준비도 runFor로만 나아가 오래 걸리므로 넉넉히 기다린다
  test.setTimeout(60_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date('2026-10-26T08:00:30+09:00'))
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

  const box = page.locator('[data-feet]')
  // 첫 타격이 부딪힐 때까지 조금씩 흘린다
  await expect
    .poll(
      async () => {
        await page.clock.runFor(20)
        return box.getAttribute('data-impacts')
      },
      { intervals: [0], timeout: 20_000 },
    )
    .toBe('1')
  const hp = ratios(await box.getAttribute('data-hp'))
  const side = hp[0] < 1 ? 0 : 1
  expect(hp[side]).toBeLessThan(1)
  // 앞 막대는 바로 줄었고 옅은 막대는 아직 그대로다
  expect(ratios(await box.getAttribute('data-hp-trail'))[side]).toBe(1)
  await page.clock.runFor(120)
  expect(ratios(await box.getAttribute('data-hp-trail'))[side]).toBe(1)
  await page.screenshot({ path: 'test-results/screens/hp-trail.png' })
  // 조금 뒤 옅은 막대가 따라 줄어든다
  await page.clock.runFor(400)
  const trail = ratios(await box.getAttribute('data-hp-trail'))[side]
  expect(trail).toBeLessThan(1)
  expect(trail).toBeGreaterThanOrEqual(ratios(await box.getAttribute('data-hp'))[side])
})

test('마지막 한 방: 느린 동작으로 크게 부딪히고, 진 몬스터는 납작해지며 사라지고 말랑이는 승리 포즈', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  const box = page.locator('[data-feet]')
  await expect(box).toHaveAttribute('data-final', '1', { timeout: 20_000 })
  await expect(box).toHaveAttribute('data-impact', 'stop', { timeout: 2_000 })
  await page.screenshot({ path: 'test-results/screens/final-blow.png' })
  // 결과는 마지막 한 방이 끝난 뒤에 뜬다
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await expect(box).toHaveAttribute('data-winner', 'mascot', { timeout: 3_000 })
  await expect(box).toHaveAttribute('data-fainted', 'monster', { timeout: 2_000 })
  await expect(page.getByTestId('battle-result')).toBeVisible()
  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await page.screenshot({ path: 'test-results/screens/final-victory.png' })
})
