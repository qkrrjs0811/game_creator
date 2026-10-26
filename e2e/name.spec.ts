import { test, expect } from '@playwright/test'

const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('growth-game:save')!) as { name?: string; stageProgress: number })

test('나 창에서 이름을 지으면 위쪽과 전투에서 그 이름으로 부른다', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('char-name')).toHaveText('말랑이')
  await page.getByTestId('tab-me').click()
  const input = page.getByTestId('name-input')
  await expect(input).toHaveValue('말랑이')

  // 칸과 버튼이 손가락 크기이고 폰 화면 안에 있다
  for (const id of ['name-input', 'name-save']) {
    const box = (await page.getByTestId(id).boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
  }

  // 비었거나 8자를 넘으면 거절하고 이유를 알린다
  await input.fill('   ')
  await page.getByTestId('name-save').click()
  await expect(page.getByTestId('name-hint')).toHaveText('이름을 한 글자 이상 써 주세요')
  await input.fill('가나다라마바사아자')
  await page.getByTestId('name-save').click()
  await expect(page.getByTestId('name-hint')).toHaveText('이름은 8자까지 지을 수 있어요')
  // 처음 연 저장은 아직 쓰이지 않았을 수 있다
  expect((await saved(page))?.name).toBeUndefined()

  await input.fill(' 콩떡 ')
  await page.getByTestId('name-save').click()
  await expect(page.getByTestId('name-hint')).toHaveText('✨ 이제 콩떡이라고 불러요')
  await expect(input).toHaveValue('콩떡')
  expect((await saved(page)).name).toBe('콩떡')
  await page.screenshot({ path: 'test-results/screens/name-pick.png' })

  await page.getByTestId('skills-close').click()
  await expect(page.getByTestId('char-name')).toHaveText('콩떡')

  // 다시 열어도 이름이 남는다
  await page.reload()
  await expect(page.getByTestId('char-name')).toHaveText('콩떡')

  // 전투 띠에서도 지은 이름으로 부른다(이름은 전투 값과 무관)
  await page.getByTestId('open-stages').click()
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle-status')).toHaveText('콩떡 vs 풀잎 말랑')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'test-results/screens/name-battle.png' })
})

test('긴 이름과 칭호가 있어도 위쪽 줄이 화면 밖으로 넘치지 않는다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [], name: '말랑말랑콩떡떡이' }),
    ),
  )
  await page.reload()
  await expect(page.getByTestId('char-name')).toHaveText('말랑말랑콩떡떡이')
  const exp = (await page.getByTestId('exp-text').boundingBox())!
  const gear = (await page.getByTestId('open-settings').boundingBox())!
  const name = (await page.getByTestId('char-name').boundingBox())!
  expect(name.x + name.width).toBeLessThanOrEqual(exp.x)
  expect(gear.x + gear.width).toBeLessThanOrEqual(390)
  await page.locator('header.top').screenshot({ path: 'test-results/screens/name-top.png' })
})

test('기본 이름으로 되돌리면 저장에서 이름이 빠진다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem(
      'growth-game:save',
      JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: 2, cosmetics: [], worn: [], name: '콩떡' }),
    ),
  )
  await page.reload()
  await page.getByTestId('tab-me').click()
  await page.getByTestId('name-input').fill('말랑이')
  await page.getByTestId('name-input').press('Enter')
  await expect(page.getByTestId('name-hint')).toHaveText('✨ 이제 말랑이라고 불러요')
  const s = await saved(page)
  expect(s.name).toBeUndefined()
  expect(s.stageProgress).toBe(2)
  await page.getByTestId('skills-close').click()
  await expect(page.getByTestId('char-name')).toHaveText('말랑이')
})
