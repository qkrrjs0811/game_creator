import { test, expect } from '@playwright/test'

test('운동을 그만하면 이번에 얻은 경험치와 능력치를 보여 줌', async ({ page }) => {
  // 자정을 넘기지 않도록 아침에서 시작한다
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary')).toBeHidden()
  await page.clock.fastForward('32:00')
  await page.getByTestId('toggle').click()

  const summary = page.getByTestId('session-summary')
  await expect(summary).toBeVisible()
  await expect(page.getByTestId('session-summary-title')).toHaveText('🎉 운동 32분 했어요!')
  await expect(page.getByTestId('session-summary-detail')).toHaveText('EXP +320 · 💪 힘 +3 · ❤️ 체력 +3')
  // 요약이 떠 있어도 모험·꾸미기 버튼은 바로 누를 수 있다
  const box = (await summary.boundingBox())!
  for (const id of ['open-stages', 'open-cosmetics']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(box.y + box.height)
  }
  // 요약이 말랑이와 몬스터를 가리지 않는다(장면이 남기는 발끝 높이로 잰다)
  const scene = (await page.getByTestId('scene').boundingBox())!
  const feet = Number(await page.locator('[data-feet]').getAttribute('data-feet'))
  // 캔버스가 장면 칸에 꼭 맞아야 아래쪽이 잘리지 않는다
  const canvas = (await page.locator('canvas').boundingBox())!
  expect(Math.abs(canvas.height - scene.height)).toBeLessThanOrEqual(1)
  expect(scene.y + feet).toBeLessThanOrEqual(box.y)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/screens/session-summary.png' })

  // 닫기 버튼으로 닫고, 다시 시작하면 지난 요약은 남지 않는다
  await page.getByTestId('session-summary-close').click()
  await expect(summary).toBeHidden()
  await page.getByTestId('toggle').click()
  await expect(summary).toBeHidden()
  await page.clock.fastForward('05:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary-detail')).toHaveText('EXP +50')

  // 잠깐 뒤에는 저절로 사라진다
  await page.clock.fastForward('00:07')
  await expect(summary).toBeHidden()
})

test('상한을 채운 뒤 그만하면 경험치는 내일 쌓인다고 알려 줌', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('03:00:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary-detail')).toContainText('EXP +1800')

  await page.getByTestId('toggle').click()
  await page.clock.fastForward('20:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary-title')).toHaveText('🎉 운동 20분 했어요!')
  await expect(page.getByTestId('session-summary-detail')).toHaveText('상한을 채워서 경험치는 내일 쌓여요')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
  // 안내가 한 줄에 들어가 카드가 길어지지 않고, 말랑이를 가리지 않는다
  const detail = (await page.getByTestId('session-summary-detail').boundingBox())!
  expect(detail.height).toBeLessThan(13 * 1.4 * 1.5)
  const box = (await page.getByTestId('session-summary').boundingBox())!
  const scene = (await page.getByTestId('scene').boundingBox())!
  const feet = Number(await page.locator('[data-feet]').getAttribute('data-feet'))
  expect(scene.y + feet).toBeLessThanOrEqual(box.y)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/screens/session-summary-cap.png' })
})
