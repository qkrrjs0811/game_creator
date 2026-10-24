import { describe, test, expect } from 'vitest'
import { COSMETICS, ownedCosmetics, stageReward, toggleWear, wornCosmetics } from './cosmetics'
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

  test('입기는 기록·스킬·스테이지·가진 꾸미기를 바꾸지 않음', () => {
    const save = { ...all, cosmetics: ['hat-sprout'], skills: ['punch'] }
    const next = toggleWear(save, 'hat-sprout')
    expect({ ...next, worn: save.worn }).toEqual(save)
  })
})
