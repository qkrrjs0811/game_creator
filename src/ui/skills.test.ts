import { expect, test } from 'vitest'
import { bestWeekRange, bestsHtml, objectParticle, rewardsHtml } from './skills'
import type { UpcomingReward } from '../core/rewards'

test('받침에 맞는 을/를', () => {
  expect(objectParticle('단단한 몸')).toBe('을')
  expect(objectParticle('날쌘 발')).toBe('을')
  expect(objectParticle('말랑 펀치')).toBe('를')
})

test('곧 받을 보상 칸: 아이콘·이름·남은 양·진행 막대를 가까운 3개만', () => {
  const r = (kind: UpcomingReward['kind'], ratio: number): UpcomingReward => ({
    kind,
    icon: '🎩',
    name: `${kind} 모자`,
    value: 1,
    goal: 4,
    need: '도장 3개 더',
    ratio,
  })
  const html = rewardsHtml([r('stamp', 0.75), r('mission', 0.5), r('week', 0.25), r('growth', 0.1)])
  expect(html.match(/<li/g)).toHaveLength(3)
  expect(html).toContain('data-testid="reward-stamp"')
  expect(html).toContain('stamp 모자')
  expect(html).toContain('도장 3개 더')
  expect(html).toContain('width:75.0%')
  expect(html).not.toContain('growth')
  expect(rewardsHtml([])).toBe('')
})

test('내 최고 기록 칸: 활동별 한 번 최고, 하루·주 최고와 날짜, 가장 길게 이어 온 날', () => {
  const html = bestsHtml({
    session: { exercise: 45, study: 0, reading: 70, relax: 15 },
    day: { key: '2026-10-21', minutes: 130 },
    week: { key: '2026-10-26', minutes: 305 },
    streak: 12,
  })
  expect(html).toContain('data-testid="best-session-exercise"')
  expect(html).toMatch(/운동 <b>45분<\/b>/)
  expect(html).toMatch(/독서 <b>1시간 10분<\/b>/)
  expect(html).toMatch(/공부 <b>아직<\/b>/)
  expect(html).toContain('10월 21일')
  expect(html).toContain('2시간 10분')
  // 주는 월~일 날짜로, 달이 넘어가면 달을 다시 적는다
  expect(html).toContain('10월 26일~11월 1일')
  expect(html).toContain('5시간 5분')
  expect(html).toContain('12일')
  expect(bestWeekRange('2026-10-19')).toBe('10월 19일~25일')
})
