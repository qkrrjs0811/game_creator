import { describe, expect, test } from 'vitest'
import type { MonsterShape } from './monsters'
import { MONSTER_TOP } from './monsterLook'
import { MONSTER_DECORS, MONSTER_DECOR_SPOTS, monsterChapter, monsterDecor } from './monsterDecor'
import { stageMonster } from './endless'

const shapes: MonsterShape[] = ['slime', 'mushroom', 'drop', 'cloud', 'rock', 'king']

describe('장마다 늘어나는 몬스터 무늬·장식', () => {
  test('1장은 장식 없이 기본 모습이다', () => {
    expect(monsterDecor(1)).toEqual([])
  })

  test('장이 올라가면 앞 장의 장식을 그대로 두고 하나씩 더한다', () => {
    for (let c = 1; c < 12; c++) {
      const now = monsterDecor(c)
      const next = monsterDecor(c + 1)
      expect(next.slice(0, now.length)).toEqual(now)
      expect(next.length).toBeGreaterThanOrEqual(now.length)
    }
    expect(monsterDecor(2).length).toBe(1)
    expect(monsterDecor(5)).toEqual(MONSTER_DECORS)
  })

  test('장식은 모두 갖춘 뒤로 더 늘지 않는다(몸이 장식에 묻히지 않게)', () => {
    expect(monsterDecor(40)).toEqual(MONSTER_DECORS)
    expect(MONSTER_DECORS.length).toBeLessThanOrEqual(4)
  })

  test('틀린 장 번호는 1장으로 본다', () => {
    for (const c of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) expect(monsterDecor(c)).toEqual([])
    expect(monsterDecor(3.7)).toEqual(monsterDecor(3))
  })

  test('장식 자리는 몬스터 머리끝과 발끝 사이라 HP 막대·땅을 넘지 않는다', () => {
    for (const s of shapes) {
      for (const d of MONSTER_DECORS) {
        const spots = MONSTER_DECOR_SPOTS[s][d]
        expect(spots.length).toBeGreaterThan(0)
        for (const [x, y] of spots) {
          expect(y).toBeGreaterThanOrEqual(MONSTER_TOP[s])
          expect(y).toBeLessThanOrEqual(24)
          expect(Math.abs(x)).toBeLessThanOrEqual(54)
        }
      }
    }
  })

  test('스테이지 몬스터는 자기 장 번호를 안다', () => {
    expect(monsterChapter(stageMonster(1))).toBe(1)
    expect(monsterChapter(stageMonster(10))).toBe(1)
    expect(monsterChapter(stageMonster(11))).toBe(2)
    expect(monsterChapter(stageMonster(47))).toBe(5)
    expect(monsterDecor(monsterChapter(stageMonster(23)))).toEqual(monsterDecor(3))
  })
})
