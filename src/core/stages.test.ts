import { describe, test, expect } from 'vitest'
import { STAGES, isStageOpen, stageList } from './stages'

describe('STAGES', () => {
  test('스테이지 6개, 마지막 하나만 보스', () => {
    expect(STAGES).toHaveLength(6)
    expect(STAGES.filter((s) => s.boss)).toHaveLength(1)
    expect(STAGES[STAGES.length - 1].boss).toBe(true)
    expect(STAGES.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('isStageOpen', () => {
  test('아무것도 깨지 않았으면 1스테이지만 열림', () => {
    expect(isStageOpen(0, 1)).toBe(true)
    expect(isStageOpen(0, 2)).toBe(false)
  })

  test('깬 스테이지와 바로 다음 스테이지가 열림', () => {
    expect(isStageOpen(2, 1)).toBe(true)
    expect(isStageOpen(2, 3)).toBe(true)
    expect(isStageOpen(2, 4)).toBe(false)
  })

  test('없는 번호는 열리지 않음', () => {
    expect(isStageOpen(6, 0)).toBe(false)
    expect(isStageOpen(6, 7)).toBe(false)
  })
})

describe('stageList', () => {
  test('깸·도전 가능·잠김 상태', () => {
    expect(stageList(1).map((s) => s.state)).toEqual(['cleared', 'open', 'locked', 'locked', 'locked', 'locked'])
  })

  test('처음에는 1스테이지만 도전 가능', () => {
    expect(stageList(0).map((s) => s.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked'])
  })

  test('모두 깼거나 이상한 값(백업)이어도 목록은 깨지지 않음', () => {
    expect(stageList(6).every((s) => s.state === 'cleared')).toBe(true)
    expect(stageList(99).every((s) => s.state === 'cleared')).toBe(true)
    expect(stageList(-1)[0].state).toBe('open')
  })
})
