import { describe, test, expect } from 'vitest'
import { applyBattleResult } from './result'
import { newSave } from './session'
import type { SaveData } from './types'

const saveAt = (stageProgress: number): SaveData => ({ ...newSave(), stageProgress })

describe('applyBattleResult', () => {
  test('처음 깨면 깬 수가 늘고 다음 스테이지가 열림', () => {
    const r = applyBattleResult(saveAt(0), 1, true)
    expect(r.save.stageProgress).toBe(1)
    expect(r.firstClear).toBe(true)
    expect(r.unlocked).toBe(2)
    expect(r.allCleared).toBe(false)
  })

  test('지면 저장이 그대로', () => {
    const s = saveAt(1)
    const r = applyBattleResult(s, 2, false)
    expect(r.save).toBe(s)
    expect(r.firstClear).toBe(false)
    expect(r.unlocked).toBeNull()
  })

  test('이미 깬 스테이지를 다시 이겨도 깬 수는 그대로', () => {
    const s = saveAt(3)
    const r = applyBattleResult(s, 1, true)
    expect(r.save).toBe(s)
    expect(r.firstClear).toBe(false)
    expect(r.unlocked).toBeNull()
  })

  test('보스를 처음 이기면 모두 깸, 더 열 스테이지는 없음', () => {
    const r = applyBattleResult(saveAt(5), 6, true)
    expect(r.save.stageProgress).toBe(6)
    expect(r.firstClear).toBe(true)
    expect(r.unlocked).toBeNull()
    expect(r.allCleared).toBe(true)
  })

  test('잠긴 스테이지나 없는 스테이지는 이겨도 바뀌지 않음', () => {
    for (const no of [3, 0, 7, -1, 1.5]) {
      const s = saveAt(1)
      expect(applyBattleResult(s, no, true).save).toBe(s)
    }
  })

  test('전투 결과는 기록·스킬·꾸미기를 건드리지 않음 (성장은 운동으로만)', () => {
    const s: SaveData = {
      ...saveAt(0),
      records: [{ id: 'a', activity: 'exercise', startedAt: 0, endedAt: 60_000 }],
      skills: ['punch'],
      cosmetics: [],
    }
    const r = applyBattleResult(s, 1, true)
    expect(r.save.records).toEqual(s.records)
    expect(r.save.skills).toEqual(s.skills)
    expect(r.save.cosmetics).toEqual(s.cosmetics)
    expect(s.stageProgress).toBe(0)
  })
})
