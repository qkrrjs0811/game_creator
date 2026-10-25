import { test, expect, type Page } from '@playwright/test'

const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 7시부터 활동 m분 */
const rec = (activity: string, date: string, m: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

// 운동 1시간·공부 2시간·독서 2시간: 지능 치명타와 집중 명중이 둘 다 있다. 2스테이지까지 깼다
const save = {
  version: 1,
  records: [rec('exercise', '2026-10-21', 60), rec('study', '2026-10-23', 120), rec('reading', '2026-10-24', 120)],
  active: null,
  skills: [],
  stageProgress: 2,
  cosmetics: [],
  worn: [],
}

/** 전투 씨앗(지금 시각)을 정해 그 스테이지에 도전하고, 약점 연출이 처음 보이는 순간을 찍는다 */
async function watchWeakHit(page: Page, stage: number, second: string, shot: string) {
  test.setTimeout(90_000)
  await page.clock.install({ time: new Date('2026-10-26T07:59:00+09:00') })
  await page.addInitScript((s) => {
    if (!localStorage.getItem('growth-game:save')) localStorage.setItem('growth-game:save', s)
  }, JSON.stringify(save))
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date(`2026-10-26T08:00:${second}+09:00`))
  await page.getByTestId(`stage-go-${stage}`).click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')
  const box = page.locator('[data-feet]')
  let kind = ''
  for (let i = 0; i < 600 && !kind; i++) {
    await page.clock.runFor(15)
    kind = (await box.getAttribute('data-weak-hit')) ?? ''
  }
  // 글자가 떠오르고 금·과녁이 보이는 한가운데를 찍는다
  await page.clock.runFor(120)
  await page.screenshot({ path: `test-results/screens/${shot}.png` })
  // 연출은 그림일 뿐이라 전투는 그대로 끝까지 간다
  await expect
    .poll(async () => {
      await page.clock.runFor(200)
      return page.getByTestId('battle-result').isVisible()
    }, { intervals: [0], timeout: 20_000 })
    .toBe(true)
  return kind
}

test('단단한 몬스터에게 지능 치명타가 방어를 뚫으면 "약점!"과 금 가는 연출', async ({ page }) => {
  expect(await watchWeakHit(page, 2, '01', 'weak-hit-pierce')).toBe('pierce')
})

test('날쌘 몬스터를 집중으로 맞히면 "명중!"과 과녁 연출', async ({ page }) => {
  expect(await watchWeakHit(page, 3, '07', 'weak-hit-aimed')).toBe('aimed')
})

test('운동만 한 말랑이는 약점 연출 없이 싸운다', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 20_000 })
  expect(await page.locator('[data-feet]').getAttribute('data-weak-hits')).toBe('')
})
