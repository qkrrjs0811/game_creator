import { describe, test, expect } from 'vitest'
import { playerFighter, simulateBattle, type Fighter } from './battle'
import { freshFighter } from './difficulty'
import { stageEnemy, stageMonsterLook } from './endless'
import { BASE_STAT } from './progression'
import { TRAITS, shapeTrait, stageTrait, traitLabel, weakHitText, weaknessHint } from './traits'

const base = { str: 30, vit: 30, int: BASE_STAT, focus: BASE_STAT }
const seeds = Array.from({ length: 40 }, (_, i) => i + 1)

describe('몬스터 성격', () => {
  test('모양마다 성격이 정해진다: 말랑은 무난, 뽀짝·꿍은 단단함, 퐁·뭉게는 날쌤', () => {
    expect(shapeTrait('slime', 1)).toBe('plain')
    expect(shapeTrait('mushroom', 1)).toBe('sturdy')
    expect(shapeTrait('rock', 3)).toBe('sturdy')
    expect(shapeTrait('drop', 1)).toBe('swift')
    expect(shapeTrait('cloud', 2)).toBe('swift')
  })

  test('보스는 홀수 장이면 단단함, 짝수 장이면 날쌤', () => {
    expect(stageTrait(10)).toBe('sturdy')
    expect(stageTrait(20)).toBe('swift')
    expect(stageTrait(30)).toBe('sturdy')
  })

  test('스테이지 성격은 그 몬스터 모양을 따르고, 상대 전투 값에도 붙는다', () => {
    for (const no of [1, 2, 3, 4, 5, 6, 9, 10, 13, 20, 27]) {
      expect(stageTrait(no)).toBe(shapeTrait(stageMonsterLook(no).shape, Math.ceil(no / 10)))
      expect(stageEnemy(no).trait).toBe(stageTrait(no))
    }
  })

  test('성격마다 이름·약점 능력치·약점 활동이 있고, 무난함은 약점이 없다', () => {
    expect(TRAITS.plain.weakness).toBeNull()
    expect(TRAITS.sturdy).toMatchObject({ name: '단단함', weakness: 'int', activity: 'study' })
    expect(TRAITS.swift).toMatchObject({ name: '날쌤', weakness: 'focus', activity: 'reading' })
  })

  test('힌트 글: 약점이 있으면 "약점: 지능", 없으면 null', () => {
    expect(weaknessHint('sturdy')).toBe('약점: 🧠 지능')
    expect(weaknessHint('swift')).toBe('약점: 🎯 집중')
    expect(weaknessHint('plain')).toBeNull()
  })

  test('지도·홈에 붙는 이름표: 성격과 약점을 함께, 무난함은 붙이지 않는다', () => {
    expect(traitLabel('sturdy')).toBe('🪨 단단함 · 약점: 🧠 지능')
    expect(traitLabel('swift')).toBe('💨 날쌤 · 약점: 🎯 집중')
    expect(traitLabel('plain')).toBeNull()
  })
})

describe('약점이 전투에서 하는 일', () => {
  test('운동만 한 말랑이는 성격이 있어도 예전과 같은 전투(같은 씨앗)', () => {
    for (const no of [2, 3, 5, 10, 20]) {
      const me = freshFighter(300)
      const enemy = stageEnemy(no)
      const { trait: _t, ...plain } = enemy
      for (const seed of [1, 7, 13]) expect(simulateBattle(me, enemy, seed)).toEqual(simulateBattle(me, plain, seed))
    }
  })

  test('날쌘 몬스터는 집중이 높은 말랑이의 공격을 덜 피한다', () => {
    const swift: Fighter = { name: '퐁', hp: 3000, atk: 30, def: 5, spd: 1, dodge: 0.2, trait: 'swift' }
    const me = playerFighter({ ...base, focus: 25 }, [])
    const misses = (enemy: Fighter) =>
      seeds.reduce((sum, s) => sum + simulateBattle(me, enemy, s).log.filter((e) => e.actor === 'player' && e.kind === 'miss').length, 0)
    expect(misses(swift)).toBeLessThan(misses({ ...swift, trait: 'plain' }))
  })

  test('집중이 높아도 날쌘 몬스터의 회피는 0 아래로 가지 않는다(모두 맞힘)', () => {
    const swift: Fighter = { name: '퐁', hp: 3000, atk: 30, def: 5, spd: 1, dodge: 0.05, trait: 'swift' }
    const me = playerFighter({ ...base, focus: 500 }, [])
    const r = simulateBattle(me, swift, 3)
    expect(r.log.filter((e) => e.actor === 'player' && e.kind === 'miss')).toHaveLength(0)
  })

  test('단단한 몬스터에게 지능 치명타는 방어를 반만 받아 더 아프고, 기록에 표시된다', () => {
    const sturdy: Fighter = { name: '꿍', hp: 5000, atk: 1, def: 20, spd: 1, dodge: 0, trait: 'sturdy' }
    const me: Fighter = { ...playerFighter({ ...base, int: 35 }, []), crit: 1 }
    const pierced = simulateBattle(me, sturdy, 1).log[0]
    const plain = simulateBattle(me, { ...sturdy, trait: 'plain' }, 1).log[0]
    expect(pierced).toMatchObject({ crit: true, pierce: true })
    expect(plain.pierce).toBeUndefined()
    expect(pierced.damage).toBeGreaterThan(plain.damage)
  })

  test('치명타가 아닌 공격은 단단한 몬스터에게도 그대로다', () => {
    const sturdy: Fighter = { name: '꿍', hp: 5000, atk: 1, def: 20, spd: 1, dodge: 0, trait: 'sturdy' }
    const me = playerFighter(base, [])
    expect(simulateBattle(me, sturdy, 5)).toEqual(simulateBattle(me, { ...sturdy, trait: 'plain' }, 5))
  })

  test('약점 능력치를 키운 말랑이는 그 성격 몬스터를 더 많이 깎는다(같은 능력치 합)', () => {
    const sturdy: Fighter = { name: '꿍', hp: 5000, atk: 40, def: 25, spd: 1, dodge: 0, trait: 'sturdy' }
    const left = (enemy: Fighter) => {
      const me = playerFighter({ ...base, int: 35 }, ['punch'])
      return seeds.reduce((sum, s) => sum + simulateBattle(me, enemy, s).enemyHp, 0)
    }
    expect(left(sturdy)).toBeLessThan(left({ ...sturdy, trait: 'plain' }))
  })

  test('집중이 없었다면 피했을 공격을 맞혔을 때만 기록에 명중이 붙는다', () => {
    const swift: Fighter = { name: '퐁', hp: 3000, atk: 30, def: 5, spd: 1, dodge: 0.2, trait: 'swift' }
    const me = playerFighter({ ...base, focus: 25 }, [])
    const hits = (enemy: Fighter) =>
      seeds.flatMap((s) => simulateBattle(me, enemy, s).log).filter((e) => e.actor === 'player' && e.kind === 'hit')
    const aimed = hits(swift).filter((e) => e.aimed)
    expect(aimed.length).toBeGreaterThan(0)
    expect(hits(swift).length).toBeGreaterThan(hits({ ...swift, trait: 'plain' }).length)
    expect(hits({ ...swift, trait: 'plain' }).some((e) => e.aimed)).toBe(false)
    // 집중이 없으면 명중도 없다
    const calmless = playerFighter(base, [])
    expect(seeds.some((s) => simulateBattle(calmless, swift, s).log.some((e) => e.aimed))).toBe(false)
  })
})

describe('약점 글자', () => {
  test('방어를 뚫은 치명타는 "약점!", 집중으로 맞힌 공격은 "명중!"', () => {
    expect(weakHitText({ kind: 'hit', damage: 31, crit: true, pierce: true })).toBe('약점! -31')
    expect(weakHitText({ kind: 'hit', damage: 9, aimed: true })).toBe('명중! -9')
  })

  test('보통 공격·치명타·빗나감에는 붙지 않는다', () => {
    expect(weakHitText({ kind: 'hit', damage: 9 })).toBeNull()
    expect(weakHitText({ kind: 'hit', damage: 14, crit: true })).toBeNull()
    expect(weakHitText({ kind: 'miss', damage: 0 })).toBeNull()
  })
})
