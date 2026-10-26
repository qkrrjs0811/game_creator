import { test, expect } from '@playwright/test'

const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 7시부터 활동 m분 */
const rec = (activity: string, date: string, m: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('말랑이 기본 공격: 박치기·점프 찍기·회전 돌진을 돌아가며 쓰고, 세 번 연속 맞히면 콤보 글자가 뜬다', async ({ page }) => {
  // 멈춘 시계로 조금씩 흘리며 보므로 넉넉히 기다린다
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  // 운동 9시간, 스킬 없이 30스테이지까지 깼다: 여러 번 주고받는 전투가 된다
  const save = {
    version: 1,
    records: [rec('exercise', '2026-10-20', 180), rec('exercise', '2026-10-21', 180), rec('exercise', '2026-10-22', 180)],
    active: null,
    skills: [],
    stageProgress: 30,
    cosmetics: [],
    worn: [],
  }
  await page.addInitScript((s) => {
    if (!localStorage.getItem('growth-game:save')) localStorage.setItem('growth-game:save', s)
  }, JSON.stringify(save))
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.clock.pauseAt(new Date('2026-10-26T08:00:31+09:00'))
  await page.getByTestId('stage-go-31').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

  const box = page.locator('[data-feet]')
  const shot = new Set<string>()
  let comboShot = false
  // 동작마다 처음 보일 때 공중·뒤집힌 한가운데를 찍고, 콤보 글자가 처음 뜨면 찍는다
  for (let i = 0; i < 1500 && !(shot.size === 3 && comboShot); i++) {
    await page.clock.runFor(15)
    const move = (await box.getAttribute('data-player-move')) ?? ''
    if (move && !shot.has(move) && (await box.getAttribute('data-impact')) === 'windup') {
      shot.add(move)
      await page.clock.runFor(60)
      await page.screenshot({ path: `test-results/screens/attack-${move}.png` })
    }
    if (!comboShot && Number(await box.getAttribute('data-combo')) >= 3) {
      comboShot = true
      await page.clock.runFor(120)
      await page.screenshot({ path: 'test-results/screens/attack-combo.png' })
    }
  }
  const moves = ((await box.getAttribute('data-player-moves')) ?? '').split(' ')
  // 첫 세 공격은 돌아가는 순서대로다(치명타는 지능이 없어 나오지 않는다)
  expect(moves.slice(0, 3)).toEqual(['tackle', 'hop', 'spin'])
  expect([...shot].sort()).toEqual(['hop', 'spin', 'tackle'])
  expect(comboShot).toBe(true)
  // 그림일 뿐이라 전투는 그대로 끝까지 가고, 끝나면 말랑이 몸은 제자리·제모양이다
  await expect
    .poll(async () => {
      await page.clock.runFor(200)
      return page.getByTestId('battle-result').isVisible()
    }, { intervals: [0], timeout: 20_000 })
    .toBe(true)
})
