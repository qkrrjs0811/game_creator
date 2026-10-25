import { test, expect, type Page } from '@playwright/test'

/** 장면의 data-monster-face가 바뀔 때마다 모아 둔다 */
async function watchMonsterFaces(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('[data-testid="scene"]')!
    const w = window as unknown as { __mfaces: string[] }
    w.__mfaces = []
    new MutationObserver(() => {
      const f = host.getAttribute('data-monster-face') ?? ''
      if (w.__mfaces.at(-1) !== f) w.__mfaces.push(f)
    }).observe(host, { attributes: true, attributeFilter: ['data-monster-face'] })
  })
}
const monsterFaces = (page: Page) => page.evaluate(() => (window as unknown as { __mfaces: string[] }).__mfaces)

/** 몬스터 둘레만 크게 찍는다(몬스터는 장면 가로 72% 자리, 아래끝이 data-monster-bottom) */
async function shootMonster(page: Page, name: string) {
  const host = page.getByTestId('scene')
  const bottom = Number(await host.getAttribute('data-monster-bottom'))
  const canvas = (await host.locator('canvas').boundingBox())!
  const x = canvas.x + canvas.width * 0.72
  await page.screenshot({
    path: `test-results/screens/${name}.png`,
    clip: { x: x - 70, y: canvas.y + bottom - 96, width: 140, height: 108 },
  })
}

const save = (stageProgress: number) =>
  JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress, cosmetics: [] })

test('몬스터 종마다 다른 실루엣과 기본 표정', async ({ page }) => {
  await page.goto('./')
  for (const [progress, id] of [[0, 'leaf'], [1, 'mushroom'], [2, 'drop'], [3, 'cloud'], [4, 'rock'], [9, 'king']] as const) {
    await page.evaluate((s) => localStorage.setItem('growth-game:save', s), save(progress))
    await page.reload()
    const host = page.getByTestId('scene')
    await expect(host).toHaveAttribute('data-monster', id)
    await expect(host).toHaveAttribute('data-monster-face', 'idle')
    await page.waitForTimeout(300)
    await shootMonster(page, `monster-look-${id}`)
  }
})

test('전투: 맞으면 몬스터도 맞은 표정, 말랑이를 이기면 승리 표정', async ({ page }) => {
  await page.goto('./')
  const host = page.getByTestId('scene')
  await watchMonsterFaces(page)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect.poll(() => host.getAttribute('data-monster-face'), { intervals: [20], timeout: 30_000 }).toBe('hurt')
  await shootMonster(page, 'monster-face-hurt')
  await expect(page.getByTestId('battle-result-title')).toContainText('승리', { timeout: 30_000 })
  // 쓰러진 몬스터는 맞은 표정으로 사라진다
  await expect(host).toHaveAttribute('data-monster-face', 'hurt')

  // 기록 없이 3스테이지는 진다 → 몬스터가 승리 표정
  await page.evaluate((s) => localStorage.setItem('growth-game:save', s), save(2))
  await page.reload()
  await watchMonsterFaces(page)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-3').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요', { timeout: 30_000 })
  await expect(host).toHaveAttribute('data-monster-face', 'win')
  expect(await monsterFaces(page)).toEqual(expect.arrayContaining(['hurt', 'win']))
  await page.waitForTimeout(1200)
  await shootMonster(page, 'monster-face-win')
  await page.screenshot({ path: 'test-results/screens/monster-face-lose-scene.png' })

  // 전투가 끝나 홈으로 돌아오면 다시 기본 표정
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await expect(host).toHaveAttribute('data-monster-face', 'idle')
})
