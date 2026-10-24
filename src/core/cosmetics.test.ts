import { describe, test, expect } from 'vitest'
import { COSMETICS, ownedCosmetics, stageReward } from './cosmetics'
import { STAGES } from './stages'
import { newSave } from './session'

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

describe('ownedCosmetics', () => {
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
