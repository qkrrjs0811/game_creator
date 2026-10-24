import { describe, test, expect } from 'vitest'
import { likelyWin, minutesToWin, nextStageAdvice } from './coach'
import { playerFighter } from './battle'
import { stageEnemy } from './monsters'
import { statsFromMinutes } from './progression'

const me = (minutes: number, skills: string[] = []) => playerFighter(statsFromMinutes({ exercise: minutes }), skills)

describe('statsFromMinutes', () => {
  test('운동 10분마다 힘·체력이 1 오른다(computeProgress와 같은 값)', () => {
    expect(statsFromMinutes({ exercise: 0 })).toEqual({ str: 5, vit: 5, int: 5 })
    expect(statsFromMinutes({ exercise: 37 })).toEqual({ str: 8, vit: 8, int: 5 })
  })
})

describe('minutesToWin', () => {
  test('지금도 이길 만하면 0', () => {
    expect(likelyWin(me(0), stageEnemy(1))).toBe(true)
    expect(minutesToWin({ exercise: 0 }, [], stageEnemy(1))).toBe(0)
  })

  test('모자라면 이길 만해지는 가장 적은 운동 분을 돌려준다', () => {
    const m = minutesToWin({ exercise: 0 }, [], stageEnemy(2))!
    expect(m).toBeGreaterThan(0)
    expect(likelyWin(me(m), stageEnemy(2))).toBe(true)
    // 능력치가 한 단계 덜 오른 때는 아직 이길 만하지 않다
    expect(likelyWin(me(m - 10), stageEnemy(2))).toBe(false)
  })

  test('능력치가 오르는 순간에 맞춰 센다(이미 한 분은 빼고)', () => {
    const m = minutesToWin({ exercise: 37 }, [], stageEnemy(3))!
    expect(m).toBeGreaterThan(0)
    expect((37 + m) % 10).toBe(0)
    expect(likelyWin(me(37 + m), stageEnemy(3))).toBe(true)
    expect(likelyWin(me(37 + m - 10), stageEnemy(3))).toBe(false)
  })

  test('배운 스킬도 함께 센다', () => {
    const plain = minutesToWin({ exercise: 0 }, [], stageEnemy(4))!
    const punch = minutesToWin({ exercise: 0 }, ['punch', 'punch', 'punch'], stageEnemy(4))!
    expect(punch).toBeLessThan(plain)
  })

  test('찾는 범위 안에서 못 이기면 null', () => {
    expect(minutesToWin({ exercise: 0 }, [], stageEnemy(6), 30)).toBeNull()
  })
})

describe('nextStageAdvice', () => {
  test('다음에 깰 스테이지와 운동 몇 분 더 하면 이길 만한지', () => {
    expect(nextStageAdvice({ exercise: 0 }, [], 0)).toEqual({ no: 1, toWin: 0 })
    expect(nextStageAdvice({ exercise: 0 }, [], 1)).toEqual({ no: 2, toWin: minutesToWin({ exercise: 0 }, [], stageEnemy(2)) })
  })

  test('모든 스테이지를 깼으면 없음', () => {
    expect(nextStageAdvice({ exercise: 0 }, [], 6)).toBeNull()
  })
})
