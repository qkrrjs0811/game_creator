import { test, expect, type Page } from '@playwright/test'

const save = (stageProgress: number) =>
  JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress, cosmetics: [] })

/** 몬스터 둘레를 찍는다. 앞으로 튀어 나간 자리까지 보이게 왼쪽을 넓게 잡는다 */
async function shootMonster(page: Page, name: string, left = 70) {
  const host = page.getByTestId('scene')
  const canvas = (await host.locator('canvas').boundingBox())!
  const x = canvas.x + canvas.width * 0.72
  const ground = Number(await host.getAttribute('data-feet'))
  await page.screenshot({
    path: `test-results/screens/${name}.png`,
    clip: { x: x - left, y: canvas.y + ground - 130, width: left + 70, height: 140 },
  })
}

const SPECIES = [
  [0, 'leaf', 'squish', 'headbutt'],
  [1, 'mushroom', 'sway', 'hop'],
  [2, 'drop', 'bounce', 'dash'],
  [3, 'cloud', 'float', 'swoop'],
  [4, 'rock', 'shiver', 'roll'],
  [9, 'king', 'puff', 'slam'],
] as const

test('몬스터는 종마다 다르게 가만히 움직이고 발이 땅에 붙어 있다', async ({ page }) => {
  await page.goto('./')
  for (const [progress, id, idle] of SPECIES) {
    await page.evaluate((s) => localStorage.setItem('growth-game:save', s), save(progress))
    await page.reload()
    const host = page.getByTestId('scene')
    await expect(host).toHaveAttribute('data-monster', id)
    await expect(host).toHaveAttribute('data-monster-idle', idle)
    // 한동안 지켜봐도 몬스터 아래끝이 제자리(발끝 - 6)보다 아래로 내려가지 않고 7px 넘게 뜨지 않는다
    const feet = Number(await host.getAttribute('data-feet'))
    const bottoms: number[] = []
    for (let i = 0; i < 12; i++) {
      bottoms.push(Number(await host.getAttribute('data-monster-bottom')))
      await page.waitForTimeout(80)
    }
    expect(Math.max(...bottoms)).toBeLessThanOrEqual(feet - 6 + 1)
    expect(Math.min(...bottoms)).toBeGreaterThanOrEqual(feet - 6 - 8)
  }
})

for (const [progress, id, , attack] of SPECIES) {
  test(`전투: ${id} 몬스터는 자기만의 공격 동작(${attack})으로 덤빈다`, async ({ page }) => {
    // 멈춘 시계로 조금씩 흘려 움츠림·튀어 나감·부딪힘을 정확히 찍는다
    test.setTimeout(90_000)
    await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
    await page.addInitScript((s) => localStorage.setItem('growth-game:save', s), save(progress))
    await page.goto('./')
    const host = page.getByTestId('scene')
    await expect(host).toHaveAttribute('data-monster', id)
    await page.getByTestId('open-stages').click()
    await page.clock.pauseAt(new Date('2026-10-26T08:00:30+09:00'))
    await page.getByTestId(`stage-go-${progress + 1}`).click()
    await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

    const phase = async () => `${await host.getAttribute('data-monster-attack')} ${await host.getAttribute('data-impact')}`
    const until = (want: string, step: number) =>
      expect
        .poll(async () => {
          await page.clock.runFor(step)
          return phase()
        }, { intervals: [0], timeout: 30_000 })
        .toBe(want)
    // 몬스터 차례의 움츠림 → 튀어 나가는 한가운데 → 부딪힌 순간
    await until(`${attack} windup`, 30)
    await until(`${attack} lunge`, 8)
    await shootMonster(page, `monster-attack-${id}-windup`, 130)
    await page.clock.runFor(35)
    await shootMonster(page, `monster-attack-${id}`, 130)
    await until(`${attack} stop`, 8)
    await shootMonster(page, `monster-attack-${id}-hit`, 130)
    // 공격이 끝나면 몬스터 몸이 제자리·제모양으로 돌아온다
    await until(`${attack} rest`, 30)
    const feet = Number(await host.getAttribute('data-feet'))
    expect(Math.abs(Number(await host.getAttribute('data-monster-bottom')) - (feet - 6))).toBeLessThanOrEqual(1)
  })
}
