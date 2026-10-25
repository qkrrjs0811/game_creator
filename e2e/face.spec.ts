import { test, expect, type Page } from '@playwright/test'

/** 장면의 data-face가 바뀔 때마다 모아 둔다 */
async function watchFaces(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('[data-testid="scene"]')!
    const w = window as unknown as { __faces: string[] }
    w.__faces = []
    new MutationObserver(() => {
      const f = host.getAttribute('data-face') ?? ''
      if (w.__faces.at(-1) !== f) w.__faces.push(f)
    }).observe(host, { attributes: true, attributeFilter: ['data-face'] })
  })
}
const faces = (page: Page) => page.evaluate(() => (window as unknown as { __faces: string[] }).__faces)

/** 말랑이 둘레만 크게 찍는다 */
async function shootMascot(page: Page, name: string) {
  const host = page.getByTestId('scene')
  const [x, y, w, h] = (await host.getAttribute('data-mascot-tap'))!.split(',').map(Number)
  const canvas = (await host.locator('canvas').boundingBox())!
  await page.screenshot({
    path: `test-results/screens/${name}.png`,
    clip: { x: canvas.x + x - 16, y: canvas.y + y - 16, width: w + 32, height: h + 32 },
  })
}

test('가만히 있는 말랑이는 몇 초마다 눈을 깜빡이고, 누르면 기뻐함', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.goto('./')
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-face', /idle|blink/)
  await watchFaces(page)
  await page.screenshot({ path: 'test-results/screens/mascot-home.png' })

  // 10초 동안 두 번 넘게 깜빡이고, 깜빡인 뒤엔 다시 눈을 뜬다
  for (let i = 0; i < 100; i++) await page.clock.runFor(100)
  expect(Number(await host.getAttribute('data-blinks'))).toBeGreaterThanOrEqual(2)
  expect(await faces(page)).toEqual(expect.arrayContaining(['blink', 'idle']))
  await expect.poll(async () => {
    await page.clock.runFor(50)
    return host.getAttribute('data-face')
  }).toBe('idle')
  // 캔버스가 바뀐 얼굴을 그릴 때까지 몇 프레임 더 흘린다
  await page.clock.runFor(48)
  await expect(host).toHaveAttribute('data-face', 'idle')
  await shootMascot(page, 'face-idle')

  // 누르면 잠깐 기뻐한다
  const [x, y, w, h] = (await host.getAttribute('data-mascot-tap'))!.split(',').map(Number)
  const canvas = (await host.locator('canvas').boundingBox())!
  await page.mouse.click(canvas.x + x + w / 2, canvas.y + y + h / 2)
  await page.clock.runFor(200)
  await expect(host).toHaveAttribute('data-face', 'happy')
  await shootMascot(page, 'face-happy')
  await page.clock.runFor(1000)
  await expect(host).toHaveAttribute('data-face', /idle|blink/)
})

test('운동 중엔 눈썹을 올린 집중 표정',async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T08:00:00+09:00') })
  await page.goto('./')
  const host = page.getByTestId('scene')
  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-face', /focus|blink/)
  await page.clock.runFor(2000)
  await expect.poll(async () => {
    await page.clock.runFor(50)
    return host.getAttribute('data-face')
  }).toBe('focus')
  await shootMascot(page, 'face-focus')
})

test('휴식을 많이 한 말랑이는 졸린 눈', async ({ page }) => {
  await page.goto('./')
  const noon = new Date()
  noon.setHours(12, 0, 0, 0)
  const records = Array.from({ length: 6 }, (_, i) => {
    const startedAt = noon.getTime() - (i + 1) * 24 * 60 * 60 * 1000
    return { id: `r${i}`, activity: 'relax', startedAt, endedAt: startedAt + 30 * 60 * 1000 }
  })
  await page.evaluate(
    (r) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: r, active: null, skills: [], stageProgress: 0, cosmetics: [] }),
      ),
    records,
  )
  await page.reload()
  const host = page.getByTestId('scene')
  await expect(host).toHaveAttribute('data-traits', 'relax')
  await expect(host).toHaveAttribute('data-face', 'sleepy')
  await page.waitForTimeout(400)
  await shootMascot(page, 'face-sleepy')
})

test('전투: 때릴 땐 집중, 이기면 승리 표정 / 지면 맞은 표정', async ({ page }) => {
  await page.goto('./')
  const host = page.getByTestId('scene')
  await watchFaces(page)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('승리', { timeout: 30_000 })
  await expect(host).toHaveAttribute('data-face', 'win')
  expect(await faces(page)).toContain('focus')
  await page.waitForTimeout(500)
  await shootMascot(page, 'face-win')
  await page.screenshot({ path: 'test-results/screens/face-win-scene.png' })

  // 아직 못 이길 스테이지(기록 없이 3스테이지)는 진다
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 2, cosmetics: [] }),
    ),
  )
  await page.reload()
  await watchFaces(page)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-3').click()
  await expect(page.getByTestId('battle-result-title')).toContainText('아쉬워요', { timeout: 30_000 })
  await expect(host).toHaveAttribute('data-face', 'hurt')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/face-lose-scene.png' })
  // 맞은 순간을 크게 보려고 한 번 더 싸운다
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result')).toBeHidden()
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-3').click()
  await expect.poll(() => host.getAttribute('data-face'), { intervals: [20], timeout: 30_000 }).toBe('hurt')
  await shootMascot(page, 'face-hurt')
})
