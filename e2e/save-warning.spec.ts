import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// 저장소가 가득 차면 쓰기가 실패한다. 테스트에서 window.__full 로 흉내 낸다
const fullStorage = () => {
  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (k: string, v: string) {
    if ((window as unknown as { __full?: boolean }).__full) throw new DOMException('full', 'QuotaExceededError')
    setItem.call(this, k, v)
  }
}

test('저장이 실패하면 경고를 띄우고 백업을 권하며, 다시 저장되면 사라짐', async ({ page }) => {
  await page.addInitScript(fullStorage)
  await page.clock.install()
  await page.goto('./')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  await expect(page.getByTestId('save-warning')).toBeHidden()

  await page.evaluate(() => ((window as unknown as { __full: boolean }).__full = true))
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('save-warning')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/save-warning.png' })

  // 경고의 버튼으로 백업을 받으면 저장 못 한 기록도 들어 있다
  await page.getByTestId('save-warning-backup').click()
  await expect(page.getByTestId('settings')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-export').click()])
  const text = await readFile((await download.path())!, 'utf8')
  expect(JSON.parse(text).save.records).toHaveLength(1)
  await page.getByTestId('settings-close').click()

  // 자리가 나서 다시 저장되면 경고가 사라진다
  await page.evaluate(() => ((window as unknown as { __full: boolean }).__full = false))
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('save-warning')).toBeHidden()
  await page.getByTestId('toggle').click()
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
})

test('처음부터 저장할 수 없는 환경이면 열자마자 경고', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('denied', 'SecurityError')
    }
  })
  await page.goto('./')
  await expect(page.getByTestId('save-warning')).toBeVisible()
  await expect(page.getByTestId('toggle')).toBeVisible()
})
