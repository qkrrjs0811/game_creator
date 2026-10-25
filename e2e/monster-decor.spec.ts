import { test, expect, type Page } from '@playwright/test'

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

async function showStage(page: Page, stageProgress: number) {
  await page.evaluate((s) => localStorage.setItem('growth-game:save', s), save(stageProgress))
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-monster-decor', /.*/)
  await page.waitForTimeout(300)
}

test('장이 올라가면 같은 종도 무늬·장식이 하나씩 늘어난다', async ({ page }) => {
  await page.goto('./')
  const host = page.getByTestId('scene')
  // 각 장의 첫 스테이지(풀잎 모양)
  const want = ['', 'dots', 'dots bow', 'dots bow heart', 'dots bow heart sparkle', 'dots bow heart sparkle']
  for (let c = 1; c <= 6; c++) {
    await showStage(page, (c - 1) * 10)
    await expect(host).toHaveAttribute('data-monster-decor', want[c - 1])
    await shootMonster(page, `monster-decor-ch${c}`)
  }
})

test('5장 몬스터는 종마다 장식을 모두 두른다', async ({ page }) => {
  await page.goto('./')
  const host = page.getByTestId('scene')
  for (const progress of [40, 41, 42, 43, 44, 49]) {
    await showStage(page, progress)
    await expect(host).toHaveAttribute('data-monster-decor', 'dots bow heart sparkle')
    const id = await host.getAttribute('data-monster')
    await shootMonster(page, `monster-decor-ch5-${id}`)
  }
})
