import { test, expect } from '@playwright/test'

test('도전하면 장면에서 전투를 재생하고, 끝나면 홈으로 돌아감', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()

  await expect(page.getByTestId('stages')).toBeHidden()
  await expect(page.getByTestId('battle')).toBeVisible()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await expect(page.getByTestId('battle-title')).toContainText('1스테이지')
  await expect(page.getByTestId('open-stages')).toBeHidden()
  await page.waitForTimeout(1900)
  await page.screenshot({ path: 'test-results/screens/battle.png' })

  // 처음 시작한 말랑이도 1스테이지는 이긴다
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done', { timeout: 20_000 })
  await expect(page.getByTestId('battle')).toHaveAttribute('data-win', 'true')
  await expect(page.getByTestId('battle-status')).toContainText('이겼어요')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/battle-win.png' })

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toBeHidden()
  await expect(page.getByTestId('open-stages')).toBeVisible()
})

test('건너뛰면 바로 결과, 전투는 경험치·기록을 바꾸지 않음', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 2, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-3').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await page.getByTestId('battle-action').click()

  // 처음 시작한 말랑이에게 3스테이지는 아직 어렵다
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await expect(page.getByTestId('battle')).toHaveAttribute('data-win', 'false')
  await expect(page.getByTestId('battle-status')).toContainText('졌어요')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/battle-lose.png' })

  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.records).toEqual([])
  expect(s.skills).toEqual([])
  expect(s.stageProgress).toBe(2)
})

test('데미지 숫자는 HP 막대 위에서 떠올라 막대를 가리지 않음', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

  // 첫 공격 숫자가 뜨면 장면 칸에 숫자 아래끝과 HP 막대 위끝이 남는다
  const scene = page.locator('[data-hit-bottom]')
  await expect(scene).toHaveCount(1, { timeout: 5_000 })
  const hitBottom = Number(await scene.getAttribute('data-hit-bottom'))
  const barTop = Number(await scene.getAttribute('data-bar-top'))
  expect(hitBottom).toBeLessThanOrEqual(barTop)

  // 숫자는 뜨자마자 흐려지지 않고 0.3초 뒤에도 또렷해서 읽을 수 있다
  await expect(scene).toHaveAttribute('data-hit-alpha-300', /.+/, { timeout: 2_000 })
  // 느린 실행에서 프레임이 밀려 흐려지기 시작한 0.46초 뒤에 쟀다면 투명도는 따지지 않는다
  const age = Number(await scene.getAttribute('data-hit-age-300'))
  expect(age).toBeGreaterThanOrEqual(300)
  if (age < 460) expect(Number(await scene.getAttribute('data-hit-alpha-300'))).toBeGreaterThanOrEqual(0.95)
  await page.screenshot({ path: 'test-results/screens/battle-hit.png' })
})

test('전투 중에는 운동 마침 요약·상한 안내가 전투 띠와 장면을 가리지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  // 운동을 그만하자마자 모험에 나서면 마침 요약은 닫힌다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary')).toBeVisible()
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toBeVisible()
  await expect(page.getByTestId('session-summary')).toBeHidden()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toBeHidden()
  // 돌아온 뒤에도 지난 요약이 다시 나타나지 않는다
  await expect(page.getByTestId('session-summary')).toBeHidden()

  // 운동을 켜 둔 채 전투하다 상한에 닿아도 안내가 전투 띠의 버튼을 덮지 않는다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('02:49:50')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toBeVisible()
  await page.clock.fastForward('00:20')
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/battle-cap.png' })
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toBeHidden()
})
