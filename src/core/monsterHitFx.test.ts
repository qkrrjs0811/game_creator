import { describe, expect, test } from 'vitest'
import { MONSTER_BIT, BOSS_SLAM_TEXT, monsterHits } from './monsterHitFx'
import { MONSTERS } from './monsters'

const P = { actor: 'player', kind: 'hit' } as const
const E = { actor: 'enemy', kind: 'hit' } as const
const EM = { actor: 'enemy', kind: 'miss' } as const
const EC = { actor: 'enemy', kind: 'hit', crit: true } as const

describe('MONSTER_BIT', () => {
  test('몬스터 종마다 튀는 조각이 다 다르다', () => {
    const bits = MONSTERS.map((m) => MONSTER_BIT[m.shape])
    expect(new Set(bits).size).toBe(MONSTERS.length)
    expect(MONSTER_BIT.slime).toBe('leaf')
    expect(MONSTER_BIT.drop).toBe('droplet')
    expect(MONSTER_BIT.rock).toBe('pebble')
  })
})

describe('monsterHits', () => {
  test('몬스터가 맞힐 때만 조각이 튀고, 말랑이 차례·빗나감은 없다', () => {
    const r = monsterHits([P, E, EM, P], 'slime', false)
    expect(r[0]).toBeNull()
    expect(r[2]).toBeNull()
    expect(r[3]).toBeNull()
    expect(r[1]).toMatchObject({ bit: 'leaf', big: false, shake: 0, text: null })
    expect(r[1]!.count).toBeGreaterThan(0)
  })

  test('치명타는 조각이 더 많다', () => {
    const [n, c] = monsterHits([E, EC], 'drop', false)
    expect(c!.count).toBeGreaterThan(n!.count)
  })

  test('보통 몬스터는 화면을 흔들지 않는다', () => {
    const r = monsterHits([E, E, E, E, EC], 'rock', false)
    expect(r.every((h) => h && !h.big && h.shake === 0)).toBe(true)
  })

  test('보스는 첫 공격과 세 번째 맞힐 때마다 큰 공격으로 화면이 흔들린다', () => {
    const r = monsterHits([E, P, E, EM, E, E, E], 'king', true)
    const big = r.map((h) => h?.big ?? null)
    expect(big).toEqual([true, null, false, null, false, true, false])
    const slam = r[0]!
    expect(slam.shake).toBeGreaterThan(0)
    expect(slam.shakePx).toBeGreaterThan(0)
    expect(slam.text).toBe(BOSS_SLAM_TEXT)
    expect(slam.count).toBeGreaterThan(r[2]!.count)
  })

  test('보스의 치명타도 큰 공격이다', () => {
    const r = monsterHits([E, EC], 'king', true)
    expect(r[1]!.big).toBe(true)
  })

  test('그림만 정하고 전투 기록은 바꾸지 않는다', () => {
    const steps = [E, P, EC]
    const copy = JSON.parse(JSON.stringify(steps))
    monsterHits(steps, 'cloud', true)
    expect(steps).toEqual(copy)
  })
})
