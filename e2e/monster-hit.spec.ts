import { test, expect, type Page } from '@playwright/test'

const save = (stageProgress: number) =>
  JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress, cosmetics: [] })

/** 멈춘 시계로 stage 스테이지 전투를 시작한다 */
async function startBattle(page: Page, progress: number, stage: number) {
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.addInitScript((s) => localStorage.setItem('growth-game:save', s), save(progress))
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date('2026-10-26T08:00:30+09:00'))
  await page.getByTestId(`stage-go-${stage}`).click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
}

/** 조건이 맞을 때까지 시계를 조금씩 흘린다 */
async function runUntil(page: Page, check: () => Promise<boolean>) {
  await expect
    .poll(async () => {
      await page.clock.runFor(10)
      return check()
    }, { intervals: [0], timeout: 120_000 })
    .toBe(true)
}

test('몬스터가 맞히면 그 종의 조각이 튀고, 보통 몬스터는 화면을 흔들지 않는다', async ({ page }) => {
  test.setTimeout(180_000)
  await startBattle(page, 4, 5)
  const host = page.getByTestId('scene')
  await runUntil(page, async () => !!(await host.getAttribute('data-monster-hits')))
  const bit = await host.getAttribute('data-monster-hit')
  expect(bit).toBe('pebble')
  // 조각이 가장 높이 떠오른 즈음
  await page.clock.runFor(150)
  await page.screenshot({ path: 'test-results/screens/monster-hit-pebble.png' })
  expect(await host.getAttribute('data-boss-slams')).toBe('0')
})

test('보스는 큰 공격에 충격파와 "쿵!"이 뜨고 화면이 흔들린다(그림만이라 전투는 끝까지 간다)', async ({ page }) => {
  test.setTimeout(180_000)
  await startBattle(page, 9, 10)
  const host = page.getByTestId('scene')
  await runUntil(page, async () => Number(await host.getAttribute('data-boss-slams')) >= 1)
  expect(await host.getAttribute('data-monster-hit')).toBe('gem')
  await page.clock.runFor(140)
  await page.screenshot({ path: 'test-results/screens/monster-hit-boss.png' })
  await runUntil(page, () => page.getByTestId('battle-result').isVisible())
})
