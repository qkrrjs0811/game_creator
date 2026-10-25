import { describe, test, expect } from 'vitest'
import { likelyWin, minutesToWin, nextStageAdvice, stageMinutesToWin } from './coach'
import { playerFighter } from './battle'
import { stageEnemy, targetMinutes } from './endless'
import { statsFromMinutes } from './progression'

const me = (minutes: number, skills: string[] = []) => playerFighter(statsFromMinutes({ exercise: minutes }), skills)

describe('statsFromMinutes', () => {
  test('운동 10분마다 힘·체력이 1 오른다(computeProgress와 같은 값)', () => {
    expect(statsFromMinutes({ exercise: 0 })).toEqual({ str: 5, vit: 5, int: 5, focus: 5 })
    expect(statsFromMinutes({ exercise: 37 })).toEqual({ str: 8, vit: 8, int: 5, focus: 5 })
  })
})

describe('minutesToWin', () => {
  test('지금도 이길 만하면 0', () => {
    expect(likelyWin(me(0), stageEnemy(1))).toBe(true)
    expect(minutesToWin({ exercise: 0 }, [], stageEnemy(1))).toBe(0)
  })

  test('모자라면 이길 만해지는 가장 적은 운동 분을 돌려준다', () => {
    const m = minutesToWin({ exercise: 0 }, [], stageEnemy(3))!
    expect(m).toBeGreaterThan(0)
    expect(likelyWin(me(m), stageEnemy(3))).toBe(true)
    // 능력치가 한 단계 덜 오른 때는 아직 이길 만하지 않다
    expect(likelyWin(me(m - 10), stageEnemy(3))).toBe(false)
  })

  test('능력치가 오르는 순간에 맞춰 센다(이미 한 분은 빼고)', () => {
    const m = minutesToWin({ exercise: 37 }, [], stageEnemy(6))!
    expect(m).toBeGreaterThan(0)
    expect((37 + m) % 10).toBe(0)
    expect(likelyWin(me(37 + m), stageEnemy(6))).toBe(true)
    expect(likelyWin(me(37 + m - 10), stageEnemy(6))).toBe(false)
  })

  test('배운 스킬도 함께 센다', () => {
    const plain = minutesToWin({ exercise: 0 }, [], stageEnemy(8))!
    const punch = minutesToWin({ exercise: 0 }, ['punch', 'punch', 'punch'], stageEnemy(8))!
    expect(punch).toBeLessThan(plain)
  })

  test('찾는 범위 안에서 못 이기면 null', () => {
    expect(minutesToWin({ exercise: 0 }, [], stageEnemy(10), 30)).toBeNull()
  })
})

describe('stageMinutesToWin', () => {
  test('스테이지 번호로 센다', () => {
    expect(stageMinutesToWin({ exercise: 0 }, [], 1)).toBe(0)
    expect(stageMinutesToWin({ exercise: 0 }, [], 3)).toBe(minutesToWin({ exercise: 0 }, [], stageEnemy(3)))
  })

  test('먼 장의 스테이지도 찾는 범위가 모자라지 않는다', () => {
    // 200스테이지는 처음부터 운동만 해도 약 260시간이 걸린다(기본 찾는 범위 100시간보다 길다)
    expect(targetMinutes(200)).toBeGreaterThan(6000)
    const m = stageMinutesToWin({ exercise: 0 }, [], 200)
    expect(m).not.toBeNull()
    expect(m!).toBeGreaterThan(6000)
  })
})

describe('nextStageAdvice', () => {
  test('다음에 깰 스테이지와 운동 몇 분 더 하면 이길 만한지', () => {
    expect(nextStageAdvice({ exercise: 0 }, [], 0)).toEqual({ no: 1, toWin: 0 })
    expect(nextStageAdvice({ exercise: 0 }, [], 2)).toEqual({ no: 3, toWin: minutesToWin({ exercise: 0 }, [], stageEnemy(3)) })
  })

  test('스테이지는 끝이 없어 보스를 깨도 다음 장 스테이지를 알려 준다', () => {
    expect(nextStageAdvice({ exercise: 0 }, [], 10)!.no).toBe(11)
  })
})
