import { test, expect, type Page } from '@playwright/test'

const DAY = 24 * 60 * 60 * 1000
const MIN = 60 * 1000

/** 지난 며칠 동안 날마다 활동을 한 기록(하루 한 번, 점심때) */
function records(plan: { activity: string; days: number; minutes: number }[]) {
  const noon = new Date()
  noon.setHours(12, 0, 0, 0)
  return plan.flatMap(({ activity, days, minutes }) =>
    Array.from({ length: days }, (_, i) => {
      const startedAt = noon.getTime() - (i + 1) * DAY + (activity === 'exercise' ? 0 : 4 * 60 * MIN)
      return { id: `${activity}-${i}`, activity, startedAt, endedAt: startedAt + minutes * MIN }
    }),
  )
}

async function useSave(page: Page, save: object) {
  await page.goto('./')
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], ...s }),
      ),
    save,
  )
  await page.reload()
}

test('기록이 없으면 아기 말랑이에 특징 없음', async ({ page }) => {
  await useSave(page, {})
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-grow-scale', '1')
  await expect(scene).toHaveAttribute('data-traits', '')
})

test('운동·공부를 많이 한 어른 말랑이: 몸이 커져도 땅에 서고, 모자를 쓰고 이겨 뛰어도 HP 막대·결과 카드에 닿지 않음', async ({ page }) => {
  await useSave(page, {
    records: records([
      { activity: 'exercise', days: 6, minutes: 180 },
      { activity: 'study', days: 7, minutes: 120 },
    ]),
    stageProgress: 2,
    cosmetics: ['hat-sprout', 'hat-mushroom'],
    worn: ['hat-mushroom'],
  })
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-grow-scale', '1.3')
  await expect(scene).toHaveAttribute('data-traits', 'exercise study')
  await expect(scene).toHaveAttribute('data-look', 'hat-mushroom')
  // 커져도 발끝은 땅에 있다(숨쉬기로 조금 움직인다)
  const feet = Number(await scene.getAttribute('data-feet'))
  expect(Math.abs(Number(await scene.getAttribute('data-mascot-bottom')) - feet)).toBeLessThanOrEqual(3)
  await page.screenshot({ path: 'test-results/screens/look-adult.png' })

  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await expect(scene).toHaveAttribute('data-winner', 'mascot')
  await page.waitForTimeout(1800)
  const attr = async (name: string) => Number(await scene.getAttribute(name))
  expect(await attr('data-hop-gap')).toBeGreaterThanOrEqual(0)
  const sceneBox = (await scene.boundingBox())!
  const card = (await page.getByTestId('battle-result').boundingBox())!
  expect(await attr('data-bar-peak-top')).toBeGreaterThanOrEqual(card.y + card.height - sceneBox.y + 4)
  await page.screenshot({ path: 'test-results/screens/look-adult-win.png' })
})

test('독서·휴식을 많이 한 말랑이는 책갈피 잎과 졸린 눈·별', async ({ page }) => {
  await useSave(page, {
    records: records([
      { activity: 'reading', days: 6, minutes: 30 },
      { activity: 'relax', days: 6, minutes: 30 },
    ]),
    cosmetics: ['hat-sprout'],
    worn: ['hat-sprout'],
  })
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-traits', 'reading relax')
  await page.screenshot({ path: 'test-results/screens/look-reading-relax.png' })
})

/** 앱이 뜨기 전에 저장(과 본 성장 단계)을 넣는다. 처음 한 번만(새로고침하면 앱이 남긴 값을 그대로 쓴다) */
async function seed(page: Page, save: object, seenStage: string | null) {
  await page.addInitScript(
    ([s, seen]) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], ...(s as object) }),
      )
      if (seen !== null) localStorage.setItem('growth-game:save:seen-stage', seen as string)
    },
    [save, seenStage] as const,
  )
  await page.goto('./')
}

const T0 = Date.parse('2026-10-25T08:00:00+09:00')
/** 지난 며칠 동안 날마다 운동 minutes 분(하루 상한 3시간 안) */
const pastExercise = (days: number, minutes: number) =>
  Array.from({ length: days }, (_, i) => {
    const startedAt = T0 - (i + 1) * DAY
    return { id: `x${i}`, activity: 'exercise', startedAt, endedAt: startedAt + minutes * MIN }
  })

test('"나" 창에 지금 모습과 다음 단계까지 남은 레벨', async ({ page }) => {
  await page.clock.install({ time: new Date(T0) })
  // 60분 = 경험치 600 → Lv.4 아기, 어린이(Lv.5)까지 Lv 1
  await seed(page, { records: pastExercise(1, 60) }, null)
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('look-name')).toHaveText('🌱 지금 모습: 운동파 아기 말랑이')
  await expect(page.getByTestId('look-next')).toHaveText('다음 단계(어린이)까지 Lv 1')
  await page.screenshot({ path: 'test-results/screens/look-me.png' })
  const card = (await page.getByTestId('look-card').boundingBox())!
  expect(card.x).toBeGreaterThanOrEqual(0)
  expect(card.x + card.width).toBeLessThanOrEqual(390)
})

test('단계가 오르는 순간 "말랑이가 자랐어요!" 한 번, 처음 열 때나 새로고침엔 띄우지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date(T0) })
  await seed(page, { records: pastExercise(1, 60) }, null)
  const grow = page.getByTestId('grow-stamp')
  await page.clock.runFor(1500)
  await expect(grow).toBeHidden()
  // 시계가 실제로도 흐르면 느린 실행에서 3.5초짜리 배지가 재기 전에 사라진다 — 멈춰 두고 runFor로만 흘린다
  const fakeNow = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(fakeNow + 1000)

  // 10분 더 하면 경험치 700 → Lv.5 어린이
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:01')
  await expect(page.getByTestId('level')).toHaveText('Lv.5')
  await expect(page.getByTestId('scene')).toHaveAttribute('data-grow-scale', '1.1')
  await expect(grow).toBeVisible()
  await expect(grow).toHaveText('✨ 말랑이가 자랐어요! · 어린이')
  await page.clock.runFor(1000)
  // 레벨업 배지(장면 위)·시작 버튼과 겹치지 않는다
  const up = (await page.getByTestId('levelup').boundingBox())!
  const g = (await grow.boundingBox())!
  const toggle = (await page.getByTestId('toggle').boundingBox())!
  expect(up).not.toBeNull()
  expect(g.y + g.height).toBeLessThanOrEqual(toggle.y)
  expect(up.y + up.height).toBeLessThanOrEqual(g.y)
  await page.screenshot({ path: 'test-results/screens/look-grown.png' })

  await page.clock.runFor(4000)
  await expect(grow).toBeHidden()
  await page.reload()
  await page.clock.runFor(1500)
  await expect(grow).toBeHidden()
})

test('닫아 둔 사이 자랐으면 다시 열 때 한 번 띄움', async ({ page }) => {
  await page.clock.install({ time: new Date(T0) })
  // 지난번에 아기 단계를 봤고, 그 사이 Lv.10(청소년)이 됐다: 경험치 100+…+500 = 2700 → 270분
  await seed(page, { records: pastExercise(3, 90) }, '0')
  const grow = page.getByTestId('grow-stamp')
  await expect(page.getByTestId('level')).toHaveText('Lv.10')
  await expect(grow).toHaveText('✨ 말랑이가 자랐어요! · 청소년')
  await expect(grow).toBeVisible()
})
