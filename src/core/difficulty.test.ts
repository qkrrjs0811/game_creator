import { describe, test, expect } from 'vitest'
import { freshFighter, freshMinutesToWin, rotatedSkills } from './difficulty'
import { likelyWin } from './coach'
import { stageEnemy } from './monsters'
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

describe('freshMinutesToWin', () => {
  test('처음부터 이길 만하면 0', () => {
    expect(freshMinutesToWin(stageEnemy(1))).toBe(0)
  })

  test('이길 만해지는 가장 적은 누적 운동 분', () => {
    const m = freshMinutesToWin(stageEnemy(2))!
    expect(m).toBeGreaterThan(0)
    expect(likelyWin(freshFighter(m), stageEnemy(2))).toBe(true)
    expect(likelyWin(freshFighter(m - 1), stageEnemy(2))).toBe(false)
  })

  test('지금 스테이지는 뒤로 갈수록 오래 걸린다', () => {
    const all = STAGES.map((s) => freshMinutesToWin(stageEnemy(s.no))!)
    for (let i = 1; i < all.length; i++) expect(all[i]).toBeGreaterThanOrEqual(all[i - 1])
  })

  test('찾는 범위 안에서 못 이기면 null', () => {
    expect(freshMinutesToWin(stageEnemy(6), 5)).toBeNull()
  })
})
