import { test, expect, type Page } from '@playwright/test'

/** 앱을 끄지 않고 뒤로 보냈다가(hidden) 돌아온(visible) 것처럼 한다 */
async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

test('운동하러 닫아 뒀다가 다시 열면 자리 비운 동안 카드를 한 번 띄움', async ({ context }) => {
  await context.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  let page = await context.newPage()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:02')

  // 운동하러 가며 앱을 닫는다. 40분 뒤 다시 연다
  await page.close()
  page = await context.newPage()
  await page.clock.fastForward('40:00')
  await page.goto('./')

  const away = page.getByTestId('away')
  await expect(away).toBeVisible()
  await expect(page.getByTestId('away-title')).toHaveText('🌙 자리 비운 동안 · 40분')
  await expect(page.getByTestId('away-did')).toHaveText('운동 40분 했어요')
  await expect(page.getByTestId('away-gain')).toHaveText('EXP +400 · 💪 힘 +4 · ❤️ 체력 +4')
  await expect(page.getByTestId('away-chips').locator('em')).toHaveText(['⬆️ Lv.1 → Lv.3', '✨ 스킬 포인트 +2', '🌟 도장 +1'])
  // 레벨업은 카드가 함께 알려 주니 같은 자리 배지는 띄우지 않고, 말랑이는 폴짝 뛴다
  await expect(page.getByTestId('levelup')).toBeHidden()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-celebrations', '1')

  // 카드는 장면 안에 들어가고, 말랑이(말풍선 포함)·모험·꾸미기 버튼을 가리지 않는다
  const box = (await away.boundingBox())!
  const scene = (await page.getByTestId('scene').boundingBox())!
  const feet = Number(await page.locator('[data-feet]').getAttribute('data-feet'))
  expect(box.x).toBeGreaterThanOrEqual(scene.x)
  expect(box.x + box.width).toBeLessThanOrEqual(scene.x + scene.width)
  expect(box.y + box.height).toBeLessThanOrEqual(scene.y + feet - 130)
  for (const id of ['open-stages', 'open-cosmetics']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(box.y + box.height)
  }
  const close = (await page.getByTestId('away-close').boundingBox())!
  expect(close.width).toBeGreaterThanOrEqual(44)
  expect(close.height).toBeGreaterThanOrEqual(44)
  await page.clock.runFor(400)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/screens/away.png' })

  // 닫기 전까지 남아 있다가, 닫으면 사라진다
  await page.clock.runFor(10_000)
  await expect(away).toBeVisible()
  await page.getByTestId('away-close').click()
  await expect(away).toBeHidden()

  // 바로 다시 열면 띄우지 않는다(한 번만)
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await page.clock.runFor(1500)
  await expect(away).toBeHidden()

  // 저장 형식은 그대로다(기록과 켜 둔 타이머뿐)
  const save = await page.evaluate(() => window.__debug.getSave())
  expect(save.active?.activity).toBe('exercise')
  expect(save.records).toHaveLength(0)
})

test('잠깐 닫았거나 늘어난 게 없으면 띄우지 않음', async ({ context }) => {
  await context.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  let page = await context.newPage()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:02')

  // 9분만 닫았다 연다
  await page.close()
  page = await context.newPage()
  await page.clock.fastForward('09:00')
  await page.goto('./')
  await expect(page.getByTestId('timer')).toHaveText(/^09:0\d$/)
  await page.clock.runFor(1500)
  await expect(page.getByTestId('away')).toBeHidden()

  // 타이머를 끄고 한 시간 닫아 둬도 늘어난 게 없으니 띄우지 않는다
  await page.getByTestId('toggle').click()
  await page.getByTestId('session-summary-close').click()
  await page.close()
  page = await context.newPage()
  await page.clock.fastForward('01:00:00')
  await page.goto('./')
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await page.clock.runFor(1500)
  await expect(page.getByTestId('away')).toBeHidden()
})

test('앱을 뒤로 보냈다가 돌아와도 자리 비운 동안을 보여 주고, 레벨이 그대로면 칩 없음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('tab-reading').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:02')

  await setVisibility(page, 'hidden')
  await page.clock.fastForward('15:00')
  await setVisibility(page, 'visible')

  await expect(page.getByTestId('away')).toBeVisible()
  await expect(page.getByTestId('away-title')).toHaveText('🌙 자리 비운 동안 · 15분')
  await expect(page.getByTestId('away-did')).toHaveText('독서 15분 했어요')
  await expect(page.getByTestId('away-gain')).toHaveText('EXP +150 · 🎯 집중 +3')
  // 15분이면 Lv.2(EXP 100)라 레벨 칩만, 도장은 아직
  await expect(page.getByTestId('away-chips').locator('em')).toHaveText(['⬆️ Lv.1 → Lv.2', '✨ 스킬 포인트 +1'])
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/away-resume.png' })

  // 도전하면 카드를 닫는다(전투 띠·결과 카드와 겹치지 않게)
  await page.getByTestId('open-stages').click()
  await page.locator('[data-testid^=stage-go-]').first().click()
  await expect(page.getByTestId('away')).toBeHidden()
})
