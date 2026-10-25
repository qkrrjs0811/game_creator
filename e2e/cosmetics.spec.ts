import { test, expect, type Page } from '@playwright/test'

/** 입은 꾸미기(worn)가 없던 이전 형식 그대로 넣는다 */
async function useSave(page: Page, stageProgress: number, cosmetics: string[] = []) {
  await page.goto('./')
  await page.evaluate(
    ([p, c]) =>
      localStorage.setItem(
        'growth-game:save',
        JSON.stringify({ version: 1, records: [], active: null, skills: [], stageProgress: p, cosmetics: c }),
      ),
    [stageProgress, cosmetics] as const,
  )
  await page.reload()
}

test('처음에는 꾸미기가 모두 잠겨 있고 얻는 곳을 알려 줌', async ({ page }) => {
  await useSave(page, 0)
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetics')).toBeVisible()
  await expect(page.getByTestId('cosmetics-desc')).toContainText('스테이지를 처음 깨면')
  await expect(page.getByTestId('cosmetic-hat-sprout')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-hat-crown')).toContainText('6스테이지')
  await expect(page.locator('.cosmetic-wear')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/screens/cosmetics-empty.png' })
  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('cosmetics')).toBeHidden()
})

test('가진 모자와 색을 입히면 장면의 말랑이가 바뀌고 저장됨', async ({ page }) => {
  await useSave(page, 6, ['hat-sprout'])
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', '')
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetics-desc')).toContainText('6개 모았어요')
  // 다음 장 보스 모자는 잠겨서 얻는 곳을 알려 준다
  await expect(page.getByTestId('cosmetic-hat-ch1')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-hat-ch1')).toContainText('1장 보스')

  await page.getByTestId('wear-hat-crown').click()
  await page.getByTestId('wear-color-sky').click()
  await expect(page.getByTestId('cosmetic-hat-crown')).toHaveAttribute('data-state', 'worn')
  await expect(page.getByTestId('cosmetic-color-sky')).toHaveAttribute('data-state', 'worn')
  await expect(page.getByTestId('wear-hat-crown')).toHaveText('벗기')
  await page.screenshot({ path: 'test-results/screens/cosmetics.png' })

  // 같은 종류는 하나만
  await page.getByTestId('wear-hat-ribbon').click()
  await expect(page.getByTestId('cosmetic-hat-crown')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-hat-ribbon')).toHaveAttribute('data-state', 'worn')

  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-ribbon color-sky')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/home-dressed.png' })

  // 모습만 바뀌고 나머지 저장은 그대로
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual(['color-sky', 'hat-ribbon'])
  expect(s.cosmetics).toEqual(['hat-sprout'])
  expect(s.stageProgress).toBe(6)
  expect(s.records).toEqual([])
  await expect(page.getByTestId('level')).toHaveText('Lv.1')

  // 새로고침해도 입고 있음
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-ribbon color-sky')

  // 다시 누르면 벗음
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('wear-color-sky').click()
  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-ribbon')
})

test('솜사탕 분홍과 버섯 모자', async ({ page }) => {
  await useSave(page, 4)
  await page.getByTestId('open-cosmetics').click()
  await page.getByTestId('wear-color-cotton').click()
  await page.getByTestId('wear-hat-mushroom').click()
  await page.getByTestId('cosmetics-close').click()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-mushroom color-cotton')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/home-dressed-cotton.png' })
})

test('장 보스를 깬 저장은 장 모자를 가지고, 다음 장 모자는 잠겨 있음', async ({ page }) => {
  await useSave(page, 40)
  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetics-desc')).toContainText('10개 모았어요')
  for (const ch of [1, 2, 3, 4]) await expect(page.getByTestId(`cosmetic-hat-ch${ch}`)).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-hat-ch1')).toContainText('딸기 고깔모자')
  await expect(page.getByTestId('cosmetic-hat-ch5')).toHaveAttribute('data-state', 'locked')
  await expect(page.getByTestId('cosmetic-hat-ch5')).toContainText('5장 보스')
  await expect(page.getByTestId('cosmetic-hat-ch6')).toHaveCount(0)

  // 같은 종류는 하나만: 장 모자를 쓰면 왕관을 벗는다
  await page.getByTestId('wear-hat-crown').click()
  await page.getByTestId('wear-hat-ch4').click()
  await expect(page.getByTestId('cosmetic-hat-crown')).toHaveAttribute('data-state', 'owned')
  await expect(page.getByTestId('cosmetic-hat-ch4')).toHaveAttribute('data-state', 'worn')
  await page.screenshot({ path: 'test-results/screens/cosmetics-chapter.png' })

  // 모양(고깔·베레모·꽃핀·별핀)마다 장면의 말랑이가 쓴다
  for (const ch of [1, 2, 3, 4]) {
    const card = page.getByTestId(`cosmetic-hat-ch${ch}`)
    if ((await card.getAttribute('data-state')) !== 'worn') await page.getByTestId(`wear-hat-ch${ch}`).click()
    await page.getByTestId('cosmetics-close').click()
    await expect(page.getByTestId('scene')).toHaveAttribute('data-look', `hat-ch${ch}`)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/screens/home-chapter-hat-${ch}.png` })
    await page.getByTestId('open-cosmetics').click()
  }

  // 새로고침해도 쓰고 있고, 깬 스테이지는 그대로
  await page.reload()
  await expect(page.getByTestId('scene')).toHaveAttribute('data-look', 'hat-ch4')
  const s = await page.evaluate(() => window.__debug.getSave())
  expect(s.worn).toEqual(['hat-ch4'])
  expect(s.stageProgress).toBe(40)
})
