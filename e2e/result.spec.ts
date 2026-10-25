import { test, expect, type Page } from '@playwright/test'

async function useSave(page: Page, stageProgress: number, records: unknown[] = []) {
  await page.goto('./')
  await page.evaluate(
    ([p, r]) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: r, active: null, skills: [], stageProgress: p, cosmetics: [] }),
      ),
    [stageProgress, records] as const,
  )
  await page.reload()
}

test('이기면 결과 카드와 함께 다음 스테이지가 열리고 저장됨', async ({ page }) => {
  await useSave(page, 0)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await page.getByTestId('battle-action').click()

  await expect(page.getByTestId('battle-result')).toBeVisible()
  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await expect(page.getByTestId('battle-result-detail')).toContainText('이겼어요')
  await expect(page.getByTestId('battle-result-note')).toContainText('2스테이지가 열렸어요')
  await expect(page.getByTestId('battle-result-reward')).toContainText('새싹 머리핀')
  await expect(page.getByTestId('battle-result-damage')).toBeHidden()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-win.png' })

  // 바뀌는 건 깬 스테이지 수와 꾸미기뿐
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.stageProgress).toBe(1)
  expect(s.cosmetics).toEqual(['hat-sprout'])
  expect(s.records).toEqual([])
  expect(s.skills).toEqual([])
  await expect(page.getByTestId('level')).toHaveText('Lv.1')

  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'mushroom')

  // 새로고침해도 남아 있음
  await page.reload()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-2')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-3')).toHaveAttribute('data-state', 'locked')
})

test('지면 결과 카드가 다시 오라고 하고, 스테이지는 그대로', async ({ page }) => {
  await useSave(page, 2)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-3').click()
  await page.getByTestId('battle-action').click()

  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요')
  // 운동 몇 분 더 하면 이길 만한지 알려 준다(능력치가 오르는 10분 단위)
  await expect(page.getByTestId('battle-result-note')).toHaveText(/^💪 운동 (\d+시간 )?[1-5]?0분 더 하면 이길 만해요$|^💪 운동 \d+시간 더 하면 이길 만해요$/)
  await expect(page.getByTestId('battle-result-reward')).toBeHidden()
  // 지더라도 몬스터를 얼마나 깎았는지 보여 준다
  const damage = page.getByTestId('battle-result-damage')
  await expect(damage).toBeVisible()
  await expect(page.getByTestId('battle-result-damage-text')).toHaveText(/💥 물방울 퐁 체력을 \d+% 깎았어요/)
  const percent = Number(await damage.getAttribute('data-percent'))
  expect(percent).toBeGreaterThan(0)
  expect(percent).toBeLessThan(100)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-lose.png' })
  expect(await page.evaluate(() => window.__debug.getSave().stageProgress)).toBe(2)
})

test('이미 깬 스테이지를 다시 이기면 깬 수는 그대로', async ({ page }) => {
  await useSave(page, 3)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-note')).toContainText('이미 깬 스테이지')
  await expect(page.getByTestId('battle-result-reward')).toBeHidden()
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.stageProgress).toBe(3)
  expect(s.cosmetics).toEqual([])
})

test('장 보스를 이기면 새 장이 열림', async ({ page }) => {
  // 사흘 동안 하루 3시간씩 운동한 말랑이
  const day = 24 * 60 * 60 * 1000
  const base = Date.now() - 5 * day
  const records = [0, 1, 2].map((d) => ({
    id: `r${d}`,
    activity: 'exercise',
    startedAt: base + d * day,
    endedAt: base + d * day + 180 * 60 * 1000,
  }))
  await useSave(page, 9, records)
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-10')).toContainText('보스 · 왕의 둥지')
  await page.getByTestId('stage-go-10').click()
  await page.getByTestId('battle-action').click()

  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await expect(page.getByTestId('battle-result-note')).toHaveText('🎉 새 장이 열렸어요 · 2장 반짝 나라')
  // 새 장 연출: 카드 위 배지와 장면 색종이
  await expect(page.getByTestId('battle-result-chapter')).toBeVisible()
  await expect(page.getByTestId('battle-result-chapter')).toHaveText('🗺️ 2장 도착!')
  await expect(page.getByTestId('scene')).toHaveAttribute('data-chapter-celebrations', '1')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/screens/result-boss.png' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/result-chapter.png' })
  // 배지는 장면 안에 있고 제목을 덮지 않는다
  const scene = (await page.getByTestId('scene').boundingBox())!
  const badge = (await page.getByTestId('battle-result-chapter').boundingBox())!
  const title = (await page.getByTestId('battle-result-title').boundingBox())!
  expect(badge.y).toBeGreaterThanOrEqual(scene.y)
  expect(badge.x).toBeGreaterThanOrEqual(0)
  expect(badge.x + badge.width).toBeLessThanOrEqual(390)
  expect(badge.y + badge.height).toBeLessThanOrEqual(title.y + 2)
  expect(await page.evaluate(() => window.__debug.getSave().stageProgress)).toBe(10)

  // 돌아오면 홈에는 새 장 첫 몬스터, 모험 지도는 새 장
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'c2-s1')
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('2장 · 반짝 나라')
  await expect(page.getByTestId('stage-11')).toHaveAttribute('data-state', 'open')

  // 이미 깬 장 보스를 다시 이기면 새 장 연출은 없다
  await page.getByTestId('chapter-prev').click()
  await page.getByTestId('stage-go-10').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-note')).toHaveText('⭐ 이미 깬 스테이지예요')
  await expect(page.getByTestId('battle-result-chapter')).toBeHidden()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-chapter-celebrations', '1')
})

test('예전 마지막(6스테이지)을 깬 저장은 7스테이지부터 이어 감', async ({ page }) => {
  await useSave(page, 6)
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster', 'c1-s7')
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('1장 · 말랑 나라')
  await expect(page.getByTestId('stage-6')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-7')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-7').getByTestId('stage-hint')).toBeVisible()
  await expect(page.getByTestId('stage-10')).toHaveAttribute('data-state', 'locked')
})

/** 이긴 쪽이 폴짝 뛰는 동안 머리끝이 자기 HP 막대를 뚫지 않고, 막대도 위쪽 결과 카드에 닿지 않는지 본다 */
async function expectHopUnderBar(page: Page, winner: 'mascot' | 'monster') {
  const scene = page.getByTestId('scene')
  await expect(scene).toHaveAttribute('data-winner', winner)
  // 폴짝(240ms 왕복 세 번)이 다 끝날 때까지 기다린다
  await page.waitForTimeout(1800)
  const attr = async (name: string) => Number(await scene.getAttribute(name))
  // 머리끝과 막대 아래끝 사이가 한 번도 겹치지 않았다
  expect(await attr('data-hop-gap')).toBeGreaterThanOrEqual(0)
  // 그래도 눈에 띄게 뛴다
  expect((await attr('data-winner-rest')) - (await attr('data-winner-peak'))).toBeGreaterThanOrEqual(16)
  // 같이 뛰는 막대가 결과 카드(그림자 포함) 아래에 머문다
  const sceneBox = (await scene.boundingBox())!
  const card = (await page.getByTestId('battle-result').boundingBox())!
  expect(await attr('data-bar-peak-top')).toBeGreaterThanOrEqual(card.y + card.height - sceneBox.y + 4)
}

test('이긴 말랑이가 폴짝 뛰어도 머리가 HP 막대에 닿지 않음(버섯 모자를 써도)', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({
        version: 1,
        records: [],
        active: null,
        skills: [],
        stageProgress: 2,
        cosmetics: ['hat-sprout', 'hat-mushroom'],
        worn: ['hat-mushroom'],
      }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('승리')
  await expectHopUnderBar(page, 'mascot')
  await page.screenshot({ path: 'test-results/screens/result-hop.png' })
})

test('이긴 몬스터가 뛰어도 HP 막대에 닿지 않음', async ({ page }) => {
  await useSave(page, 2)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-3').click()
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요')
  await expectHopUnderBar(page, 'monster')
})
