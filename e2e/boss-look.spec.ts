import { test, expect, type Page } from '@playwright/test'

const save = (stageProgress: number) =>
  JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress, cosmetics: [] })

/** 몬스터 둘레를 찍는다(몬스터는 장면 가로 72% 자리). 위쪽 HP 막대까지 보이게 높게 잡는다 */
async function shootMonster(page: Page, name: string) {
  const host = page.getByTestId('scene')
  const canvas = (await host.locator('canvas').boundingBox())!
  const x = canvas.x + canvas.width * 0.72
  const ground = Number(await host.getAttribute('data-feet'))
  await page.screenshot({
    path: `test-results/screens/${name}.png`,
    clip: { x: x - 110, y: canvas.y + ground - 150, width: 210, height: 160 },
  })
}

test('보스만 크게 서서 왕관·망토·후광을 두르고, 발은 땅에 붙어 있다', async ({ page }) => {
  await page.goto('./')
  const host = page.getByTestId('scene')
  for (const [progress, want] of [[9, 'crown cape halo'], [0, ''], [19, 'crown cape halo']] as const) {
    await page.evaluate((s) => localStorage.setItem('growth-game:save', s), save(progress))
    await page.reload()
    await expect(host).toHaveAttribute('data-monster-boss', want)
    const feet = Number(await host.getAttribute('data-feet'))
    await page.waitForTimeout(300)
    expect(Math.abs(Number(await host.getAttribute('data-monster-bottom')) - (feet - 6))).toBeLessThanOrEqual(2)
    if (want) await shootMonster(page, `boss-look-${progress + 1}`)
  }
  await page.screenshot({ path: 'test-results/screens/boss-look-home.png' })
})

test('보스 전투: 올린 HP 막대에 커진 보스 머리가 닿지 않는다', async ({ page }) => {
  // 전체 검사에서는 기기 부하로 시계 한 칸이 느려지므로 넉넉히 기다린다
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.addInitScript((s) => localStorage.setItem('growth-game:save', s), save(9))
  await page.goto('./')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-monster', 'king')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date('2026-10-26T08:00:30+09:00'))
  await page.getByTestId('stage-go-10').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  const phase = async () => `${await host.getAttribute('data-monster-attack')} ${await host.getAttribute('data-impact')}`
  await expect
    .poll(async () => {
      await page.clock.runFor(10)
      return phase()
    }, { intervals: [0], timeout: 120_000 })
    .toBe('slam lunge')
  // 뛰어오른 한가운데
  await page.clock.runFor(40)
  await shootMonster(page, 'boss-look-battle')
  await page.screenshot({ path: 'test-results/screens/boss-look-battle-full.png' })
})
