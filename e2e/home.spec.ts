import { test, expect } from '@playwright/test'

test('처음 열면 Lv.1, 콘솔 오류 없음, 스크린샷 저장', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await page.screenshot({ path: 'test-results/screens/home.png' })
  expect(errors).toEqual([])
})

test('30분 운동하면 Lv.3', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('timer')).toHaveText(/^30:0\d$/)
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('exp-text')).toHaveText('EXP 50 / 200')
  await page.screenshot({ path: 'test-results/screens/after-30min.png' })
})

test('세션 중 새로고침해도 이어서 흐름', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00')
  await page.reload()
  await expect(page.getByTestId('toggle')).toHaveText('그만하기')
  await expect(page.getByTestId('timer')).toHaveText(/^10:0\d$/)
})

test('매니페스트와 서비스워커', async ({ page }) => {
  await page.goto('./')
  const href = await page.locator('link[rel=manifest]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await page.request.get(new URL(href!, page.url()).toString())
  expect((await res.json()).display).toBe('standalone')
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r))).toBe(true)
})

test('아래 탭 글자가 칸 가운데에 옴', async ({ page }) => {
  await page.goto('./')
  // 탭마다 글자 묶음(이름 + 준비 중)의 세로 가운데가 칸의 세로 가운데에서 얼마나 떨어졌는지 잰다
  const offsets = await page.locator('nav.tabs .tab').evaluateAll((tabs) =>
    tabs.map((tab) => {
      const box = tab.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(tab)
      // 배지(em)는 칸 밖으로 튀어나오므로 뺀다
      const badge = tab.querySelector('em')
      if (badge) range.setEndBefore(badge)
      const text = range.getBoundingClientRect()
      return {
        label: tab.firstChild?.textContent ?? '',
        diff: Math.abs((text.top + text.bottom) / 2 - (box.top + box.bottom) / 2),
      }
    }),
  )
  expect(offsets.length).toBe(5)
  for (const o of offsets) expect(o.diff, o.label).toBeLessThanOrEqual(3)
  await page.locator('nav.tabs').screenshot({ path: 'test-results/screens/tabs.png' })
})

test('홈 타이머 카드는 꼭 필요한 것만 — 넓어진 장면', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  // 오늘 목표 하나, 활동 안내, 이번 목표 버튼, 시작 버튼, 오늘 한 시간만 보인다
  await expect(page.getByTestId('goal-text')).toHaveText('🎯 오늘 목표 0 / 30분')
  await expect(page.getByTestId('timer-label')).toHaveText('운동하는 동안 힘·체력이 올라요')
  await expect(page.getByTestId('focus-pick')).toBeVisible()
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await expect(page.getByTestId('today')).toHaveText('오늘 0분')
  // 미션·주간·다짐은 접혀 있고, 00:00 숫자도 켜기 전엔 없다
  await expect(page.getByTestId('today-more')).toBeHidden()
  await expect(page.getByTestId('timer')).toBeHidden()
  // 장면이 화면의 반 넘게 차지하고, 카드는 아래 탭 위에서 끝난다
  const scene = (await page.getByTestId('scene').boundingBox())!
  expect(scene.height).toBeGreaterThan(844 / 2)
  const card = (await page.locator('section.timer-card').boundingBox())!
  const tabs = (await page.locator('nav.tabs').boundingBox())!
  expect(card.y + card.height).toBeLessThanOrEqual(tabs.y)
  expect(card.y).toBeGreaterThanOrEqual(scene.y + scene.height)
  await page.screenshot({ path: 'test-results/screens/home-simple.png' })
})
