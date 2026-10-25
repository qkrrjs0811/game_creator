import { describe, expect, test } from 'vitest'
import { MONSTERS } from './monsters'
import { MONSTER_TOP } from './monsterLook'
import { contactAt, hitImpact } from './impact'
import { ATTACK_CEILING, MONSTER_ATTACK, MONSTER_IDLE, MONSTER_BOTTOM, attackPlan, poseY, type Pose } from './monsterMotion'

const shapes = [...new Set(MONSTERS.map((m) => m.shape))]

/** 아래끝(땅에 닿는 곳)과 머리끝의 y. 몸은 가운데(0,0)를 기준으로 늘고 줄어든다 */
const bottomOf = (p: Pose) => MONSTER_BOTTOM * p.sy + poseY(p)
const headOf = (shape: (typeof shapes)[number], p: Pose, outer = 1) => (MONSTER_TOP[shape] * p.sy + poseY(p)) * outer

describe('몬스터 가만히 움직임', () => {
  test('종마다 움직임이 다르다', () => {
    const kinds = shapes.map((s) => MONSTER_IDLE[s].kind)
    expect(new Set(kinds).size).toBe(shapes.length)
  })

  test('늘고 줄어도 발이 땅속으로 들어가지 않고, 7px보다 높이 뜨지 않는다', () => {
    for (const s of shapes) {
      const m = MONSTER_IDLE[s]
      expect(bottomOf(m.pose)).toBeLessThanOrEqual(MONSTER_BOTTOM + 0.01)
      expect(bottomOf(m.pose)).toBeGreaterThanOrEqual(MONSTER_BOTTOM - 7.01)
    }
  })

  test('정신없이 빠르지 않다(한 번 갔다 오고 쉬는 데 0.6초 넘게)', () => {
    for (const s of shapes) expect(MONSTER_IDLE[s].duration * 2 + MONSTER_IDLE[s].rest).toBeGreaterThanOrEqual(600)
  })
})

describe('몬스터 공격 동작', () => {
  test('종마다 공격 동작이 다르다', () => {
    const kinds = shapes.map((s) => MONSTER_ATTACK[s].kind)
    expect(new Set(kinds).size).toBe(shapes.length)
  })

  for (const [kind, crit, delay, final] of [['hit', false, 650, false], ['hit', true, 650, true], ['miss', false, 300, false]] as const) {
    test(`부딪히는 때를 늦추지 않는다 (${kind}${crit ? ' 치명타' : ''}, ${delay}ms${final ? ', 마지막 한 방' : ''})`, () => {
      const fx = hitImpact(kind, crit, delay, final)
      for (const s of shapes) {
        const plan = attackPlan(s, fx)
        const total = plan.reduce((t, p) => t + p.duration, 0)
        expect(total).toBe(contactAt(fx))
        for (const p of plan) expect(p.duration).toBeGreaterThanOrEqual(0)
      }
    })
  }

  test('부딪힐 때는 땅에 내려와 거의 똑바로 선다(굴러도 한 바퀴를 다 돈다)', () => {
    const fx = hitImpact('hit', false, 650)
    for (const s of shapes) {
      const end = attackPlan(s, fx).at(-1)!.pose
      expect(Math.abs(bottomOf(end) - MONSTER_BOTTOM)).toBeLessThanOrEqual(4)
      const a = ((end.angle % 360) + 540) % 360 - 180
      expect(Math.abs(a)).toBeLessThanOrEqual(30)
    }
  })

  test('뛰어올라도 머리가 위의 HP 막대에 닿지 않는다', () => {
    const fx = hitImpact('hit', true, 650, true)
    for (const s of shapes) {
      // 움츠릴 때 바깥 몸이 1.06배 커지는 것까지 친다
      for (const p of attackPlan(s, fx)) expect(headOf(s, p.pose, 1.06)).toBeGreaterThanOrEqual(ATTACK_CEILING)
    }
  })

  test('굴리기는 한 바퀴 돌고, 튀어 오르기는 가운데에서 뜬다', () => {
    const fx = hitImpact('hit', false, 650)
    const roll = shapes.find((s) => MONSTER_ATTACK[s].kind === 'roll')!
    expect(Math.abs(attackPlan(roll, fx).at(-1)!.pose.angle)).toBe(360)
    const hop = shapes.find((s) => MONSTER_ATTACK[s].kind === 'hop')!
    const lifts = attackPlan(hop, fx).map((p) => p.pose.lift)
    expect(Math.min(...lifts)).toBeLessThan(-8)
    expect(lifts.at(-1)).toBe(0)
  })
})
