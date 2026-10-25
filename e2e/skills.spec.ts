import { test, expect } from '@playwright/test'

test('레벨업으로 받은 포인트로 스킬을 고르고, 새로고침해도 남음', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await expect(page.getByTestId('skill-badge')).toBeHidden()

  // 포인트가 없을 때는 배우기 버튼이 잠겨 있다
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skills')).toBeVisible()
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 0')
  await expect(page.getByTestId('learn-punch')).toBeDisabled()
  await page.getByTestId('skills-close').click()

  // 30분(경험치 300)이면 Lv.3 → 포인트 2
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await expect(page.getByTestId('skill-badge')).toHaveText('2')

  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 2')
  // 잘못 눌러도 포인트가 사라지지 않게, 한 번 누르면 묻고 한 번 더 눌러야 배운다
  await page.getByTestId('learn-tough').click()
  await expect(page.getByTestId('learn-tough')).toHaveText('정말?')
  await expect(page.getByTestId('skill-hint')).toHaveText('한 번 더 누르면 단단한 몸을 배워요')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 2')
  await page.screenshot({ path: 'test-results/screens/skills-confirm.png' })
  // 다른 스킬을 누르면 그쪽으로 옮겨 간다
  await page.getByTestId('learn-punch').click()
  await expect(page.getByTestId('learn-tough')).toHaveText('배우기')
  await expect(page.getByTestId('learn-punch')).toHaveText('정말?')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 2')
  await page.getByTestId('learn-punch').click()
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 1')
  await expect(page.getByTestId('skill-rank-punch')).toHaveText('Lv.1')
  await expect(page.getByTestId('learn-punch')).toHaveText('배우기')
  await page.screenshot({ path: 'test-results/screens/skills.png' })

  // 묻는 중에 창을 닫으면 취소된다
  await page.getByTestId('learn-punch').click()
  await page.getByTestId('skills-close').click()
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('learn-punch')).toHaveText('배우기')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 1')

  await page.getByTestId('learn-punch').click()
  await page.getByTestId('learn-punch').click()
  await expect(page.getByTestId('skill-rank-punch')).toHaveText('Lv.2')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 0')
  await expect(page.getByTestId('learn-tough')).toBeDisabled()
  await page.getByTestId('skills-close').click()
  await expect(page.getByTestId('skill-badge')).toBeHidden()
  // 스킬을 배워도 레벨은 그대로다
  await expect(page.getByTestId('level')).toHaveText('Lv.3')

  await page.reload()
  expect(await page.evaluate(() => window.__debug.getSave().skills)).toEqual(['punch', 'punch'])
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('skill-rank-punch')).toHaveText('Lv.2')
  await expect(page.getByTestId('skill-points')).toHaveText('남은 포인트 0')
})

test('포인트가 있으면 나 탭에 숫자 배지', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:30')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('skill-badge')).toHaveText('1')
  await page.clock.runFor(4000)
  await page.screenshot({ path: 'test-results/screens/skill-badge.png' })
})

test('나 창에서 운동으로 오른 힘·체력과 다음까지 남은 분을 본다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T08:00:00+09:00') })
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-str')).toHaveText('5')
  await expect(page.getByTestId('stat-next-str')).toHaveText('운동 10분 더')
  await expect(page.getByTestId('stat-next-int')).toHaveText('공부 5분 더')
  await page.getByTestId('skills-close').click()

  // 37분 운동 → 힘·체력 5+3, 다음까지 3분. 열어 둔 채로 운동하면 바로 바뀐다
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('37:00')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-value-str')).toHaveText('8')
  await expect(page.getByTestId('stat-value-vit')).toHaveText('8')
  await expect(page.getByTestId('stat-next-vit')).toHaveText('운동 3분 더')
  await page.clock.fastForward('03:00')
  await expect(page.getByTestId('stat-value-str')).toHaveText('9')
  await expect(page.getByTestId('stat-value-int')).toHaveText('5')
  await page.screenshot({ path: 'test-results/screens/stats.png' })
})

test('나 창 능력치 칸에 전투에서 하는 일이 보이고 칸 안에 들어감', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('tab-me').click()
  await expect(page.getByTestId('stat-role-str')).toHaveText('공격')
  await expect(page.getByTestId('stat-role-vit')).toHaveText('HP·방어')
  await expect(page.getByTestId('stat-role-int')).toHaveText('치명타·두루')
  await expect(page.getByTestId('stat-role-focus')).toHaveText('회피·두루')
  for (const id of ['str', 'vit', 'int', 'focus']) {
    const role = (await page.getByTestId(`stat-role-${id}`).boundingBox())!
    const card = (await page.getByTestId(`stat-${id}`).boundingBox())!
    expect(role.x).toBeGreaterThanOrEqual(card.x)
    expect(role.x + role.width).toBeLessThanOrEqual(card.x + card.width)
  }
  await page.screenshot({ path: 'test-results/screens/stats-roles.png' })
})
