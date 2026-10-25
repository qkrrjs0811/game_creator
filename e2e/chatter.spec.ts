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

test('말풍선이나 말랑이를 누르면 다음 한마디로 넘어가며 통 튀고, 마지막 뒤엔 처음으로 돌아감', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-bubble', '👋 안녕! 타이머 켜 볼까?')
  await page.waitForTimeout(300)
  const tapAt = async (attr: string) => {
    const [x, y, w, h] = (await host.getAttribute(attr))!.split(',').map(Number)
    // 손가락으로 누르기 충분한 크기
    expect(w).toBeGreaterThanOrEqual(44)
    expect(h).toBeGreaterThanOrEqual(44)
    const canvas = (await host.locator('canvas').boundingBox())!
    await page.mouse.click(canvas.x + x + w / 2, canvas.y + y + h / 2)
  }

  const seen: string[] = []
  for (let i = 0; i < 8; i++) {
    const text = (await host.getAttribute('data-bubble'))!
    if (seen.includes(text)) break
    seen.push(text)
    await tapAt('data-bubble-tap')
    await expect(host).toHaveAttribute('data-chat-hops', String(i + 1))
    if (i === 1) await page.screenshot({ path: 'test-results/screens/chatter-next.png' })
  }
  // 첫인사 → 오늘 목표 → 미션 → … → 기본 한마디까지 돌고 처음으로 돌아왔다
  expect(seen[0]).toBe('👋 안녕! 타이머 켜 볼까?')
  expect(seen[1]).toMatch(/^🎯 오늘 목표까지/)
  expect(seen.at(-1)).toBe('💪 오늘도 같이 크는 중!')
  expect(seen.length).toBeGreaterThanOrEqual(3)
  await expect(host).toHaveAttribute('data-bubble', seen[0])

  // 말랑이를 눌러도 넘어간다
  await tapAt('data-mascot-tap')
  await expect(host).toHaveAttribute('data-bubble', seen[1])

  // 매초 다시 그려도 넘긴 자리를 지킨다
  await page.clock.runFor(3000)
  await expect(host).toHaveAttribute('data-bubble', seen[1])

  // 켜 둔 동안은 눌러도 같이 운동 중 그대로
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-bubble', '🔥 말랑이도 같이 운동 중!')
  const hops = await host.getAttribute('data-chat-hops')
  await tapAt('data-bubble-tap')
  await expect(host).toHaveAttribute('data-bubble', '🔥 말랑이도 같이 운동 중!')
  await expect(host).toHaveAttribute('data-chat-hops', hops!)

  // 마치면 기록이 바뀌어 첫 후보부터 다시
  await page.clock.fastForward('05:00')
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-bubble', /^🎯 오늘 목표까지 2[45]분!$/)
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
