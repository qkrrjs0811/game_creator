import { test, expect } from '@playwright/test'

test('처음에는 1스테이지만 열려 있고 나머지는 잠김', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stages')).toBeVisible()
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-2')).toHaveAttribute('data-state', 'locked')
  // 한 장은 10칸, 10번째가 보스
  await expect(page.getByTestId('stage-chapter')).toHaveText('1장 · 말랑 나라')
  await expect(page.locator('.stage')).toHaveCount(10)
  await expect(page.getByTestId('stage-10')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('stage-10')).toContainText('보스')
  await expect(page.getByTestId('stage-go-2')).toHaveCount(0)
  // 목록이 길어도 닫기 버튼은 화면 안에 있다
  const close = (await page.getByTestId('stages-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  // 다음에 깰 스테이지에만 이길 만한지 알려 준다
  await expect(page.getByTestId('stage-hint')).toHaveCount(1)
  await expect(page.getByTestId('stage-1').getByTestId('stage-hint')).toHaveText('🍀 지금도 이길 만해요')

  await page.getByTestId('stages-close').click()
  await expect(page.getByTestId('stages')).toBeHidden()
})

test('깬 스테이지 수(stageProgress)에 따라 깸·도전·잠김을 보여 줌', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 2, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-2')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-3')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-4')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('stage-go-1')).toHaveText('다시')
  await expect(page.getByTestId('stage-go-3')).toHaveText('도전')
  await expect(page.getByTestId('stage-hint')).toHaveCount(1)
  await expect(page.getByTestId('stage-3').getByTestId('stage-hint')).toHaveText(/^💪 운동 (\d+시간 )?\d+분 더 하면 이길 만해요$|^💪 운동 \d+시간 더 하면 이길 만해요$/)
  await page.screenshot({ path: 'test-results/screens/stages.png' })

  await page.getByTestId('stages-close').click()
  await page.screenshot({ path: 'test-results/screens/home-adventure.png' })
})

test('2장으로 넘어가면 지도는 2장 10칸, 다음에 깰 칸이 목록 안에 보임', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 17, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('2장 · 반짝 나라')
  await expect(page.locator('.stage')).toHaveCount(10)
  await expect(page.getByTestId('stage-11')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-18')).toHaveAttribute('data-state', 'open')
  await expect(page.getByTestId('stage-20')).toContainText('보스')
  // 스크롤하지 않아도 도전 버튼이 목록 안에 보인다
  const list = (await page.getByTestId('stage-list').boundingBox())!
  const go = (await page.getByTestId('stage-go-18').boundingBox())!
  expect(go.y).toBeGreaterThanOrEqual(list.y)
  expect(go.y + go.height).toBeLessThanOrEqual(list.y + list.height)
  await page.screenshot({ path: 'test-results/screens/stages-chapter2.png' })
})

test('앞뒤 장으로 넘겨 보고, 아직 안 열린 장은 이름이 비밀', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 17, cosmetics: [] }),
    ),
  )
  await page.reload()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('2장 · 반짝 나라')

  // 앞 장: 다 깬 1장, 더 앞은 없다
  await page.getByTestId('chapter-prev').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('1장 · 말랑 나라')
  await expect(page.getByTestId('stage-1')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-10')).toHaveAttribute('data-state', 'cleared')
  await expect(page.getByTestId('stage-go-10')).toHaveText('다시')
  await expect(page.getByTestId('chapter-prev')).toBeDisabled()

  // 다음 장 둘: 2장, 그리고 아직 안 열린 3장(이름은 비밀), 더 뒤는 없다
  await page.getByTestId('chapter-next').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('2장 · 반짝 나라')
  await page.getByTestId('chapter-next').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('3장 · ???')
  await expect(page.getByTestId('chapter-next')).toBeDisabled()
  await expect(page.locator('.stage')).toHaveCount(10)
  await expect(page.getByTestId('stage-21')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('stage-21')).toContainText('1스테이지 · ???')
  await expect(page.getByTestId('stage-21')).toContainText('앞 장 보스를 깨면 열려요')
  await expect(page.getByTestId('stage-30')).toContainText('보스 · ???')
  await expect(page.getByTestId('stage-list')).not.toContainText('몽실')
  await expect(page.locator('.stage-go')).toHaveCount(0)
  // 넘기는 버튼도 손가락으로 누르기 충분하다
  for (const id of ['chapter-prev', 'chapter-next']) {
    const b = (await page.getByTestId(id).boundingBox())!
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.height).toBeGreaterThanOrEqual(44)
  }
  const close = (await page.getByTestId('stages-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/screens/stages-secret.png' })

  // 다시 열면 지금 장으로 돌아온다
  await page.getByTestId('stages-close').click()
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stage-chapter')).toHaveText('2장 · 반짝 나라')
  await expect(page.getByTestId('stage-18')).toHaveAttribute('data-state', 'open')
})
