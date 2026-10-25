import { describe, test, expect } from 'vitest'
import { freshFighter, freshMinutesToWin, freshMixFighter, rotatedSkills } from './difficulty'
import { likelyWin } from './coach'
import { stageEnemy } from './endless'
import { STAGES } from './stages'

describe('rotatedSkills', () => {
  test('레벨이 오를 때마다 받은 포인트를 펀치→몸→발 순서로 돌려 가며 쓴다', () => {
    expect(rotatedSkills(1)).toEqual([])
    expect(rotatedSkills(2)).toEqual(['punch'])
    expect(rotatedSkills(5)).toEqual(['punch', 'tough', 'quick', 'punch'])
  })
})

describe('freshFighter', () => {
  test('운동만 한 분으로 능력치·레벨·스킬을 정한다', () => {
    // 0분: 힘·체력 5, 레벨 1, 스킬 없음
    expect(freshFighter(0)).toMatchObject({ hp: 40, atk: 5, def: 2, spd: 5, dodge: 0 })
    // 30분: EXP 300 → 레벨 3(100+150), 힘·체력 8, 펀치·몸 하나씩
    expect(freshFighter(30)).toMatchObject({ hp: 52, atk: 10, def: 6, spd: 5, dodge: 0 })
  })
})

describe('여러 활동을 섞어도 불리하지 않음', () => {
  test('freshMixFighter는 활동별 분으로 능력치를, 모든 활동의 합으로 레벨을 정한다', () => {
    expect(freshMixFighter({ exercise: 30, study: 0 })).toEqual(freshFighter(30))
    // 운동 20 + 공부 10: 힘·체력 7, 지능 7, EXP 300 → 레벨 3(펀치·몸)
    expect(freshMixFighter({ exercise: 20, study: 10 })).toMatchObject({ hp: 52, atk: 10, def: 6, crit: 0.02 })
  })

  test('같은 시간이면 운동과 공부를 섞어도 운동만 한 것보다 이길 만한 스테이지가 줄지 않는다', () => {
    for (const total of [20, 40, 60, 120, 300, 600, 1200, 3000]) {
      for (const share of [0.25, 0.5, 0.75]) {
        const study = Math.round((total * share) / 10) * 10
        const mixed = freshMixFighter({ exercise: total - study, study })
        const solo = freshFighter(total)
        for (let n = 1; n <= 60; n++) {
          if (likelyWin(solo, stageEnemy(n))) expect(likelyWin(mixed, stageEnemy(n)), `${total}분 중 공부 ${study}분, ${n}스테이지`).toBe(true)
        }
      }
    }
  })

  test('공부만 오래 해도 운동만 한 것보다 훨씬 앞서 가지 않는다', () => {
    const reach = (f: ReturnType<typeof freshFighter>) => {
      let best = 0
      for (let n = 1; n <= 100; n++) if (likelyWin(f, stageEnemy(n))) best = n
      return best
    }
    const solo = reach(freshFighter(1200))
    expect(reach(freshMixFighter({ exercise: 0, study: 1200 }))).toBeLessThanOrEqual(solo + 3)
  })
})

describe('freshMinutesToWin', () => {
  test('처음부터 이길 만하면 0', () => {
    expect(freshMinutesToWin(stageEnemy(1))).toBe(0)
  })

  test('이길 만해지는 가장 적은 누적 운동 분', () => {
    const m = freshMinutesToWin(stageEnemy(3))!
    expect(m).toBeGreaterThan(0)
    expect(likelyWin(freshFighter(m), stageEnemy(3))).toBe(true)
    expect(likelyWin(freshFighter(m - 1), stageEnemy(3))).toBe(false)
  })

  test('지금 스테이지는 뒤로 갈수록 오래 걸린다', () => {
    const all = STAGES.map((s) => freshMinutesToWin(stageEnemy(s.no))!)
    for (let i = 1; i < all.length; i++) expect(all[i]).toBeGreaterThanOrEqual(all[i - 1])
  })

  test('찾는 범위 안에서 못 이기면 null', () => {
    expect(freshMinutesToWin(stageEnemy(6), 5)).toBeNull()
  })
})
