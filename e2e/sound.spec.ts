import { test, expect } from '@playwright/test'

const sounds = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.dataset.sounds ?? '')

test('효과음: 전투에서 타격·승리 소리, 레벨업 소리가 나고 설정에서 끄면 조용하다', async ({ page }) => {
  await page.goto('./')
  // 기본은 켬
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 20_000 })
  const played = (await sounds(page)).split(' ')
  expect(played.some((s) => s === 'hit' || s === 'crit')).toBe(true)
  expect(played.at(-1)).toBe('win')
  await page.getByTestId('battle-action').click()

  await page.getByTestId('open-settings').click()
  const toggle = page.getByTestId('sound-toggle')
  await expect(toggle).toHaveText('🔊 효과음 켬')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: 'test-results/screens/settings-sound.png' })
  await toggle.click()
  await expect(toggle).toHaveText('🔇 효과음 끔')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.screenshot({ path: 'test-results/screens/settings-sound-off.png' })

  // 다시 열어도 끈 채로 남는다
  await page.reload()
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('sound-toggle')).toHaveText('🔇 효과음 끔')
  await page.getByTestId('settings-close').click()
  await page.evaluate(() => delete document.documentElement.dataset.sounds)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-result')).toBeVisible({ timeout: 20_000 })
  expect(await sounds(page)).toBe('')
})

test('효과음: 레벨이 오르면 레벨업 소리가 난다', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  expect((await sounds(page)).split(' ')).toContain('levelup')
})
