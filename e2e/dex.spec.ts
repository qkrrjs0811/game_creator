import { test, expect, type Page } from '@playwright/test'

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }

async function useSave(page: Page, save: object) {
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), save)
  await page.reload()
}

/** 도감은 홈 "🎁 모음" 창의 도감 칸에 있다 */
async function openDex(page: Page) {
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('cosmetics').getByTestId('collect-tab-dex').click()
  await expect(page.getByTestId('dex')).toBeVisible()
  await expect(page.getByTestId('cosmetics')).toBeHidden()
}

test('모음 창: 꾸미기와 도감 칸을 오가고, 모험 지도에는 도감 버튼이 없음', async ({ page }) => {
  await useSave(page, { ...base, stageProgress: 3, cosmetics: ['hat-sprout'] })
  await expect(page.getByTestId('open-cosmetics')).toHaveText('🎁 모음')
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetics')).toBeVisible()
  const tabs = page.getByTestId('cosmetics').getByTestId('collect-tabs')
  await expect(tabs.getByTestId('collect-tab-cosmetics')).toHaveAttribute('aria-selected', 'true')
  await expect(tabs.getByTestId('collect-tab-dex')).toHaveAttribute('aria-selected', 'false')
  // 칸 버튼은 손가락으로 누르기 충분하고 화면 안에 있다
  for (const t of ['cosmetics', 'dex']) {
    const box = (await tabs.getByTestId(`collect-tab-${t}`).boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
  }
  const close = (await page.getByTestId('cosmetics-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/screens/collection-cosmetics.png' })

  await tabs.getByTestId('collect-tab-dex').click()
  await expect(page.getByTestId('dex')).toBeVisible()
  await expect(page.getByTestId('cosmetics')).toBeHidden()
  await expect(page.getByTestId('dex').getByTestId('collect-tab-dex')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('dex-count')).toHaveText('📚 모은 몬스터 3')
  await page.screenshot({ path: 'test-results/screens/collection-dex.png' })

  // 다시 꾸미기 칸으로
  await page.getByTestId('dex').getByTestId('collect-tab-cosmetics').click()
  await expect(page.getByTestId('cosmetics')).toBeVisible()
  await expect(page.getByTestId('dex')).toBeHidden()
  await page.getByTestId('cosmetics-close').click()

  // 모험 지도에서는 도감 버튼을 뺐다
  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stages')).toBeVisible()
  await expect(page.getByTestId('open-dex')).toHaveCount(0)
})

test('아직 못 깼으면 도감은 비어 있고 다음에 만날 그림자 칸만 보임', async ({ page }) => {
  await useSave(page, base)
  await openDex(page)
  await expect(page.getByTestId('dex-count')).toHaveText('📚 모은 몬스터 0')
  await expect(page.getByTestId('dex-chapter')).toHaveText('1장 · 말랑 나라')
  await expect(page.getByTestId('dex-entry')).toHaveCount(0)
  await expect(page.getByTestId('dex-empty')).toBeVisible()
  await expect(page.getByTestId('dex-shadow')).toHaveCount(3)
  // 1스테이지는 처음부터 이길 만하다
  await expect(page.getByTestId('dex-shadow').first()).toContainText('1스테이지')
  await expect(page.getByTestId('dex-shadow').first()).toContainText('🍀 지금 만나요')
  await expect(page.getByTestId('dex-shadow').nth(2)).toContainText(/운동 .+ 더/)
  // 그림자 칸은 이름을 비밀로 둔다
  await expect(page.getByTestId('dex-grid')).not.toContainText('풀잎 말랑')
  await expect(page.getByTestId('dex-prev')).toBeDisabled()
  await expect(page.getByTestId('dex-next')).toBeDisabled()
  await page.screenshot({ path: 'test-results/screens/dex-empty.png' })

  // 닫으면 홈으로 돌아온다
  await page.getByTestId('dex-close').click()
  await expect(page.getByTestId('dex')).toBeHidden()
  await expect(page.getByTestId('stages')).toBeHidden()
})

test('모은 몬스터를 장별로 넘겨 보고, 지금 장 끝에 그림자 칸', async ({ page }) => {
  await useSave(page, { ...base, stageProgress: 23 })
  await openDex(page)
  const total = await page.evaluate(() => window.__debug.getSave().stageProgress)
  expect(total).toBe(23)
  await expect(page.getByTestId('dex-count')).toHaveText(/^📚 모은 몬스터 \d+$/)
  await expect(page.getByTestId('dex-chapter')).toHaveText('3장 · 몽실 나라')
  await expect(page.getByTestId('dex-shadow')).toHaveCount(3)
  await expect(page.getByTestId('dex-next')).toBeDisabled()
  // 지금 장에서 처음 만난 몬스터는 21~23스테이지 것뿐이다
  for (const text of await page.getByTestId('dex-entry').locator('span').allTextContents()) {
    expect(Number(text.match(/^(\d+)스테이지/)![1])).toBeGreaterThanOrEqual(21)
  }
  // 닫기 버튼은 화면 안
  const close = (await page.getByTestId('dex-close').boundingBox())!
  expect(close.y + close.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/screens/dex.png' })

  // 앞 장으로 넘기면 그 장에서 만난 몬스터, 그림자는 없다
  await page.getByTestId('dex-prev').click()
  await page.getByTestId('dex-prev').click()
  await expect(page.getByTestId('dex-chapter')).toHaveText('1장 · 말랑 나라')
  await expect(page.getByTestId('dex-prev')).toBeDisabled()
  await expect(page.getByTestId('dex-shadow')).toHaveCount(0)
  await expect(page.getByTestId('dex-entry').first()).toContainText('풀잎 말랑')
  await expect(page.getByTestId('dex-entry').first()).toContainText('1스테이지에서 만남')
  await expect(page.locator('.dex-cell.boss')).toContainText('👑 왕 말랑')
  await expect(page.locator('.dex-cell.boss')).toContainText('10스테이지에서 만남')
  // 칸 글자가 칸 밖으로 넘치지 않는다
  const overflow = await page.locator('.dex-cell').evaluateAll((cells) =>
    cells.filter((c) => [...c.children].some((k) => k.getBoundingClientRect().right > c.getBoundingClientRect().right + 1)).length,
  )
  expect(overflow).toBe(0)
  await page.screenshot({ path: 'test-results/screens/dex-chapter1.png' })

  // 다시 열면 지금 장부터
  await page.getByTestId('dex-close').click()
  await openDex(page)
  await expect(page.getByTestId('dex-chapter')).toHaveText('3장 · 몽실 나라')
})
