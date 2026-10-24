import { test, expect } from '@playwright/test'

test('레벨이 오르는 순간 축하 연출, 새로 열 때는 띄우지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('levelup')).toBeHidden()

  // 10분(경험치 100)이면 Lv.2
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('09:58')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  await expect(page.getByTestId('levelup')).toBeHidden()

  await page.clock.fastForward('00:03')
  await expect(page.getByTestId('level')).toHaveText('Lv.2')
  await expect(page.getByTestId('levelup')).toBeVisible()
  await expect(page.getByTestId('levelup-level')).toHaveText('Lv.2 달성!')
  await expect(page.getByTestId('levelup-points')).toHaveText('✨ 스킬 포인트 +1 · 나 탭에서 골라요')
  // 배지가 다 커지고 색종이가 퍼진 순간을 찍는다
  await page.clock.runFor(450)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/screens/levelup.png' })

  // 잠시 뒤 사라진다
  await page.clock.runFor(4000)
  await expect(page.getByTestId('levelup')).toBeHidden()

  // 새로고침하면 지금 레벨은 축하하지 않는다
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.2')
  await page.clock.runFor(1500)
  await expect(page.getByTestId('levelup')).toBeHidden()
})

test('레벨 글자가 통통 튈 때도 말랑이 이름과 겹치지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:01')
  await expect(page.getByTestId('level')).toHaveText('Lv.2')
  await expect(page.getByTestId('level')).toHaveClass(/pop/)
  // 가장 크게 커진 순간(40%)에 멈춰 잰다
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      if ((a as CSSAnimation).animationName === 'level-pop') {
        a.pause()
        a.currentTime = 240
      }
    }
  })
  const level = (await page.getByTestId('level').boundingBox())!
  const name = (await page.getByTestId('char-name').boundingBox())!
  await page.screenshot({ path: 'test-results/screens/level-pop.png', clip: { x: 0, y: 0, width: 390, height: 120 } })
  expect(level.x).toBeGreaterThanOrEqual(0)
  expect(level.x + level.width).toBeLessThanOrEqual(name.x - 2)
})

test('앱을 닫아 둔 사이 레벨이 오르면 다시 열 때 축하함', async ({ context }) => {
  await context.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  let page = await context.newPage()
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('05:00')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')

  // 운동하러 가며 앱을 닫는다. 25분 뒤(모두 30분 = 300 EXP) 다시 열면 Lv.3
  await page.close()
  page = await context.newPage()
  await page.clock.fastForward('25:00')
  await page.goto('./')
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('levelup')).toBeVisible()
  await expect(page.getByTestId('levelup-level')).toHaveText('Lv.3 달성!')
  // Lv.1 → Lv.3 이라 포인트 2개
  await expect(page.getByTestId('levelup-points')).toHaveText('✨ 스킬 포인트 +2 · 나 탭에서 골라요')
  await page.clock.runFor(450)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/screens/levelup-reopen.png' })

  // 이미 본 레벨은 다시 열어도 또 축하하지 않는다
  await page.clock.runFor(4000)
  await expect(page.getByTestId('levelup')).toBeHidden()
  await page.reload()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await page.clock.runFor(1500)
  await expect(page.getByTestId('levelup')).toBeHidden()
})
