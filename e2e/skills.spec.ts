import { test, expect } from '@playwright/test'

test('레벨업으로 받은 포인트로 스킬을 고르고, 새로고침해도 남음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('skill-badge')).toBeHidden()

  // 포인트가 없을 때는 배우기 버튼이 잠겨 있다
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skills')).toBeVisible()
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 0')
  await expect(page.getByTestId('learn-punch')).toBeDisabled()
  await page.getByTestId('skills-close').click()

  // 30분(경험치 300)이면 Lv.3 → 포인트 2
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('skill-badge')).toHaveText('2')

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 2')
  await page.getByTestId('learn-punch').click()
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 1')
  await expect(page.getByTestId('skill-rank-punch')).toHaveText('Lv.1')
  await page.screenshot({ path: 'test-results/screens/skills.png' })

  await page.getByTestId('learn-punch').click()
  await expect(page.getByTestId('skill-rank-punch')).toHaveText('Lv.2')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 0')
  await expect(page.getByTestId('learn-tough')).toBeDisabled()
  await page.getByTestId('skills-close').click()
  await expect(page.getByTestId('skill-badge')).toBeHidden()
  // 스킬을 배워도 레벨은 그대로다
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  await page.reload()
  expect(await page.evaluate(() => window.__debug.getSave().skills)).toEqual(['punch', 'punch'])
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skill-rank-punch')).toHaveText('Lv.2')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 0')
})

test('포인트가 있으면 나 탭에 숫자 배지', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:30')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('skill-badge')).toHaveText('1')
  await page.clock.runFor(4000)
  await page.screenshot({ path: 'test-results/screens/skill-badge.png' })
})
