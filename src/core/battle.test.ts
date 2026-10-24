import { describe, test, expect } from 'vitest'
import { MAX_ROUNDS, enemyDamagePercent, playerFighter, simulateBattle, type Fighter } from './battle'
import { BASE_STAT } from './progression'

const base = { str: BASE_STAT, vit: BASE_STAT, int: BASE_STAT }
const slime: Fighter = { name: '슬라임', hp: 20, atk: 4, def: 0, spd: 3, dodge: 0 }
const giant: Fighter = { name: '거인', hp: 999, atk: 99, def: 99, spd: 99, dodge: 0 }

describe('playerFighter', () => {
  test('힘은 공격, 체력은 HP와 방어가 된다', () => {
    const weak = playerFighter(base, [])
    const strong = playerFighter({ str: 15, vit: 15, int: 5 }, [])
    expect(strong.atk).toBeGreaterThan(weak.atk)
    expect(strong.hp).toBeGreaterThan(weak.hp)
    expect(strong.def).toBeGreaterThan(weak.def)
  })

  test('스킬 단계마다 효과가 붙는다', () => {
    const none = playerFighter(base, [])
    expect(playerFighter(base, ['punch']).atk).toBeGreaterThan(none.atk)
    expect(playerFighter(base, ['punch', 'punch']).atk).toBeGreaterThan(playerFighter(base, ['punch']).atk)
    expect(playerFighter(base, ['tough']).def).toBeGreaterThan(none.def)
    const quick = playerFighter(base, ['quick'])
    expect(quick.spd).toBeGreaterThan(none.spd)
    expect(quick.dodge).toBeGreaterThan(none.dodge)
  })

  test('회피는 아무리 배워도 절반을 넘지 않는다', () => {
    expect(playerFighter(base, Array(50).fill('quick')).dodge).toBeLessThanOrEqual(0.5)
  })

  test('모르는 스킬 이름은 효과가 없다', () => {
    expect(playerFighter(base, ['fly'])).toEqual(playerFighter(base, []))
  })
})

describe('simulateBattle', () => {
  test('같은 입력과 씨앗이면 같은 결과', () => {
    const me = playerFighter(base, ['quick'])
    expect(simulateBattle(me, slime, 7)).toEqual(simulateBattle(me, slime, 7))
  })

  test('훨씬 강하면 이기고, 훨씬 약하면 진다', () => {
    const me = playerFighter({ str: 30, vit: 30, int: 5 }, [])
    expect(simulateBattle(me, slime, 1).win).toBe(true)
    expect(simulateBattle(playerFighter(base, []), giant, 1).win).toBe(false)
  })

  test('기록의 HP는 줄어들기만 하고, 끝난 쪽 HP는 0', () => {
    const me = playerFighter(base, [])
    const r = simulateBattle(me, slime, 3)
    expect(r.log.length).toBeGreaterThan(0)
    let hp = { player: me.hp, enemy: slime.hp }
    for (const e of r.log) {
      const target = e.actor === 'player' ? 'enemy' : 'player'
      if (e.kind === 'miss') expect(e.damage).toBe(0)
      else expect(e.damage).toBeGreaterThanOrEqual(1)
      expect(e.targetHp).toBe(Math.max(0, hp[target] - e.damage))
      hp = { ...hp, [target]: e.targetHp }
    }
    expect(r.playerHp).toBe(hp.player)
    expect(r.enemyHp).toBe(hp.enemy)
    expect(r.win ? r.enemyHp : r.playerHp).toBe(0)
  })

  test('빠른 쪽이 먼저 움직이고, 같으면 말랑이가 먼저', () => {
    const me = playerFighter(base, [])
    expect(simulateBattle(me, { ...slime, spd: me.spd + 1 }, 1).log[0].actor).toBe('enemy')
    expect(simulateBattle(me, { ...slime, spd: me.spd }, 1).log[0].actor).toBe('player')
  })

  test('서로 못 쓰러뜨려도 끝나고, 그러면 진 것으로 본다', () => {
    const wall: Fighter = { name: '벽', hp: 100000, atk: 0, def: 0, spd: 1, dodge: 0 }
    const me = { ...playerFighter(base, []), hp: 100000 }
    const r = simulateBattle(me, wall, 1)
    expect(r.win).toBe(false)
    expect(r.rounds).toBe(MAX_ROUNDS)
  })

  test('입력을 바꾸지 않고, 성장 값(경험치·능력치)을 내지 않는다', () => {
    const me = playerFighter(base, ['punch'])
    const before = JSON.stringify([me, slime])
    const r = simulateBattle(me, slime, 5)
    expect(JSON.stringify([me, slime])).toBe(before)
    expect(Object.keys(r).sort()).toEqual(['enemyHp', 'log', 'playerHp', 'rounds', 'win'])
  })
})

describe('enemyDamagePercent', () => {
  const lost = (enemyHp: number) => ({ win: false, rounds: 3, playerHp: 0, enemyHp, log: [] })

  test('몬스터 처음 HP에 대해 깎은 비율을 내림한 퍼센트로 돌려준다', () => {
    expect(enemyDamagePercent(slime, lost(13))).toBe(35)
  })

  test('지면 조금이라도 깎았으면 1 이상, 다 깎지 못했으면 99 이하', () => {
    const big: Fighter = { ...slime, hp: 1000 }
    expect(enemyDamagePercent(big, lost(999))).toBe(1)
    expect(enemyDamagePercent(big, lost(1))).toBe(99)
    expect(enemyDamagePercent(big, lost(1000))).toBe(0)
  })

  test('이기면 100', () => {
    const r = simulateBattle(playerFighter(base, []), slime, 1)
    expect(r.win).toBe(true)
    expect(enemyDamagePercent(slime, r)).toBe(100)
  })

  test('강해질수록 같은 몬스터를 더 많이 깎는다', () => {
    const tough: Fighter = { ...giant, atk: 30, def: 0 }
    const weak = enemyDamagePercent(tough, simulateBattle(playerFighter(base, []), tough, 7))
    const strong = enemyDamagePercent(tough, simulateBattle(playerFighter({ str: 40, vit: 40, int: 5 }, []), tough, 7))
    expect(strong).toBeGreaterThan(weak)
  })
})
