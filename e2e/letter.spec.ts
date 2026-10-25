import { test, expect, type Page } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }
const at = (s: string) => Date.parse(`${s}+09:00`)
const rec = (activity: string, date: string, minutes: number) => ({
  id: `${activity}-${date}`,
  activity,
  startedAt: at(`${date}T07:00:00`),
  endedAt: at(`${date}T07:00:00`) + minutes * 60_000,
})
// 지난주(19~25일) 운동 30분씩 5일 + 수요일 공부 40분, 그 전 주(12~18일) 운동 1시간
const records = [
  ...['19', '20', '21', '22', '23'].map((d) => rec('exercise', `2026-10-${d}`, 30)),
  rec('study', '2026-10-21', 40),
  rec('exercise', '2026-10-14', 60),
]

async function seed(page: Page, seenLetter: string | null) {
  await page.goto('./')
  await page.evaluate(
    ([s, seen]) => {
      localStorage.setItem('growth-game:save', JSON.stringify(s))
      if (seen === null) localStorage.removeItem('growth-game:save:seen-letter')
      else localStorage.setItem('growth-game:save:seen-letter', seen)
    },
    [{ ...base, records }, seenLetter] as const,
  )
  await page.reload()
}

test('새 주에 처음 열면 지난주 편지를 한 번 띄우고, 닫으면 다시 안 뜸', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T09:00:00+09:00') })
  await seed(page, '2026-10-12')
  const letter = page.getByTestId('letter')
  await expect(letter).toBeVisible()
  await expect(page.getByTestId('letter-title')).toHaveText('💌 지난주 편지')
  await expect(page.getByTestId('letter-total')).toHaveText('지난주 3시간 10분 했어! · 지난번보다 +2시간 10분')
  await expect(page.getByTestId('letter-chips')).toContainText('🏅 도장 5일 · 목표 달성')
  await expect(page.getByTestId('letter-chips')).toContainText('🏃 운동 2시간 30분')
  await expect(page.getByTestId('letter-chips')).toContainText('📆 수요일 1시간 10분')
  await expect(page.getByTestId('letter-suggest')).toHaveText('이번 주엔 📚 독서도 해 볼까?')

  // 화면 안에 있고 모험·꾸미기 버튼을 가리지 않으며, 닫기 버튼은 손가락으로 누르기 충분하다
  const box = (await letter.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  for (const id of ['open-stages', 'open-cosmetics']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(b.y)
  }
  const close = (await page.getByTestId('letter-close').boundingBox())!
  expect(close.width).toBeGreaterThanOrEqual(44)
  expect(close.height).toBeGreaterThanOrEqual(44)
  await page.clock.runFor(500)
  await page.screenshot({ path: 'test-results/screens/letter.png' })

  await page.getByTestId('letter-close').click()
  await expect(letter).toBeHidden()
  await page.reload()
  await page.clock.runFor(2000)
  await expect(letter).toBeHidden()
})

test('처음 여는 창은 편지를 기억만 하고 띄우지 않음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T09:00:00+09:00') })
  await seed(page, null)
  await page.clock.runFor(2000)
  await expect(page.getByTestId('letter')).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('growth-game:save:seen-letter'))).toBe('2026-10-19')
})

test('도장판에서 지난주 편지를 다시 펼쳐 봄', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-27T09:00:00+09:00') })
  // 이미 본 편지라 홈에는 다시 뜨지 않는다
  await seed(page, '2026-10-19')
  await page.getByTestId('tab-me').click()
  const open = page.getByTestId('board-letter-open')
  await expect(open).toHaveText('💌 지난주 편지 보기')
  await expect(page.getByTestId('board-letter')).toBeHidden()
  await open.click()
  await expect(page.getByTestId('board-letter')).toBeVisible()
  await expect(open).toHaveText('💌 지난주 편지 접기')
  await expect(page.getByTestId('board-letter-total')).toHaveText('지난주 3시간 10분 했어! · 지난번보다 +2시간 10분')
  await expect(page.getByTestId('board-letter-chips')).toContainText('🏅 도장 5일 · 목표 달성')
  await expect(page.getByTestId('board-letter-suggest')).toHaveText('이번 주엔 📚 독서도 해 볼까?')

  // 버튼은 누르기 충분하고, 편지는 화면 폭 안에 들어간다
  const b = (await open.boundingBox())!
  expect(b.height).toBeGreaterThanOrEqual(44)
  await page.getByTestId('board-letter').scrollIntoViewIfNeeded()
  const box = (await page.getByTestId('board-letter').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/screens/board-letter.png' })

  await open.click()
  await expect(page.getByTestId('board-letter')).toBeHidden()
})

test('지난주 기록이 없으면 도장판에 편지 버튼이 없음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T09:00:00+09:00') })
  await seed(page, null)
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('board-title')).toBeVisible()
  await expect(page.getByTestId('board-letter-open')).toBeHidden()
})
