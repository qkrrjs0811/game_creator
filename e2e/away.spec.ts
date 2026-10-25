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
  // 운동 40분이면 1스테이지부터 이길 만해서 자동 진행·모험 버튼을 보여 준다(글자는 두 줄까지)
  const adventure = page.getByTestId('away-adventure')
  await expect(adventure).toHaveText(/^🍀 이길\s만한 곳 \d+개/)
  expect((await adventure.boundingBox())!.height).toBeLessThan(44)
  await expect(page.getByTestId('away-auto')).toHaveText('⏩ 자동 진행')
  await expect(page.getByTestId('away-go')).toHaveText('⚔️ 모험')
  // 레벨업은 카드가 함께 알려 주니 같은 자리 배지는 띄우지 않고, 말랑이는 폴짝 뛴다
  await expect(page.getByTestId('levelup')).toBeHidden()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-celebrations', '1')

  // 카드는 장면 안에 들어가고, 말랑이(말풍선 포함)·모험·꾸미기 버튼을 가리지 않는다(톡 커지는 연출이 끝난 뒤 잰다)
  await away.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
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
  // 자동 진행·모험 버튼은 카드 안, 닫기 버튼 아래에 손가락 크기로 나란히 있다
  const auto = (await page.getByTestId('away-auto').boundingBox())!
  const go = (await page.getByTestId('away-go').boundingBox())!
  for (const b of [auto, go]) {
    expect(b.height).toBeGreaterThanOrEqual(44)
    expect(b.y).toBeGreaterThanOrEqual(close.y + close.height)
    expect(b.x).toBeGreaterThanOrEqual(box.x)
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width)
    expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height)
  }
  expect(auto.x + auto.width).toBeLessThanOrEqual(go.x)
  expect(auto.y).toBe(go.y)
  // 안내 글자와 버튼이 겹치지 않는다
  const text = (await adventure.boundingBox())!
  expect(text.x + text.width).toBeLessThanOrEqual(auto.x)
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

  // 카드의 모험 가기를 누르면 카드를 닫고 모험 지도를 연다
  await expect(page.getByTestId('away-adventure')).toHaveText(/^🍀 이길\s만한 곳 \d+개/)
  await page.getByTestId('away-go').click()
  await expect(page.getByTestId('away')).toBeHidden()
  await expect(page.getByTestId('stages')).toBeVisible()
  await page.locator('[data-testid^=stage-go-]').first().click()
  await expect(page.getByTestId('away')).toBeHidden()
})

test('이길 만한 스테이지가 없으면 다음 스테이지까지 운동 몇 분 더인지 알려 주고 모험 가기 버튼은 없음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 20, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:02')

  await setVisibility(page, 'hidden')
  await page.clock.fastForward('20:00')
  await setVisibility(page, 'visible')

  await expect(page.getByTestId('away')).toBeVisible()
  await expect(page.getByTestId('away-adventure')).toHaveText(/^💪 다음 스테이지까지 운동 \d+(시간|분).* 더$/)
  await expect(page.getByTestId('away-go')).toBeHidden()
  await expect(page.getByTestId('away-auto')).toBeHidden()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/away-not-yet.png' })
})

test('자리 비운 동안 카드에서 자동 진행을 누르면 바로 줄줄이 깸', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  // 사흘 동안 하루 3시간씩 운동했고 3스테이지까지 깼다
  await page.evaluate(() => {
    const day = 24 * 60 * 60 * 1000
    const base = Date.now() - 5 * day
    const records = [0, 1, 2].map((d) => ({
      id: `r${d}`,
      activity: 'exercise',
      startedAt: base + d * day,
      endedAt: base + d * day + 180 * 60 * 1000,
    }))
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records, active: null, skills: [], stageProgress: 3, cosmetics: [] }),
    )
  })
  await page.reload()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:02')

  await setVisibility(page, 'hidden')
  await page.clock.fastForward('30:00')
  await setVisibility(page, 'visible')

  await expect(page.getByTestId('away')).toBeVisible()
  await expect(page.getByTestId('away-adventure')).toHaveText(/^🍀 이길\s만한 곳 \d+개/)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/away-autorun.png' })

  // 누르면 카드를 닫고 모험 지도를 거치지 않고 다음 스테이지부터 이어 싸운다
  await page.getByTestId('away-auto').click()
  await expect(page.getByTestId('away')).toBeHidden()
  await expect(page.getByTestId('stages')).toBeHidden()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  await expect(page.getByTestId('battle-title')).toHaveText(/^⚔️ 자동 진행 1\/\d+ · 4스테이지$/)
  const to = await page.evaluate(() => window.__debug.getSave().stageProgress)
  expect(to).toBeGreaterThan(3)

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'done')
  await expect(page.getByTestId('battle-result-title')).toHaveText('🏁 자동 진행 끝!')
  await expect(page.getByTestId('battle-result-detail')).toHaveText(`3 → ${to}스테이지까지 깼어요`)
  // 경험치·능력치의 원천인 기록은 그대로다(켜 둔 타이머도 계속 흐른다)
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.records).toHaveLength(3)
  expect(s.active?.activity).toBe('exercise')
})
