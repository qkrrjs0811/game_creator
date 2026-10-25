import { describe, test, expect } from 'vitest'
import { awaySummary, recordsUntil, shouldShowAway } from './away'
import { newSave } from './session'
import type { ActivityRecord, SaveData } from './types'

const MIN = 60_000
const T0 = new Date(2026, 9, 25, 8).getTime()
const rec = (activity: ActivityRecord['activity'], from: number, to: number): ActivityRecord => ({
  id: `${activity}-${from}`,
  activity,
  startedAt: from,
  endedAt: to,
})
const save = (records: ActivityRecord[], active: SaveData['active'] = null): SaveData => ({ ...newSave(), records, active })

describe('recordsUntil', () => {
  test('마지막으로 본 시각 뒤는 잘라 내고, 그 뒤에 시작한 기록은 뺀다', () => {
    const records = [rec('exercise', T0, T0 + 30 * MIN), rec('study', T0 + 40 * MIN, T0 + 50 * MIN)]
    expect(recordsUntil(records, T0 + 10 * MIN)).toEqual([rec('exercise', T0, T0 + 10 * MIN)])
  })
})

describe('awaySummary', () => {
  test('켜 둔 운동 타이머로 닫아 둔 사이 늘어난 분·EXP·능력치', () => {
    const s = save([], { activity: 'exercise', startedAt: T0 })
    const a = awaySummary(s, T0 + 5 * MIN, T0 + 45 * MIN)
    expect(a.awayMs).toBe(40 * MIN)
    expect(a.minutes).toEqual({ exercise: 40, study: 0, reading: 0, relax: 0 })
    expect(a.exp).toBe(400)
    expect(a.stats).toEqual({ str: 4, vit: 4, int: 0, focus: 0 })
    expect(a.gained).toBe(true)
  })

  test('그 사이 다른 창에서 끝낸 기록도 센다', () => {
    const s = save([rec('exercise', T0 - 60 * MIN, T0 - 50 * MIN), rec('reading', T0 + 10 * MIN, T0 + 30 * MIN)])
    const a = awaySummary(s, T0, T0 + 60 * MIN)
    expect(a.minutes.reading).toBe(20)
    expect(a.minutes.exercise).toBe(0)
    expect(a.stats).toEqual({ str: 0, vit: 0, int: 0, focus: 4 })
  })

  test('하루 상한을 넘긴 시간은 세지 않는다', () => {
    const s = save([rec('exercise', T0 - 170 * MIN, T0)], { activity: 'exercise', startedAt: T0 })
    const a = awaySummary(s, T0, T0 + 60 * MIN)
    expect(a.minutes.exercise).toBe(10)
    expect(a.exp).toBe(100)
  })

  test('레벨이 몇에서 몇으로 올랐는지', () => {
    const s = save([], { activity: 'exercise', startedAt: T0 })
    // 10분 = 100 EXP → Lv.2, 25분 = 250 EXP → Lv.3
    const a = awaySummary(s, T0 + 5 * MIN, T0 + 25 * MIN)
    expect(a.levelBefore).toBe(1)
    expect(a.levelAfter).toBe(3)
  })

  test('그 사이 하루 목표를 채우면 도장이 늘어난다', () => {
    const s = save([rec('study', T0, T0 + 20 * MIN)], { activity: 'exercise', startedAt: T0 + 20 * MIN })
    const a = awaySummary(s, T0 + 25 * MIN, T0 + 40 * MIN)
    expect(a.stampsBefore).toBe(0)
    expect(a.stampsAfter).toBe(1)
  })

  test('늘어난 게 없으면 gained 가 false', () => {
    const s = save([rec('exercise', T0, T0 + 30 * MIN)])
    const a = awaySummary(s, T0 + 30 * MIN, T0 + 300 * MIN)
    expect(a.awayMs).toBe(270 * MIN)
    expect(a.exp).toBe(0)
    expect(a.gained).toBe(false)
  })

  test('지금이 마지막으로 본 시각보다 앞이면 흐른 시간은 0', () => {
    const a = awaySummary(save([], { activity: 'exercise', startedAt: T0 }), T0 + 20 * MIN, T0 + 10 * MIN)
    expect(a.awayMs).toBe(0)
    expect(a.gained).toBe(false)
  })

  test('기록을 바꾸지 않는다', () => {
    const records = [rec('exercise', T0, T0 + 30 * MIN)]
    const s = save(records)
    awaySummary(s, T0 + 10 * MIN, T0 + 60 * MIN)
    expect(s.records).toEqual([rec('exercise', T0, T0 + 30 * MIN)])
  })
})

describe('shouldShowAway', () => {
  const s = save([], { activity: 'exercise', startedAt: T0 })
  test('10분 넘게 닫아 뒀고 늘어난 게 있으면 띄운다', () => {
    expect(shouldShowAway(awaySummary(s, T0 + 5 * MIN, T0 + 16 * MIN))).toBe(true)
  })
  test('10분 이하로 닫았다 열면 띄우지 않는다', () => {
    expect(shouldShowAway(awaySummary(s, T0 + 5 * MIN, T0 + 15 * MIN))).toBe(false)
  })
  test('오래 닫아 뒀어도 늘어난 게 없으면 띄우지 않는다', () => {
    expect(shouldShowAway(awaySummary(save([]), T0, T0 + 120 * MIN))).toBe(false)
  })
  test('상한을 채운 뒤 켜 둔 시간만 흘렀으면 띄우지 않는다', () => {
    const full = save([], { activity: 'relax', startedAt: T0 })
    expect(shouldShowAway(awaySummary(full, T0 + 40 * MIN, T0 + 90 * MIN))).toBe(false)
  })
})
