import { test, expect } from '@playwright/test'

const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 7시부터 활동 m분 */
const rec = (activity: string, date: string, m: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('스킬 발동 장면: 배운 스킬이 전투에서 처음 나갈 때 화면이 어두워지고 이름 띠가 지나간다(스킬당 한 번)', async ({ page }) => {
  // 멈춘 시계로 조금씩 흘리며 보므로 넉넉히 기다린다
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  // 운동 9시간, 펀치·몸·발을 하나씩 배웠고 30스테이지까지 깼다: 여러 번 주고받는 전투가 된다
  const save = {
    version: 1,
    records: [rec('exercise', '2026-10-20', 180), rec('exercise', '2026-10-21', 180), rec('exercise', '2026-10-22', 180)],
    active: null,
    skills: ['punch', 'tough', 'quick'],
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
  // 장면마다 처음 보일 때 띠가 한가운데 멈춘 순간을 찍는다
  for (let i = 0; i < 1500 && shot.size < 3; i++) {
    await page.clock.runFor(15)
    const now = (await box.getAttribute('data-skill-cutin')) ?? ''
    if (now && !shot.has(now)) {
      shot.add(now)
      await page.clock.runFor(150)
      await page.screenshot({ path: `test-results/screens/skill-cutin-${now}.png` })
    }
  }
  expect([...shot].sort()).toEqual(['punch', 'quick', 'tough'])
  // 그림일 뿐이라 전투는 그대로 끝까지 가고, 장면은 스킬마다 한 번뿐이다
  await expect
    .poll(async () => {
      await page.clock.runFor(200)
      return page.getByTestId('battle-result').isVisible()
    }, { intervals: [0], timeout: 20_000 })
    .toBe(true)
  expect(((await box.getAttribute('data-skill-cutins')) ?? '').split(' ').sort()).toEqual(['punch', 'quick', 'tough'])
  expect(await box.getAttribute('data-skill-cutin')).toBe('')
})

test('스킬을 배우지 않았으면 발동 장면이 없다', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 20_000 })
  expect(await page.locator('[data-feet]').getAttribute('data-skill-cutins')).toBe('')
})
