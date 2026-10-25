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
