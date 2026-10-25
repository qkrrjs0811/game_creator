import { test, expect } from '@playwright/test'

test('쉬는 중 말풍선이 기록을 읽고 한마디를 고르고, 켜 둔 동안은 같이 운동한다고 함', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.getByTestId('scene')
  // 처음엔 인사
  await expect(host).toHaveAttribute('data-bubble', '👋 안녕! 타이머 켜 볼까?')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/chatter-welcome.png' })

  // 켜 둔 동안은 그대로 같이 운동 중
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-bubble', '🔥 말랑이도 같이 운동 중!')
  await page.clock.fastForward('05:00')

  // 마치면 오늘 목표까지 남은 분을 알려 준다
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'rest')
  await expect(host).toHaveAttribute('data-bubble', /^🎯 오늘 목표까지 2[45]분!$/)
  await page.getByTestId('session-summary-close').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/chatter-goal.png' })

  // 오늘 목표를 다 채우면 고마워한다(미션이 남았으면 미션이 먼저)
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(host).not.toHaveAttribute('data-bubble', /^🎯/)
  await expect(host).toHaveAttribute('data-bubble', /^(📜|🌟)/)
})

test('오랜만에 다시 열면 말랑이가 보고 싶었다고 함', async ({ context }) => {
  test.slow()
  await context.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  let page = await context.newPage()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('03:00')
  await page.getByTestId('toggle').click()

  // 이틀 뒤 다시 연다
  await page.close()
  page = await context.newPage()
  await page.clock.fastForward('48:00:00')
  await page.goto('./')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-bubble', '🥺 보고 싶었어! 5분만 같이?')
  // 말풍선이 장면 안에 다 들어온다
  const box = (await host.boundingBox())!
  expect(box.width).toBeGreaterThan(300)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/chatter-missed.png' })
})
