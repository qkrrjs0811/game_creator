import { test, expect } from '@playwright/test'

test('한 번의 타격: 움츠렸다 튀어 나가 부딪히면 잠깐 멈추며 번쩍이고, 밀렸다가 제자리로 온다', async ({ page }) => {
  // 멈춘 시계로는 장면 준비도 runFor로만 나아가 오래 걸리므로 넉넉히 기다린다
  test.setTimeout(60_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date('2026-10-26T08:00:30+09:00'))
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

  const box = page.locator('[data-feet]')
  const phase = () => box.getAttribute('data-impact')
  // 첫 걸음이 움츠리기 시작할 때까지 흘린 뒤, 튀어 나가기 시작할 때까지 조금씩 흘린다
  await expect
    .poll(
      async () => {
        await page.clock.runFor(30)
        return phase()
      },
      { timeout: 20_000 },
    )
    .toMatch(/windup|lunge/)
  // 쉬지 않고 묻는다(기본 묻기 간격이면 조금씩 흘리는 동안 시간이 다 간다)
  const fine = { intervals: [0], timeout: 10_000 }
  await expect
    .poll(async () => {
      await page.clock.runFor(8)
      return phase()
    }, fine)
    .toBe('lunge')
  await page.screenshot({ path: 'test-results/screens/impact-lunge.png' })
  // 부딪히는 순간
  await expect
    .poll(async () => {
      await page.clock.runFor(8)
      return phase()
    }, fine)
    .toBe('stop')
  await expect(box).toHaveAttribute('data-impacts', '1')
  await expect(box).toHaveAttribute('data-flash', '1')
  expect(Number(await box.getAttribute('data-sparks'))).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/screens/impact-0.png' })

  // 히트스톱(60~100ms) 동안은 멈춰 있다
  await page.clock.runFor(50)
  expect(await phase()).toBe('stop')
  await page.screenshot({ path: 'test-results/screens/impact-50.png' })

  // 멈춤이 풀리면 맞은 쪽이 밀리고 번쩍임이 사라진다
  await page.clock.runFor(50)
  expect(await phase()).toBe('back')
  await page.screenshot({ path: 'test-results/screens/impact-100.png' })
  await page.clock.runFor(100)
  await expect(box).toHaveAttribute('data-flash', '0')
  await page.screenshot({ path: 'test-results/screens/impact-200.png' })

  // 다음 걸음 전에 제자리로 돌아온다(걸음 사이가 짧으면 벌써 다음 걸음을 움츠리고 있다)
  await page.clock.runFor(200)
  expect(await phase()).toMatch(/rest|windup/)
  await page.screenshot({ path: 'test-results/screens/impact-400.png' })
})
