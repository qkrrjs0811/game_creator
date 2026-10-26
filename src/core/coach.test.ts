import { describe, test, expect } from 'vitest'
import { WINNABLE_MAX, likelyWin, minutesToWin, nextStageAdvice, stageMinutesToWin, weakActivityAdvice, winnableStages } from './coach'
import { TRAITS, stageTrait } from './traits'
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

describe('winnableStages', () => {
  const wins = (minutes: number, no: number) => likelyWin(me(minutes), stageEnemy(no))

  test('다음 스테이지부터 줄줄이 이길 만한 스테이지 수를 센다', () => {
    for (const [minutes, progress] of [[0, 0], [40, 0], [300, 2], [900, 5]]) {
      const n = winnableStages({ exercise: minutes }, [], progress)
      for (let no = progress + 1; no <= progress + n; no++) expect(wins(minutes, no)).toBe(true)
      if (n < WINNABLE_MAX) expect(wins(minutes, progress + n + 1)).toBe(false)
    }
    expect(winnableStages({ exercise: 0 }, [], 0)).toBeGreaterThanOrEqual(1)
  })

  test('다음 스테이지를 아직 못 이기면 0', () => {
    expect(minutesToWin({ exercise: 0 }, [], stageEnemy(5))).toBeGreaterThan(0)
    expect(winnableStages({ exercise: 0 }, [], 4)).toBe(0)
  })

  test('아주 많이 키웠어도 WINNABLE_MAX까지만 센다', () => {
    expect(winnableStages({ exercise: 200_000 }, [], 0)).toBe(WINNABLE_MAX)
  })
})

describe('weakActivityAdvice', () => {
  // 운동 분과 약점 활동 분을 견줘 볼 스테이지들(1~2장)
  const stages = Array.from({ length: 19 }, (_, i) => i + 2)

  test('약점 활동이 운동보다 짧을 때만 그 활동과 분을 알려 준다', () => {
    let found = 0
    for (const no of stages) {
      const ex = stageMinutesToWin({ exercise: 0 }, [], no)
      const a = weakActivityAdvice({ exercise: 0 }, [], no, ex)
      if (!a) continue
      found++
      expect(a.activity).toBe(TRAITS[stageTrait(no)].activity)
      expect(a.minutes).toBeGreaterThan(0)
      if (ex !== null) expect(a.minutes).toBeLessThan(ex)
      // 약점 활동을 그만큼 하면 정말 이길 만하다
      const stats = statsFromMinutes({ exercise: 0, [a.activity]: a.minutes })
      expect(likelyWin(playerFighter(stats, []), stageEnemy(no))).toBe(true)
    }
    expect(found).toBeGreaterThan(0)
  })

  test('무난한 몬스터·지금도 이길 만할 때는 알려 주지 않는다', () => {
    const plain = stages.find((no) => stageTrait(no) === 'plain')!
    expect(weakActivityAdvice({ exercise: 0 }, [], plain, stageMinutesToWin({ exercise: 0 }, [], plain))).toBeNull()
    expect(weakActivityAdvice({ exercise: 0 }, [], 1, 0)).toBeNull()
  })

  test('약점 활동이 운동보다 짧지 않으면 알려 주지 않는다', () => {
    const weak = stages.find((no) => stageTrait(no) !== 'plain')!
    expect(weakActivityAdvice({ exercise: 0 }, [], weak, 1)).toBeNull()
  })
})
