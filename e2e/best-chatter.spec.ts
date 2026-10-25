import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 7시부터 운동 m분 */
const rec = (date: string, m: number) => ({
  id: `exercise-${date}`,
  activity: 'exercise',
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('하루 최고의 절반을 넘으면 말랑이 한마디가 최고까지 남은 분을 알려 준다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T20:00:00+09:00') })
  await page.goto('./')
  // 어제 40분이 하루 최고, 오늘 33분 → 8분 더 하면 넘는다
  const records = [rec('2026-10-24', 40), rec('2026-10-25', 33)]
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), { ...base, records })
  await page.reload()
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-bubble', /.+/)
  await page.waitForTimeout(300)
  const [x, y, w, h] = (await host.getAttribute('data-bubble-tap'))!.split(',').map(Number)
  const canvas = (await host.locator('canvas').boundingBox())!

  const want = '🥇 최고까지 8분 남았어!'
  for (let i = 0; i < 8; i++) {
    if ((await host.getAttribute('data-bubble')) === want) break
    await page.mouse.click(canvas.x + x + w / 2, canvas.y + y + h / 2)
    await expect(host).toHaveAttribute('data-chat-hops', String(i + 1))
  }
  await expect(host).toHaveAttribute('data-bubble', want)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/chatter-best.png' })
})
