import { test, expect } from '@playwright/test'

// 서비스워커가 페이지를 맡을 때까지 기다린다(처음 열 때는 설치 → 활성화 → 맡기 순서)
async function waitForServiceWorker(page: import('@playwright/test').Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test('인터넷이 끊겨도 앱이 열리고 기록이 남아 있음', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.clock.install()
  await page.goto('./')
  await waitForServiceWorker(page)

  // 온라인일 때 30분 운동해 둔다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await expect(page.locator('canvas')).toBeVisible()

  // 인터넷 없이도 타이머가 돈다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('05:00')
  await expect(page.getByTestId('timer')).toHaveText(/^05:0\d$/)
  await page.getByTestId('toggle').click()
  await page.screenshot({ path: 'test-results/screens/offline.png' })

  // 다른 화면 주소로 들어와도(새 탭처럼) 열린다
  await page.goto('./?from=offline')
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  expect(errors).toEqual([])
})
