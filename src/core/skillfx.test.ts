import { describe, expect, test } from 'vitest'
import { hitImpact, impactLength } from './impact'
import { SKILL_FX, skillFxSize, skillFxTiming, skillStyle, stepSkillFx, type SkillStyle } from './skillfx'

const base = { str: 5, vit: 5, int: 5, focus: 5 }
const none = skillStyle(base, [])
const all = skillStyle({ ...base, int: 25, focus: 25 }, ['punch', 'punch', 'tough', 'quick'])

describe('skillStyle', () => {
  test('배운 스킬 단계와 회피가 어디서 오는지 센다', () => {
    expect(all).toEqual({ punch: 2, tough: 1, quick: 1, quickDodge: 0.05, focusDodge: 0.2 })
    expect(none).toEqual({ punch: 0, tough: 0, quick: 0, quickDodge: 0, focusDodge: 0 })
    // 집중 회피는 20%까지다
    expect(skillStyle({ ...base, focus: 500 }, []).focusDodge).toBe(0.2)
  })
})

describe('stepSkillFx', () => {
  test('스킬이 없으면 지능 치명타 번개만 보인다', () => {
    expect(stepSkillFx({ actor: 'player', kind: 'hit' }, none, 0)).toEqual([])
    expect(stepSkillFx({ actor: 'player', kind: 'hit', crit: true }, none, 0)).toEqual(['bolt'])
    expect(stepSkillFx({ actor: 'enemy', kind: 'hit' }, none, 0)).toEqual([])
  })

  test('말랑이가 때리면 펀치는 주먹 궤적, 날쌘 발은 잔상, 치명타는 번개', () => {
    expect(stepSkillFx({ actor: 'player', kind: 'hit', crit: true }, all, 0)).toEqual(['dash', 'fist', 'bolt'])
    expect(stepSkillFx({ actor: 'player', kind: 'hit' }, skillStyle(base, ['punch']), 0)).toEqual(['fist'])
    // 빗나가도 날쌘 발 잔상은 남고 주먹 궤적은 없다
    expect(stepSkillFx({ actor: 'player', kind: 'miss' }, all, 0)).toEqual(['dash'])
  })

  test('맞으면 단단한 몸이 방패로 반짝인다', () => {
    expect(stepSkillFx({ actor: 'enemy', kind: 'hit' }, all, 0)).toEqual(['shield'])
    expect(stepSkillFx({ actor: 'enemy', kind: 'hit' }, skillStyle(base, ['quick']), 0)).toEqual([])
  })

  test('피하면 회피가 온 곳(날쌘 발·집중)의 잔상이 보인다', () => {
    expect(stepSkillFx({ actor: 'enemy', kind: 'miss' }, skillStyle(base, ['quick']), 3)).toEqual(['blur'])
    expect(stepSkillFx({ actor: 'enemy', kind: 'miss' }, skillStyle({ ...base, focus: 15 }, []), 3)).toEqual(['calm'])
    expect(stepSkillFx({ actor: 'enemy', kind: 'miss' }, none, 3)).toEqual([])
  })

  test('둘 다 있으면 회피 몫만큼 나눠 보이고, 같은 걸음은 늘 같다', () => {
    const picks = Array.from({ length: 100 }, (_, i) => stepSkillFx({ actor: 'enemy', kind: 'miss' }, all, i)[0])
    const blur = picks.filter((p) => p === 'blur').length
    // 날쌘 발 0.05 : 집중 0.2 → 약 20%
    expect(blur).toBeGreaterThan(10)
    expect(blur).toBeLessThan(30)
    expect(picks.filter((p) => p === 'calm').length).toBe(100 - blur)
    expect(stepSkillFx({ actor: 'enemy', kind: 'miss' }, all, 7)).toEqual(stepSkillFx({ actor: 'enemy', kind: 'miss' }, all, 7))
  })
})

describe('skillFxSize', () => {
  test('단계가 오를수록 조금씩 커지고 1.5배를 넘지 않는다', () => {
    expect(skillFxSize(1)).toBe(1)
    expect(skillFxSize(3)).toBeGreaterThan(skillFxSize(2))
    expect(skillFxSize(50)).toBe(1.5)
    expect(skillFxSize(0)).toBe(1)
  })
})

describe('skillFxTiming', () => {
  test('모든 스킬 연출은 그 걸음의 타격 연출 안에 끝나 다음 걸음과 겹치지 않는다', () => {
    const style: SkillStyle = all
    for (const delay of [250, 350, 400, 600, 800]) {
      for (const kind of ['hit', 'miss'] as const) {
        for (const crit of [false, true]) {
          for (const final of [false, true]) {
            const fx = hitImpact(kind, crit, delay, final)
            for (const actor of ['player', 'enemy'] as const) {
              for (const k of stepSkillFx({ actor, kind, crit }, style, 0)) {
                const t = skillFxTiming(k, fx)
                expect(t.start).toBeGreaterThanOrEqual(0)
                expect(t.duration).toBeGreaterThan(0)
                expect(t.start + t.duration).toBeLessThanOrEqual(impactLength(fx))
              }
            }
          }
        }
      }
    }
  })

  test('주먹·잔상은 튀어 나갈 때, 번개는 부딪히는 순간에 닿고, 방패·회피 잔상은 부딪힐 때 시작한다', () => {
    const fx = hitImpact('hit', true, 600)
    const contact = fx.windup + fx.lunge
    expect(skillFxTiming('fist', fx).start).toBe(fx.windup)
    expect(skillFxTiming('dash', fx).start).toBe(fx.windup)
    expect(skillFxTiming('bolt', fx).start).toBeLessThan(contact)
    expect(skillFxTiming('shield', fx).start).toBe(contact)
    const miss = hitImpact('miss', false, 600)
    expect(skillFxTiming('blur', miss).start).toBe(miss.windup + miss.lunge)
    expect(skillFxTiming('calm', miss).start).toBe(miss.windup + miss.lunge)
  })

  test('연출 6종 모두 이름이 있다', () => {
    expect(Object.keys(SKILL_FX).sort()).toEqual(['blur', 'bolt', 'calm', 'dash', 'fist', 'shield'])
  })
})
