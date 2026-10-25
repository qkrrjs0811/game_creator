import { test, expect } from '@playwright/test'

const save = (stageProgress: number) =>
  JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress, cosmetics: [] })

test('보스 전투: 어두워짐 → 쿵 내려옴 → 이름표 → 밝아진 뒤에 첫 걸음', async ({ page }) => {
  test.setTimeout(90_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.addInitScript((s) => localStorage.setItem('growth-game:save', s), save(9))
  await page.goto('./')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-monster', 'king')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date('2026-10-26T08:00:30+09:00'))
  await page.getByTestId('stage-go-10').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await expect(host).toHaveAttribute('data-boss-intros', '1')

  const until = async (phase: string) =>
    expect
      .poll(async () => {
        await page.clock.runFor(10)
        return host.getAttribute('data-boss-intro')
      }, { intervals: [0], timeout: 20_000 })
      .toBe(phase)

  // 어두워지는 동안 보스는 아직 보이지 않고 첫 걸음도 오지 않았다
  await page.clock.runFor(200)
  expect(await host.getAttribute('data-boss-intro')).toBe('dim')
  expect(await host.getAttribute('data-impact')).toBeNull()
  await page.screenshot({ path: 'test-results/screens/boss-entrance-dim.png' })

  await until('drop')
  await page.clock.runFor(250)
  await page.screenshot({ path: 'test-results/screens/boss-entrance-drop.png' })

  await until('tag')
  await expect(host).toHaveAttribute('data-boss-tag', '보스 등장! 왕 말랑')
  // 내려온 보스 발이 땅에 닿아 있다
  await page.clock.runFor(400)
  const feet = Number(await host.getAttribute('data-feet'))
  expect(Math.abs(Number(await host.getAttribute('data-monster-bottom')) - (feet - 6))).toBeLessThanOrEqual(2)
  expect(await host.getAttribute('data-impact')).toBeNull()
  await page.screenshot({ path: 'test-results/screens/boss-entrance-tag.png' })

  await until('fade')
  // 밝아진 뒤 연출이 치워지고 전투가 시작된다
  await until('')
  await expect
    .poll(async () => {
      await page.clock.runFor(20)
      return host.getAttribute('data-impact')
    }, { intervals: [0], timeout: 20_000 })
    .not.toBeNull()
  await page.screenshot({ path: 'test-results/screens/boss-entrance-fight.png' })
})

test('보통 몬스터 전투에는 등장 연출이 없다', async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem('growth-game:save', s), save(0))
  await page.goto('./')
  const host = page.getByTestId('scene')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await page.waitForTimeout(300)
  expect(await host.getAttribute('data-boss-intros')).toBeNull()
})

test('등장 중에 건너뛰면 연출을 치우고 바로 결과로 간다', async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem('growth-game:save', s), save(9))
  await page.goto('./')
  const host = page.getByTestId('scene')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-10').click()
  await expect(host).toHaveAttribute('data-boss-intro', /dim|drop|tag/)
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await expect(host).toHaveAttribute('data-boss-intro', '')
})
