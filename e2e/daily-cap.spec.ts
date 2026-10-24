import { test, expect } from '@playwright/test'

test('오늘 운동 시간을 보여 주고, 상한에 닿으면 안내', async ({ page }) => {
  // 자정을 넘기지 않도록 아침에서 시작한다
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분 / 180분')

  await page.getByTestId('toggle').click()
  await page.clock.fastForward('42:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 42분 / 180분')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/today-42.png' })

  await page.clock.fastForward('02:18:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')
  await expect(page.getByTestId('cap-toast')).toBeVisible()
  await expect(page.getByTestId('timer-label')).toContainText('오늘은 충분히 했어요')
  // 안내가 떠 있어도 모험·꾸미기 버튼은 가려지지 않고, 말랑이도 가리지 않는다
  await page.waitForTimeout(500)
  const box = (await page.getByTestId('cap-toast').boundingBox())!
  for (const id of ['open-stages', 'open-cosmetics']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(box.y + box.height)
  }
  const scene = (await page.getByTestId('scene').boundingBox())!
  const feet = Number(await page.locator('[data-feet]').getAttribute('data-feet'))
  expect(scene.y + feet).toBeLessThanOrEqual(box.y)
  await page.screenshot({ path: 'test-results/screens/daily-cap.png' })
  await page.getByTestId('cap-toast-close').click()
  await expect(page.getByTestId('cap-toast')).toBeHidden()

  // 더 해도 오늘 분은 늘지 않는다
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 180분 / 180분')

  // 다시 시작해도 하루 한 번만 띄운다
  await page.getByTestId('toggle').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('00:05')
  await expect(page.getByTestId('cap-toast')).toBeHidden()
})

test('상한을 채우면 나 창의 능력치 칸이 내일 이어서 오른다고 알려 준다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('02:57:00')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-next-str')).toHaveText('운동 3분 더')

  // 열어 둔 채 상한에 닿으면 바로 "내일"로 바뀐다
  await page.clock.fastForward('03:00')
  await expect(page.getByTestId('stat-next-str')).toHaveText('내일 운동 10분 더')
  await expect(page.getByTestId('stat-next-vit')).toHaveText('내일 운동 10분 더')
  await expect(page.getByTestId('stat-next-int')).toHaveText('준비 중')
  const small = page.getByTestId('stat-next-str')
  const card = page.getByTestId('stat-str')
  const [s, c] = [await small.boundingBox(), await card.boundingBox()]
  expect(s!.x).toBeGreaterThanOrEqual(c!.x)
  expect(s!.x + s!.width).toBeLessThanOrEqual(c!.x + c!.width)
  expect(s!.height).toBeLessThan(24) // 한 줄
  await page.screenshot({ path: 'test-results/screens/stats-cap.png' })

  // 다음 날이 되면 다시 오늘 하면 된다
  await page.getByTestId('skills-close').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('16:00:00')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-next-str')).toHaveText('운동 10분 더')
})
