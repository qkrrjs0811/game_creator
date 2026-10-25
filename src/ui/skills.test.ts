import { expect, test } from 'vitest'
import { objectParticle, rewardsHtml } from './skills'
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
