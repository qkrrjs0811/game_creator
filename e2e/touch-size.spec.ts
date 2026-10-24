import { test, expect, type Page } from '@playwright/test'

/** 손가락으로 누르기 충분한 크기(px) */
const MIN_TOUCH = 44

/** 보이는 버튼마다 크기와 화면 안에 들어오는지 본다. 문제가 있는 버튼 설명 목록을 돌려준다 */
async function badButtons(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const bad: string[] = []
    if (document.documentElement.scrollWidth > vw) bad.push(`가로로 넘침 ${document.documentElement.scrollWidth}px`)
    for (const b of document.querySelectorAll<HTMLElement>('button')) {
      const r = b.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(b).visibility === 'hidden') continue
      const name = b.dataset.testid ?? b.textContent?.trim() ?? '?'
      // 크기는 튀어나오는 연출(scale) 중에도 흔들리지 않게 레이아웃 크기로 잰다
      const w = b.offsetWidth
      const h = b.offsetHeight
      if (w < min || h < min) bad.push(`${name} 작음 ${w}×${h}`)
      if (r.left < 0 || r.right > vw || r.top < 0 || r.bottom > vh) bad.push(`${name} 화면 밖`)
    }
    return bad
  }, MIN_TOUCH)
}

async function useSave(page: Page, save: object) {
  await page.goto('./')
  await page.evaluate((s) => localStorage.setItem('growth-game:save', JSON.stringify(s)), save)
  await page.reload()
}

const base = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }

test('모든 화면의 버튼이 누르기 충분히 크고 화면 안에 있음', async ({ page }) => {
  // 레벨 3(스킬 포인트 2), 2스테이지까지 깸, 꾸미기 2개
  const t = Date.now() - 2 * 3600_000
  await useSave(page, {
    ...base,
    records: [{ id: 'exercise-1', activity: 'exercise', startedAt: t, endedAt: t + 30 * 60_000 }],
    stageProgress: 2,
  })
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  const screens: Record<string, string[]> = {}
  screens['홈'] = await badButtons(page)

  await page.getByTestId('toggle').click()
  screens['홈(운동 중)'] = await badButtons(page)
  await page.getByTestId('toggle').click()

  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('settings')).toBeVisible()
  screens['설정'] = await badButtons(page)
  await page.getByTestId('backup-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(base)),
  })
  await expect(page.getByTestId('import-confirm')).toBeVisible()
  screens['가져오기 확인'] = await badButtons(page)
  await page.getByTestId('import-no').click()
  await page.getByTestId('settings-close').click()

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skills')).toBeVisible()
  screens['나'] = await badButtons(page)
  await page.getByTestId('skills-close').click()

  await page.getByTestId('open-cosmetics').click()
  await expect(page.getByTestId('cosmetics')).toBeVisible()
  screens['꾸미기'] = await badButtons(page)
  await page.getByTestId('cosmetics-close').click()

  await page.getByTestId('open-stages').click()
  await expect(page.getByTestId('stages')).toBeVisible()
  screens['모험 지도'] = await badButtons(page)
  await page.getByTestId('stage-go-1').click()
  await expect(page.getByTestId('battle')).toBeVisible()
  screens['전투'] = await badButtons(page)
  await page.getByTestId('battle-action').click()
  await expect(page.getByTestId('battle-result')).toBeVisible()
  screens['전투 결과'] = await badButtons(page)
  await page.screenshot({ path: 'test-results/screens/touch-size.png' })

  expect(screens).toEqual(Object.fromEntries(Object.keys(screens).map((k) => [k, []])))
})

test('상한 안내와 저장 실패 경고의 버튼도 누르기 충분히 큼', async ({ page }) => {
  // 오늘 낮 3시, 정오부터 운동 중 → 상한(180분)에 닿아 안내가 뜬다
  const now = new Date(2026, 9, 25, 15, 0).getTime()
  await page.clock.install({ time: now })
  await useSave(page, { ...base, active: { activity: 'exercise', startedAt: now - 180 * 60_000 } })
  await expect(page.getByTestId('cap-toast')).toBeVisible()
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
  })
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('save-warning')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/touch-size-alerts.png' })
  expect(await badButtons(page)).toEqual([])
})
