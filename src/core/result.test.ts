import { describe, test, expect } from 'vitest'
import { applyBattleResult } from './result'
import { stageReward } from './cosmetics'
import { newSave } from './session'
import type { SaveData } from './types'

const saveAt = (stageProgress: number): SaveData => ({ ...newSave(), stageProgress })

describe('applyBattleResult', () => {
  test('처음 깨면 깬 수가 늘고 다음 스테이지가 열림', () => {
    const r = applyBattleResult(saveAt(0), 1, true)
    expect(r.save.stageProgress).toBe(1)
    expect(r.firstClear).toBe(true)
    expect(r.unlocked).toBe(2)
    expect(r.newChapter).toBeNull()
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

  test('장 보스를 처음 이기면 다음 장의 첫 스테이지가 열림', () => {
    const r = applyBattleResult(saveAt(9), 10, true)
    expect(r.save.stageProgress).toBe(10)
    expect(r.firstClear).toBe(true)
    expect(r.unlocked).toBe(11)
    expect(r.newChapter).toBe(2)
    expect(applyBattleResult(saveAt(19), 20, true).newChapter).toBe(3)
  })

  test('예전 마지막(6스테이지)을 깨도 끝나지 않고 7스테이지가 열림', () => {
    const r = applyBattleResult(saveAt(5), 6, true)
    expect(r.unlocked).toBe(7)
    expect(r.newChapter).toBeNull()
  })

  test('잠긴 스테이지나 없는 스테이지는 이겨도 바뀌지 않음', () => {
    for (const no of [3, 0, -1, 1.5]) {
      const s = saveAt(1)
      expect(applyBattleResult(s, no, true).save).toBe(s)
    }
  })

  test('처음 깨면 그 스테이지의 꾸미기를 받음', () => {
    const r = applyBattleResult(saveAt(0), 1, true)
    expect(r.reward).toEqual(stageReward(1))
    expect(r.save.cosmetics).toEqual([stageReward(1)!.id])
  })

  test('지거나 다시 이기면 꾸미기를 받지 않음', () => {
    expect(applyBattleResult(saveAt(1), 2, false).reward).toBeNull()
    expect(applyBattleResult(saveAt(3), 1, true).reward).toBeNull()
  })

  test('이미 가진 꾸미기는 겹쳐 넣지 않음', () => {
    const id = stageReward(1)!.id
    const r = applyBattleResult({ ...saveAt(0), cosmetics: [id] }, 1, true)
    expect(r.save.cosmetics).toEqual([id])
  })

  test('전투 결과는 기록·스킬을 건드리지 않음 (성장은 운동으로만)', () => {
    const s: SaveData = {
      ...saveAt(0),
      records: [{ id: 'a', activity: 'exercise', startedAt: 0, endedAt: 60_000 }],
      skills: ['punch'],
      cosmetics: [],
    }
    const r = applyBattleResult(s, 1, true)
    expect(r.save.records).toEqual(s.records)
    expect(r.save.skills).toEqual(s.skills)
    expect(s.stageProgress).toBe(0)
    expect(s.cosmetics).toEqual([])
  })
})
