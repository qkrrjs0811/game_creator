import { test, expect } from '@playwright/test'

test('독서 탭에서 독서 타이머를 켜면 집중이 오르고, 그동안 공부는 켤 수 없음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.locator('[data-mood]')
  await page.getByTestId('tab-reading').click()
  await expect(page.getByTestId('tab-reading')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('toggle')).toHaveText('독서 시작')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분')
  await expect(page.getByTestId('timer-label')).toHaveText('독서하는 동안 집중이 올라요')

  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'reading')
  await expect(page.getByTestId('tab-live-reading')).toBeVisible()
  // 레벨업 배지가 말풍선을 가리지 않게 Lv.2 전(8분)에 찍는다
  await page.clock.fastForward('08:00')
  await expect(page.getByTestId('timer-label')).toHaveText('독서 중 · 집중이 오르고 있어요')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/reading-running.png' })

  // 독서 중에는 공부 탭에서 공부를 켤 수 없다
  await page.getByTestId('tab-study').click()
  await expect(page.getByTestId('toggle')).toBeDisabled()
  await expect(page.getByTestId('timer-label')).toHaveText('독서 중이에요 · 그만하면 공부를 켤 수 있어요')

  // 독서 15분 → 집중 5+3, 지능·힘은 그대로
  await page.getByTestId('tab-reading').click()
  await page.clock.fastForward('07:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary-title')).toHaveText('🎉 독서 15분 했어요!')
  await expect(page.getByTestId('session-summary-detail')).toHaveText('EXP +150 · 🎯 집중 +3')
  await expect(host).toHaveAttribute('data-mood', 'rest')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/reading-summary.png' })

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-focus')).toHaveText('8')
  await expect(page.getByTestId('stat-value-int')).toHaveText('5')
  await expect(page.getByTestId('stat-value-str')).toHaveText('5')
  await expect(page.getByTestId('stat-role-focus')).toHaveText('회피·두루')
  await expect(page.getByTestId('stat-next-focus')).toHaveText('독서 5분 더')
  // 능력치 네 칸과 닫기 버튼이 폰 화면 안에 들어간다
  for (const id of ['str', 'vit', 'int', 'focus']) {
    const box = (await page.getByTestId(`stat-${id}`).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
  }
  await page.getByTestId('skills-close').scrollIntoViewIfNeeded()
  const close = (await page.getByTestId('skills-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/screens/reading-stats.png' })
})

test('독서는 하루 2시간까지, 다 채우면 안내하고 내일 이어서 오른다고 알림', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('tab-reading').click()
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('02:00:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 120분 / 120분')
  await expect(page.getByTestId('cap-toast')).toBeVisible()
  await expect(page.getByTestId('cap-toast')).toContainText('오늘 독서는 여기까지!')
  await expect(page.locator('[data-mood]')).toHaveAttribute('data-mood', 'full')
  await page.getByTestId('toggle').click()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-focus')).toHaveText('29')
  await expect(page.getByTestId('stat-next-focus')).toHaveText('내일 독서 5분 더')
  await expect(page.getByTestId('stat-next-int')).toHaveText('공부 5분 더')
})
