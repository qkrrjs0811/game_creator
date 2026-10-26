import { test, expect } from '@playwright/test'

const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 아침 7시부터 활동 m분 */
const rec = (activity: string, date: string, m: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

const ALL = ['blur', 'bolt', 'calm', 'dash', 'fist', 'shield']

test('스킬 연출: 펀치 주먹 궤적, 날쌘 발 잔상, 지능 치명타 번개, 단단한 몸 방패, 날쌘 발·집중 회피 잔상이 전투에서 보인다', async ({ page }) => {
  // 멈춘 시계로 조금씩 흘리며 보므로 넉넉히 기다린다(전체 검사로 느려지면 90초를 넘기곤 한다)
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  // 운동 9시간·공부 4시간·독서 2시간, 펀치 2·몸 1·발 1을 배웠고 34스테이지까지 깼다
  const save = {
    version: 1,
    records: [
      rec('exercise', '2026-10-20', 180),
      rec('exercise', '2026-10-21', 180),
      rec('exercise', '2026-10-22', 180),
      rec('study', '2026-10-23', 120),
      rec('study', '2026-10-24', 120),
      rec('reading', '2026-10-25', 120),
    ],
    active: null,
    skills: ['punch', 'punch', 'tough', 'quick'],
    stageProgress: 34,
    cosmetics: [],
    worn: [],
  }
  await page.addInitScript((s) => {
    if (!localStorage.getItem('growth-game:save')) localStorage.setItem('growth-game:save', s)
  }, JSON.stringify(save))
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  // 전투 씨앗(지금 시각)을 정해 같은 전투가 나오게 한다
  await page.clock.pauseAt(new Date('2026-10-26T08:00:31+09:00'))
  await page.getByTestId('stage-go-35').click()
  await expect(page.getByTestId('battle')).toHaveAttribute('data-state', 'playing')

  const box = page.locator('[data-feet]')
  const seen = new Set<string>()
  // 처음 보이는 연출마다 잠깐 흘려 한가운데를 찍는다
  for (let i = 0; i < 1500 && seen.size < ALL.length; i++) {
    await page.clock.runFor(15)
    const fresh = ((await box.getAttribute('data-skill-fx')) ?? '').split(' ').filter((k) => k && !seen.has(k))
    if (fresh.length === 0) continue
    for (const k of fresh) seen.add(k)
    await page.clock.runFor(45)
    for (const k of fresh) await page.screenshot({ path: `test-results/screens/skill-${k}.png` })
  }
  expect([...seen].sort()).toEqual(ALL)
  // 연출은 그림일 뿐이라 전투는 그대로 끝까지 간다
  await expect
    .poll(async () => {
      await page.clock.runFor(200)
      return page.getByTestId('battle-result').isVisible()
    }, { intervals: [0], timeout: 20_000 })
    .toBe(true)
})

test('스킬이 없으면 스킬 연출 없이 싸운다(치명타 번개는 지능이 있을 때만)', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 20_000 })
  expect(await page.locator('[data-feet]').getAttribute('data-skill-fx')).toBe('')
})
