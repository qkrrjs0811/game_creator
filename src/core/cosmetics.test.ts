import { describe, test, expect } from 'vitest'
import {
  COSMETICS,
  MISSION_COSMETICS,
  STAMP_COSMETICS,
  WEEK_COSMETICS,
  chapterCosmetic,
  cosmeticById,
  cosmeticCatalog,
  ownedCosmetics,
  stageReward,
  toggleWear,
  wornCosmetics,
} from './cosmetics'
import { STAGES } from './stages'
import { newSave } from './session'
import { stampCount } from './goal'
import { missionStars } from './mission'
import type { ActivityRecord } from './types'

/** 2026-10-01부터 n일 동안 날마다 운동 30분(도장 n개) */
function stampDays(n: number): ActivityRecord[] {
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(2026, 9, 1 + i, 7).getTime()
    return { id: `r${i}`, activity: 'exercise' as const, startedAt: start, endedAt: start + 30 * 60_000 }
  })
}

describe('stageReward', () => {
  test('스테이지마다 다른 꾸미기 하나', () => {
    const rewards = STAGES.map((s) => stageReward(s.no))
    expect(rewards.every((r) => r !== null)).toBe(true)
    expect(new Set(rewards.map((r) => r!.id)).size).toBe(STAGES.length)
  })

  test('모자와 색이 모두 있음', () => {
    expect(COSMETICS.some((c) => c.kind === 'hat')).toBe(true)
    expect(COSMETICS.some((c) => c.kind === 'color')).toBe(true)
  })

  test('없는 스테이지는 보상 없음', () => {
    for (const no of [0, 7, -1, 1.5]) expect(stageReward(no)).toBeNull()
  })
})

describe('chapterCosmetic', () => {
  test('장 보스(장 × 10스테이지)에서 얻는 모자', () => {
    expect(chapterCosmetic(1)).toMatchObject({ id: 'hat-ch1', kind: 'hat', stage: 10, chapter: 1 })
    expect(chapterCosmetic(3)!.stage).toBe(30)
  })

  test('앞쪽 60장은 모자 모양·색·무늬 조합과 이름이 모두 다름', () => {
    const list = Array.from({ length: 60 }, (_, i) => chapterCosmetic(i + 1)!)
    const looks = list.map((c) => `${c.hat!.shape} ${c.hat!.color} ${c.hat!.pattern}`)
    expect(new Set(looks).size).toBe(60)
    expect(new Set(list.map((c) => c.name)).size).toBe(60)
  })

  test('끝없이 만들 수 있음', () => {
    expect(chapterCosmetic(1000)).toMatchObject({ id: 'hat-ch1000', stage: 10000 })
  })

  test('없는 장은 null', () => {
    for (const no of [0, -1, 1.5, NaN]) expect(chapterCosmetic(no)).toBeNull()
  })

  test('장 보스 스테이지의 보상은 장 모자, 다른 스테이지는 그대로', () => {
    expect(stageReward(10)).toEqual(chapterCosmetic(1))
    expect(stageReward(20)).toEqual(chapterCosmetic(2))
    expect(stageReward(6)!.id).toBe('hat-crown')
    expect(stageReward(11)).toBeNull()
  })
})

describe('STAMP_COSMETICS', () => {
  test('도장 7·30·100개에 주는 모자 셋, 스테이지로는 얻지 않음', () => {
    expect(STAMP_COSMETICS.map((c) => [c.id, c.kind, c.stamps])).toEqual([
      ['hat-stamp7', 'hat', 7],
      ['hat-stamp30', 'hat', 30],
      ['hat-stamp100', 'hat', 100],
    ])
    for (const c of STAMP_COSMETICS) expect(c.stage).toBeUndefined()
    for (const no of [7, 30, 100]) expect(stageReward(no)?.stamps).toBeUndefined()
    expect(new Set(STAMP_COSMETICS.map((c) => c.name)).size).toBe(3)
  })

  test('도장 수는 하루 목표 도장과 같음', () => {
    expect(stampCount(stampDays(7))).toBe(7)
  })
})

/** 2026-10-05(월)부터 n주 동안 주마다 월~금 운동 30분(채운 주 n번) */
function weekDays(n: number): ActivityRecord[] {
  return Array.from({ length: n * 5 }, (_, i) => {
    const start = new Date(2026, 9, 5 + Math.floor(i / 5) * 7 + (i % 5), 7).getTime()
    return { id: `w${i}`, activity: 'exercise' as const, startedAt: start, endedAt: start + 30 * 60_000 }
  })
}

describe('WEEK_COSMETICS', () => {
  test('주간 목표를 1·4·12번 채우면 주는 몸 색 셋, 스테이지·도장으로는 얻지 않음', () => {
    expect(WEEK_COSMETICS.map((c) => [c.id, c.kind, c.weeks])).toEqual([
      ['color-week1', 'color', 1],
      ['color-week4', 'color', 4],
      ['color-week12', 'color', 12],
    ])
    for (const c of WEEK_COSMETICS) {
      expect(c.stage).toBeUndefined()
      expect(c.stamps).toBeUndefined()
    }
    expect(new Set(WEEK_COSMETICS.map((c) => c.name)).size).toBe(3)
  })

  test('이름으로 찾음', () => {
    expect(cosmeticById('color-week4')).toEqual(WEEK_COSMETICS[1])
  })

  test('채운 주 1·4·12번마다 하나씩 가짐', () => {
    const owned = (n: number) =>
      ownedCosmetics({ ...newSave(), records: weekDays(n) }).map((c) => c.id).filter((id) => id.startsWith('color-week'))
    expect(owned(0)).toEqual([])
    expect(owned(1)).toEqual(['color-week1'])
    expect(owned(3)).toEqual(['color-week1'])
    expect(owned(4)).toEqual(['color-week1', 'color-week4'])
    expect(owned(11)).toEqual(['color-week1', 'color-week4'])
    expect(owned(12)).toEqual(['color-week1', 'color-week4', 'color-week12'])
  })

  test('한 주에 4일만 채우면 없고, 저장에 이름이 있거나 스테이지를 많이 깨도 없음', () => {
    const four = weekDays(1).slice(0, 4)
    const save = { ...newSave(), stageProgress: 500, cosmetics: ['color-week1'], records: four }
    expect(ownedCosmetics(save).map((c) => c.id)).not.toContain('color-week1')
  })

  test('입을 수 있고, 다른 색과 바꿔 입음', () => {
    const save = { ...newSave(), stageProgress: 3, records: weekDays(1) }
    const on = toggleWear(toggleWear(save, 'color-sky'), 'color-week1')
    expect(wornCosmetics(on).color).toEqual(WEEK_COSMETICS[0])
    expect(on.worn).toEqual(['color-week1'])
  })
})

/** 2026-10-01부터 n일 동안 날마다 네 활동을 미션 분만큼(미션 별 n개) */
function missionDaysOf(n: number): ActivityRecord[] {
  const mins = { exercise: 20, study: 15, reading: 15, relax: 10 } as const
  return Array.from({ length: n }, (_, i) =>
    (Object.keys(mins) as (keyof typeof mins)[]).map((activity, j) => {
      const start = new Date(2026, 9, 1 + i, 8 + j * 2).getTime()
      return { id: `m${i}-${j}`, activity, startedAt: start, endedAt: start + mins[activity] * 60_000 }
    }),
  ).flat()
}

describe('MISSION_COSMETICS', () => {
  test('미션 별 5·20·50개에 주는 모자 셋, 스테이지·도장·주간 목표로는 얻지 않음', () => {
    expect(MISSION_COSMETICS.map((c) => [c.id, c.kind, c.missions])).toEqual([
      ['hat-mission5', 'hat', 5],
      ['hat-mission20', 'hat', 20],
      ['hat-mission50', 'hat', 50],
    ])
    for (const c of MISSION_COSMETICS) {
      expect(c.stage).toBeUndefined()
      expect(c.stamps).toBeUndefined()
      expect(c.weeks).toBeUndefined()
    }
    expect(new Set(MISSION_COSMETICS.map((c) => c.name)).size).toBe(3)
    expect(missionStars(missionDaysOf(5))).toBe(5)
  })

  test('이름으로 찾음', () => {
    expect(cosmeticById('hat-mission20')).toEqual(MISSION_COSMETICS[1])
  })

  test('미션 별 5·20·50개마다 하나씩 가짐', () => {
    const owned = (n: number) =>
      ownedCosmetics({ ...newSave(), records: missionDaysOf(n) }).map((c) => c.id).filter((id) => id.startsWith('hat-mission'))
    expect(owned(0)).toEqual([])
    expect(owned(4)).toEqual([])
    expect(owned(5)).toEqual(['hat-mission5'])
    expect(owned(19)).toEqual(['hat-mission5'])
    expect(owned(20)).toEqual(['hat-mission5', 'hat-mission20'])
    expect(owned(49)).toEqual(['hat-mission5', 'hat-mission20'])
    expect(owned(50)).toEqual(['hat-mission5', 'hat-mission20', 'hat-mission50'])
  })

  test('미션 활동이 아닌 날은 도장이 있어도 세지 않고, 저장에 이름이 있거나 스테이지를 많이 깨도 별이 모자라면 없음', () => {
    // 2026-10-01부터 40일 날마다 독서 60분: 도장 40개지만 미션 별은 독서 미션 날(나흘에 하루)만
    const reading = Array.from({ length: 40 }, (_, i) => {
      const start = new Date(2026, 9, 1 + i, 9).getTime()
      return { id: `b${i}`, activity: 'reading' as const, startedAt: start, endedAt: start + 60 * 60_000 }
    })
    expect(missionStars(reading)).toBe(10)
    const ids = ownedCosmetics({ ...newSave(), stageProgress: 500, cosmetics: ['hat-mission20'], records: reading }).map((c) => c.id)
    expect(ids).toContain('hat-mission5')
    expect(ids).not.toContain('hat-mission20')
  })

  test('입을 수 있고, 다른 모자와 바꿔 입음', () => {
    const save = { ...newSave(), stageProgress: 1, records: missionDaysOf(5) }
    const on = toggleWear(toggleWear(save, 'hat-sprout'), 'hat-mission5')
    expect(wornCosmetics(on).hat).toEqual(MISSION_COSMETICS[0])
    expect(on.worn).toEqual(['hat-mission5'])
  })
})

describe('cosmeticById', () => {
  test('도장 모자를 찾음', () => {
    expect(cosmeticById('hat-stamp30')).toEqual(STAMP_COSMETICS[1])
  })

  test('처음 꾸미기와 장 모자를 찾음', () => {
    expect(cosmeticById('hat-crown')!.stage).toBe(6)
    expect(cosmeticById('hat-ch12')).toEqual(chapterCosmetic(12))
  })

  test('모르는 이름은 null', () => {
    for (const id of ['???', 'hat-ch0', 'hat-ch01', 'hat-chx', 'hat-ch']) expect(cosmeticById(id)).toBeNull()
  })
})

describe('cosmeticCatalog', () => {
  test('처음 꾸미기와 다음 장 모자 하나까지 보여 줌', () => {
    expect(cosmeticCatalog(newSave()).map((c) => c.id)).toEqual([
      ...COSMETICS.map((c) => c.id),
      ...STAMP_COSMETICS.map((c) => c.id),
      ...WEEK_COSMETICS.map((c) => c.id),
      ...MISSION_COSMETICS.map((c) => c.id),
      'hat-ch1',
    ])
    expect(cosmeticCatalog({ ...newSave(), stageProgress: 25 }).map((c) => c.id).slice(-3)).toEqual(['hat-ch1', 'hat-ch2', 'hat-ch3'])
  })
})

describe('ownedCosmetics', () => {
  test('장 보스를 깬 저장은 그 장 모자를 가짐(예전 저장 포함)', () => {
    const ids = ownedCosmetics({ ...newSave(), stageProgress: 25 }).map((c) => c.id)
    expect(ids).toEqual([...COSMETICS.map((c) => c.id), 'hat-ch1', 'hat-ch2'])
  })

  test('도장 7·30·100개를 모으면 도장 모자를 하나씩 가짐', () => {
    const owned = (n: number) =>
      ownedCosmetics({ ...newSave(), records: stampDays(n) }).map((c) => c.id).filter((id) => id.startsWith('hat-stamp'))
    expect(owned(0)).toEqual([])
    expect(owned(6)).toEqual([])
    expect(owned(7)).toEqual(['hat-stamp7'])
    expect(owned(29)).toEqual(['hat-stamp7'])
    expect(owned(30)).toEqual(['hat-stamp7', 'hat-stamp30'])
    expect(owned(100)).toEqual(['hat-stamp7', 'hat-stamp30', 'hat-stamp100'])
  })

  test('도장 모자는 스테이지를 많이 깨거나 저장에 이름이 있어도 도장이 모자라면 없음', () => {
    const save = { ...newSave(), stageProgress: 500, cosmetics: ['hat-stamp7'], records: stampDays(6) }
    expect(ownedCosmetics(save).map((c) => c.id)).not.toContain('hat-stamp7')
  })

  test('저장에 있는 장 모자는 남김', () => {
    expect(ownedCosmetics({ ...newSave(), stageProgress: 3, cosmetics: ['hat-ch1'] }).map((c) => c.id)).toContain('hat-ch1')
  })

  test('처음에는 아무것도 없음', () => {
    expect(ownedCosmetics(newSave())).toEqual([])
  })

  test('저장된 꾸미기를 가짐', () => {
    const id = stageReward(1)!.id
    expect(ownedCosmetics({ ...newSave(), stageProgress: 1, cosmetics: [id] }).map((c) => c.id)).toEqual([id])
  })

  test('보상이 생기기 전에 깬 스테이지의 꾸미기도 가짐', () => {
    const owned = ownedCosmetics({ ...newSave(), stageProgress: 3, cosmetics: [] }).map((c) => c.id)
    expect(owned).toEqual([1, 2, 3].map((no) => stageReward(no)!.id))
  })

  test('모르는 이름은 건너뛰고, 겹쳐도 한 번만', () => {
    const id = stageReward(2)!.id
    const owned = ownedCosmetics({ ...newSave(), stageProgress: 0, cosmetics: ['???', id, id] })
    expect(owned.map((c) => c.id)).toEqual([id])
  })
})

const byId = (id: string) => COSMETICS.find((c) => c.id === id)

describe('wornCosmetics', () => {
  const all = { ...newSave(), stageProgress: 6 }

  test('처음에는 아무것도 안 입음', () => {
    expect(wornCosmetics(newSave())).toEqual({ hat: null, color: null })
  })

  test('입은 모자와 색을 돌려줌', () => {
    expect(wornCosmetics({ ...all, worn: ['hat-crown', 'color-sky'] })).toEqual({ hat: byId('hat-crown'), color: byId('color-sky') })
  })

  test('가지지 않았거나 모르는 꾸미기는 입지 않은 것으로 봄', () => {
    const save = { ...newSave(), stageProgress: 1, worn: ['hat-crown', '???', 'color-sky'] }
    expect(wornCosmetics(save)).toEqual({ hat: null, color: null })
  })
})

describe('toggleWear', () => {
  const all = { ...newSave(), stageProgress: 6 }

  test('가진 꾸미기를 입음', () => {
    expect(toggleWear(all, 'hat-sprout').worn).toEqual(['hat-sprout'])
  })

  test('같은 종류는 하나만 — 새 모자를 쓰면 이전 모자를 벗음', () => {
    const save = toggleWear(toggleWear(toggleWear(all, 'hat-sprout'), 'color-sky'), 'hat-crown')
    expect(wornCosmetics(save)).toEqual({ hat: byId('hat-crown'), color: byId('color-sky') })
    expect(save.worn).not.toContain('hat-sprout')
  })

  test('입은 것을 다시 누르면 벗음', () => {
    expect(toggleWear(toggleWear(all, 'color-cotton'), 'color-cotton').worn).toEqual([])
  })

  test('가지지 않았거나 모르는 꾸미기는 그대로', () => {
    const save = { ...newSave(), stageProgress: 1 }
    expect(toggleWear(save, 'hat-crown')).toBe(save)
    expect(toggleWear(save, '???')).toBe(save)
  })

  test('장 모자를 쓰면 다른 모자를 벗고 색은 그대로, 다시 누르면 벗음', () => {
    const on = toggleWear({ ...newSave(), stageProgress: 10, worn: ['hat-crown', 'color-sky'] }, 'hat-ch1')
    expect(wornCosmetics(on)).toEqual({ hat: chapterCosmetic(1), color: byId('color-sky') })
    expect(toggleWear(on, 'hat-ch1').worn).toEqual(['color-sky'])
  })

  test('도장 모자는 도장을 모았을 때만 입음', () => {
    const few = { ...newSave(), records: stampDays(6) }
    expect(toggleWear(few, 'hat-stamp7')).toBe(few)
    const on = toggleWear({ ...newSave(), records: stampDays(7), stageProgress: 6, worn: ['hat-crown'] }, 'hat-stamp7')
    expect(on.worn).toEqual(['hat-stamp7'])
    expect(wornCosmetics(on).hat?.id).toBe('hat-stamp7')
  })

  test('아직 못 깬 장 모자는 입을 수 없음', () => {
    const save = { ...newSave(), stageProgress: 9 }
    expect(toggleWear(save, 'hat-ch1')).toBe(save)
  })

  test('입기는 기록·스킬·스테이지·가진 꾸미기를 바꾸지 않음', () => {
    const save = { ...all, cosmetics: ['hat-sprout'], skills: ['punch'] }
    const next = toggleWear(save, 'hat-sprout')
    expect({ ...next, worn: save.worn }).toEqual(save)
  })
})
