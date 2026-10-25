import { test, expect, type Locator, type Page } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)

async function box(l: Locator) {
  return (await l.boundingBox())!
}

/** 다짐 줄이 시작 버튼 오른쪽에 겹치지 않게 카드 안에 들어가고, 누르기 충분하며 글자가 잘리지 않는다 */
async function expectFits(page: Page) {
  const l = await box(page.getByTestId('pledge'))
  const toggle = await box(page.getByTestId('toggle'))
  expect(l.height).toBeGreaterThanOrEqual(44)
  expect(l.width).toBeGreaterThanOrEqual(44)
  expect(toggle.x + toggle.width).toBeLessThanOrEqual(l.x)
  expect(l.x + l.width).toBeLessThanOrEqual(390 - 14)
  expect(Math.abs(l.y + l.height / 2 - (toggle.y + toggle.height / 2))).toBeLessThan(2)
  const label = page.getByTestId('pledge-text')
  expect((await box(label)).width).toBeLessThanOrEqual(l.width - 8)
  const tabs = await box(page.locator('.tabs'))
  expect(l.y + l.height).toBeLessThanOrEqual(tabs.y)
}

const fill = (page: Page) => page.getByTestId('pledge').evaluate((e) => parseFloat((e as HTMLElement).style.getPropertyValue('--pledge')))

test('홈 다짐 줄을 누르면 활동·시간을 골라 다짐하고, 타이머로 채우면 지켰어요로 바뀌어 더는 못 바꾼다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.goto('./')
  const line = page.getByTestId('pledge')
  await expect(page.getByTestId('pledge-text')).toHaveText('✍️ 오늘의 다짐 정하기')
  await expectFits(page)
  await page.screenshot({ path: 'test-results/screens/pledge-empty.png' })

  // 고르기 창: 지금 고른 탭(운동)과 가장 짧은 10분이 먼저 골라져 있다
  await line.click()
  const sheet = page.getByTestId('pledge-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.getByTestId('pledge-activity-exercise')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('pledge-minutes-10')).toHaveAttribute('aria-pressed', 'true')
  // 휴식은 하루 상한이 30분이라 60분은 고를 수 없다
  await page.getByTestId('pledge-activity-relax').click()
  await expect(page.getByTestId('pledge-minutes-60')).toBeDisabled()
  await page.getByTestId('pledge-activity-study').click()
  await page.getByTestId('pledge-minutes-30').click()
  await expect(page.getByTestId('pledge-minutes-30')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('pledge-hint')).toHaveText('오늘은 공부 30분!')
  for (const b of await sheet.locator('button').all()) {
    const r = await box(b)
    expect(r.height).toBeGreaterThanOrEqual(44)
    expect(r.width).toBeGreaterThanOrEqual(44)
    expect(r.x + r.width).toBeLessThanOrEqual(390)
    expect(r.y + r.height).toBeLessThanOrEqual(844)
  }
  await page.screenshot({ path: 'test-results/screens/pledge-pick.png' })
  await page.getByTestId('pledge-save').click()
  await expect(sheet).toBeHidden()
  await expect(page.getByTestId('pledge-text')).toHaveText('✍️ 공부 30분 · 0 / 30')
  await expectFits(page)

  // 다짐은 채우기 전까지 바꿀 수 있고, 다시 열면 지금 다짐이 골라져 있다
  await line.click()
  await expect(page.getByTestId('pledge-activity-study')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('pledge-minutes-30')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('pledge-close').click()
  await expect(sheet).toBeHidden()

  // 공부 타이머를 켜 둔 몫도 센다
  await page.getByTestId('tab-study').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('12:30')
  await expect(page.getByTestId('pledge-text')).toHaveText('✍️ 공부 30분 · 12 / 30')
  // 바탕이 12/30만큼 차오른다
  expect(await fill(page)).toBeCloseTo(40, 0)
  await expectFits(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/pledge-set.png' })

  // 다시 열어도 다짐은 그대로
  await page.reload()
  await expect(page.getByTestId('pledge-text')).toHaveText(/^✍️ 공부 30분 · 1[23] \/ 30$/)

  // 채우면 지켰어요로 바뀌고 더는 바꿀 수 없다
  await page.clock.fastForward('18:00')
  await expect(page.getByTestId('pledge-text')).toHaveText('✅ 지켰어요 · 공부 30분')
  await expect(line).toBeDisabled()
  await page.getByTestId('toggle').click()
  await expectFits(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/pledge-done.png' })
})

test('이미 상한까지 채운 활동은 고를 시간이 없고 다짐할 수 없다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T12:00:00+09:00') })
  await page.goto('./')
  const start = at('2026-10-26T07:00:00')
  await page.evaluate(
    (s) => localStorage.setItem('growth-game:save', JSON.stringify(s)),
    { ...base, records: [{ id: 'relax-1', activity: 'relax', startedAt: start, endedAt: start + 30 * 60_000 }] },
  )
  await page.reload()
  await page.getByTestId('pledge').click()
  await page.getByTestId('pledge-activity-relax').click()
  for (const m of [10, 20, 30, 60]) await expect(page.getByTestId(`pledge-minutes-${m}`)).toBeDisabled()
  await expect(page.getByTestId('pledge-save')).toBeDisabled()
  await expect(page.getByTestId('pledge-hint')).toHaveText('오늘 휴식은 이미 다 채웠어요. 다른 활동을 골라요')
  // 다른 활동을 고르면 다시 다짐할 수 있다
  await page.getByTestId('pledge-activity-reading').click()
  await expect(page.getByTestId('pledge-save')).toBeEnabled()
  await page.getByTestId('pledge-save').click()
  await expect(page.getByTestId('pledge-text')).toHaveText('✍️ 독서 10분 · 0 / 10')
})

test('다짐을 채우는 순간 지킴 배지를 한 번 띄우고, 그 전엔 말랑이가 남은 분을 말한다', async ({ page }) => {
  // 새로고침을 두 번 해서 함께 도는 테스트가 많으면 기본 30초가 빠듯하다
  test.setTimeout(60_000)
  await page.clock.install({ time: new Date('2026-10-26T20:00:00+09:00') })
  await page.goto('./')
  // 오늘 목표·미션(운동 20분)은 이미 채웠고(도장도 찍음) 독서 5분 / 다짐 10분
  const seven = at('2026-10-26T07:00:00')
  const eight = at('2026-10-26T08:00:00')
  const save = {
    ...base,
    records: [
      { id: 'ex-1', activity: 'exercise', startedAt: seven, endedAt: seven + 30 * 60_000 },
      { id: 'rd-1', activity: 'reading', startedAt: eight, endedAt: eight + 5 * 60_000 },
    ],
  }
  await page.evaluate((s) => {
    localStorage.setItem('growth-game:save', JSON.stringify(s))
    localStorage.setItem('growth-game:save:pledge', JSON.stringify({ day: '2026-10-26', activity: 'reading', minutes: 10 }))
    localStorage.setItem('growth-game:save:stamp-day', '2026-10-26')
    localStorage.setItem('growth-game:save:mission-day', '2026-10-26')
  }, save)
  await page.reload()
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-bubble', '✍️ 다짐까지 독서 5분!')
  const badge = page.getByTestId('pledge-stamp')
  await expect(badge).toBeHidden()

  await page.getByTestId('tab-reading').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('04:30')
  await expect(badge).toBeHidden()
  await page.clock.fastForward('00:40')
  await expect(badge).toBeVisible({ timeout: 8000 })
  await expect(badge).toHaveText('✍️ 다짐 지켰어요!')
  await expect(page.getByTestId('pledge-text')).toHaveText('✅ 지켰어요 · 독서 10분')
  await page.waitForTimeout(500)

  // 폰 화면 안에 들어오고 시작 버튼·다짐 줄·탭을 가리지 않으며 글자가 잘리지 않는다
  const b = await box(badge)
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(390)
  for (const id of ['toggle', 'pledge', 'tab-reading']) {
    const r = await box(page.getByTestId(id))
    expect(b.y + b.height <= r.y || b.y >= r.y + r.height).toBe(true)
  }
  expect(await badge.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/screens/pledge-kept.png' })

  // 마치면 다짐 한마디는 더 없고, 다시 열어도 배지를 또 띄우지 않는다
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'rest')
  await expect(host).not.toHaveAttribute('data-bubble', /^✍️/)
  await page.reload()
  await expect(page.getByTestId('pledge-text')).toHaveText('✅ 지켰어요 · 독서 10분')
  await page.clock.fastForward('00:02')
  await expect(badge).toBeHidden()
})

test('아침에 다짐이 없으면 말랑이가 다짐을 정해 보자고 한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.goto('./')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-bubble', '👋 안녕! 타이머 켜 볼까?')
  await page.waitForTimeout(300)
  // 말풍선을 눌러 넘기다 보면 다짐 한마디가 나온다
  const seen: string[] = []
  for (let i = 0; i < 8; i++) {
    const text = (await host.getAttribute('data-bubble'))!
    seen.push(text)
    if (text === '✍️ 오늘의 다짐 정해 볼까?') break
    const [x, y, w, h] = (await host.getAttribute('data-bubble-tap'))!.split(',').map(Number)
    const canvas = await box(host.locator('canvas'))
    await page.mouse.click(canvas.x + x + w / 2, canvas.y + y + h / 2)
    await expect(host).toHaveAttribute('data-chat-hops', String(i + 1))
  }
  expect(seen).toContain('✍️ 오늘의 다짐 정해 볼까?')
})
