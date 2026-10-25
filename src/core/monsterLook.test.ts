import { describe, expect, test } from 'vitest'
import { MONSTERS } from './monsters'
import { MONSTER_FACES, MONSTER_FEATURES, monsterEndFace, monsterStepFace } from './monsterLook'

describe('몬스터 실루엣 특징', () => {
  test('모든 모양이 특징을 두 개 넘게 가진다', () => {
    for (const m of MONSTERS) expect(MONSTER_FEATURES[m.shape].length).toBeGreaterThanOrEqual(2)
  })

  test('두 모양이 같은 특징을 나눠 갖지 않아 실루엣만 봐도 구별된다', () => {
    const all = Object.values(MONSTER_FEATURES).flat()
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('몬스터 표정', () => {
  test('표정은 기본·맞음·승리 셋', () => {
    expect(MONSTER_FACES).toEqual(['idle', 'hurt', 'win'])
  })

  test('말랑이에게 맞으면 맞음, 말랑이를 때리면 신난 승리 표정, 빗나가면 기본', () => {
    expect(monsterStepFace({ actor: 'player', kind: 'hit' })).toBe('hurt')
    expect(monsterStepFace({ actor: 'player', kind: 'miss' })).toBe('idle')
    expect(monsterStepFace({ actor: 'enemy', kind: 'hit' })).toBe('win')
    expect(monsterStepFace({ actor: 'enemy', kind: 'miss' })).toBe('idle')
  })

  test('말랑이가 이기면 맞음, 지면 몬스터가 승리', () => {
    expect(monsterEndFace(true)).toBe('hurt')
    expect(monsterEndFace(false)).toBe('win')
  })
})
