import { test, expect } from '@playwright/test'

test('휴식 탭에서 휴식 타이머를 켜면 체력이 조금 오르고, 하루 30분까지만 인정', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  const host = page.locator('[data-mood]')
  await page.getByTestId('tab-relax').click()
  await expect(page.getByTestId('tab-relax')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('toggle')).toHaveText('휴식 시작')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분 / 30분')
  await expect(page.getByTestId('timer-label')).toHaveText('푹 쉬는 동안 체력이 조금 올라요')
  // 다섯 탭이 모두 폰 화면 안에 들어가고 누르기 충분히 크다
  for (const id of ['exercise', 'study', 'reading', 'relax']) {
    const box = (await page.getByTestId(`tab-${id}`).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  await page.screenshot({ path: 'test-results/screens/relax-idle.png' })

  await page.getByTestId('toggle').click()
  await expect(host).toHaveAttribute('data-mood', 'relax')
  await expect(page.getByTestId('tab-live-relax')).toBeVisible()
  await page.clock.fastForward('08:00')
  await expect(page.getByTestId('timer-label')).toHaveText('휴식 중 · 체력이 조금씩 올라요')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/relax-running.png' })

  // 휴식 중에는 운동을 켤 수 없다
  await page.getByTestId('tab-exercise').click()
  await expect(page.getByTestId('toggle')).toBeDisabled()
  await expect(page.getByTestId('timer-label')).toHaveText('휴식 중이에요 · 그만하면 운동을 켤 수 있어요')

  // 한 시간 켜 둬도 30분만 인정 → 체력 +2, 힘은 그대로
  await page.getByTestId('tab-relax').click()
  await page.clock.fastForward('52:00')
  await expect(page.getByTestId('today')).toHaveText('오늘 30분 / 30분')
  await expect(page.getByTestId('cap-toast')).toContainText('오늘 휴식은 여기까지!')
  await expect(host).toHaveAttribute('data-mood', 'full')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('session-summary-title')).toHaveText('🎉 휴식 1시간 했어요!')
  await expect(page.getByTestId('session-summary-detail')).toHaveText('EXP +300 · ❤️ 체력 +2')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/relax-summary.png' })

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-vit')).toHaveText('7')
  await expect(page.getByTestId('stat-value-str')).toHaveText('5')
  await expect(page.getByTestId('stat-next-vit')).toHaveText('운동 10분 더')
})
