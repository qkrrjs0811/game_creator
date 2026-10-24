import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('백업 내려받기 후 새로 시작한 상태에서 가져오면 레벨이 돌아옴', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('settings')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/settings.png' })
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-export').click()])
  expect(download.suggestedFilename()).toMatch(/^growth-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const text = await readFile((await download.path())!, 'utf8')
  expect(JSON.parse(text).save.records).toHaveLength(1)
  await page.getByTestId('settings-close').click()
  await expect(page.getByTestId('settings')).toBeHidden()

  // 기록을 지우고 새로 시작한 상태
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.1')

  await page.getByTestId('open-settings').click()
  await page.getByTestId('backup-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.getByTestId('import-summary')).toHaveText('Lv.3 · 운동 기록 1개')
  await page.screenshot({ path: 'test-results/screens/import-confirm.png' })

  // 취소하면 그대로
  await page.getByTestId('import-no').click()
  await expect(page.getByTestId('backup-menu')).toBeVisible()
  await expect(page.getByTestId('level')).toHaveText('Lv.1')

  await page.getByTestId('backup-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  await page.getByTestId('import-yes').click()
  await expect(page.getByTestId('backup-msg')).toHaveText('백업으로 되돌렸어요.')
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  // 새로고침해도 유지
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
})

test('형식이 틀린 파일은 거절하고 기록은 그대로', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-settings').click()
  await page
    .getByTestId('backup-file')
    .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.getByTestId('backup-msg')).toHaveText('이 파일은 백업 파일이 아니에요. 다른 파일을 골라 주세요.')
  await expect(page.getByTestId('import-confirm')).toBeHidden()
  await page.screenshot({ path: 'test-results/screens/import-rejected.png' })
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
})
