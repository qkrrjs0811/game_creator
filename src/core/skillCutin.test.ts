import { describe, expect, test } from 'vitest'
import { SKILL_CUTIN_NAME, skillCutinTiming, skillDebuts } from './skillCutin'
import { skillStyle } from './skillfx'
import { stepDelay, autoStepDelay } from './replay'

const base = { str: 5, vit: 5, int: 5, focus: 5 }
const all = skillStyle(base, ['punch', 'tough', 'quick'])
const P = { actor: 'player', kind: 'hit' } as const
const PM = { actor: 'player', kind: 'miss' } as const
const E = { actor: 'enemy', kind: 'hit' } as const
const EM = { actor: 'enemy', kind: 'miss' } as const

describe('skillDebuts', () => {
  test('스킬이 없으면 발동 장면이 없다', () => {
    expect(skillDebuts([P, E, P, E], skillStyle(base, []))).toEqual([null, null, null, null])
  })

  test('배운 스킬이 그 전투에서 처음 나갈 때 한 번만 장면이 나온다', () => {
    // 첫 공격에 펀치와 날쌘 발이 함께 나가면 펀치 먼저, 날쌘 발은 다음 공격에
    expect(skillDebuts([P, E, P, E, P], all)).toEqual(['punch', 'tough', 'quick', null, null])
  })

  test('빗나간 공격엔 펀치가 안 나가고, 맞지 않으면 단단한 몸도 안 나간다', () => {
    const quickOnly = skillStyle(base, ['quick', 'tough'])
    expect(skillDebuts([PM, EM, E], quickOnly)).toEqual(['quick', null, 'tough'])
    expect(skillDebuts([PM, P], skillStyle(base, ['punch']))).toEqual([null, 'punch'])
  })

  test('날쌘 발 회피로 처음 나가도 날쌘 발 장면이다', () => {
    const style = { ...skillStyle(base, ['quick']), quick: 1 }
    // 몬스터 차례 회피가 먼저 오면 그때 나온다
    expect(skillDebuts([EM, P], { ...style, focusDodge: 0 })).toEqual(['quick', null])
  })

  test('이름은 스킬 이름 그대로다', () => {
    expect(SKILL_CUTIN_NAME).toEqual({ punch: '👊 말랑 펀치!', tough: '🛡️ 단단한 몸!', quick: '💨 날쌘 발!' })
  })
})

describe('skillCutinTiming', () => {
  test('어두워짐·띠·밝아짐이 다음 걸음 전에 모두 끝난다', () => {
    for (const d of [stepDelay(1), stepDelay(12), stepDelay(40), autoStepDelay(4), autoStepDelay(40)]) {
      const t = skillCutinTiming(d)
      expect(t.dim + t.hold + t.fade).toBeLessThan(d)
      expect(t.dim).toBeGreaterThan(0)
      expect(t.hold).toBeGreaterThan(t.dim)
      expect(t.fade).toBeGreaterThan(0)
    }
  })

  test('어둡기는 살짝만(화면이 보이도록)', () => {
    const t = skillCutinTiming(600)
    expect(t.dimAlpha).toBeGreaterThan(0.2)
    expect(t.dimAlpha).toBeLessThan(0.5)
  })
})
