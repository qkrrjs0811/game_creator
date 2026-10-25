import { test, expect } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
/** 그날 7시부터 활동 m분 */
const rec = (activity: string, date: string, m: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + m * 60_000,
})

test('운동 1시간을 채우면 홈에 업적 달성 알림을 한 번 띄우고, 다시 열어도 또 띄우지 않는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('59:00')
  await expect(page.getByTestId('achievement-toast')).toBeHidden()

  await page.clock.fastForward('01:00')
  const toast = page.getByTestId('achievement-toast')
  // 레벨업 배지와 같은 자리라 그게 사라진 뒤에 뜬다
  await expect(toast).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('achievement-toast-title')).toHaveText('🏆 업적 달성!')
  await expect(page.getByTestId('achievement-toast-detail')).toHaveText('운동 1시간 · 🏅 땀방울 새싹')
  await expect(page.getByTestId('levelup')).toBeHidden()
  await page.waitForTimeout(700)

  // 장면 안에 들어오고, 모험·꾸미기 버튼과 시작 버튼을 가리지 않는다
  const box = (await toast.boundingBox())!
  const scene = (await page.getByTestId('scene').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(scene.x)
  expect(box.x + box.width).toBeLessThanOrEqual(scene.x + scene.width)
  expect(box.y).toBeGreaterThanOrEqual(scene.y)
  for (const id of ['open-stages', 'open-cosmetics']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(b.y)
  }
  // 알림이 떠 있어도 버튼은 그대로 누를 수 있다
  await expect(toast).toHaveCSS('pointer-events', 'none')
  await page.screenshot({ path: 'test-results/screens/achievement-toast.png' })

  await page.clock.fastForward('00:05')
  await expect(toast).toBeHidden()
  await page.reload()
  await page.clock.fastForward('00:03')
  await expect(toast).toBeHidden()
})

test('처음 열 때 이미 닿아 있던 업적은 묶어서 한 번만 알린다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-23T20:00:00+09:00') })
  // 운동 150분씩 3일 = 운동 1시간 + 3일 이어 하기
  const records = [rec('exercise', '2026-10-20', 150), rec('exercise', '2026-10-21', 150), rec('exercise', '2026-10-22', 150)]
  await page.addInitScript((s) => {
    if (!localStorage.getItem('growth-game:save')) localStorage.setItem('growth-game:save', s)
  }, JSON.stringify({ ...base, records }))
  // 시계가 실제로도 흐르면 느린 실행에서 첫 화면을 띄우는 동안 4초짜리 알림이 재기 전에 사라진다 — 멈춰 두고 runFor로만 흘린다
  await page.clock.pauseAt(new Date('2026-10-23T20:00:00+09:00'))
  await page.goto('./')
  const toast = page.getByTestId('achievement-toast')
  await expect
    .poll(async () => {
      await page.clock.runFor(100)
      return toast.isVisible()
    })
    .toBe(true)
  await expect(page.getByTestId('achievement-toast-title')).toHaveText('🏆 업적 2개 달성!')
  await expect(page.getByTestId('achievement-toast-detail')).toHaveText('🏅 땀방울 새싹 외 칭호 1개')
  await page.clock.runFor(700)
  await page.screenshot({ path: 'test-results/screens/achievement-toast-bundle.png' })

  await page.clock.runFor(5000)
  await expect(toast).toBeHidden()
  await page.reload()
  await page.clock.runFor(3000)
  await expect(toast).toBeHidden()
})
