import { describe, test, expect } from 'vitest'
import { levelUpTo } from './levelup'

describe('levelUpTo', () => {
  test('레벨이 오르면 새 레벨', () => {
    expect(levelUpTo(2, 3)).toBe(3)
  })

  test('한 번에 여러 레벨이 올라도 마지막 레벨 하나', () => {
    expect(levelUpTo(1, 4)).toBe(4)
  })

  test('그대로거나 내려가면 null', () => {
    expect(levelUpTo(3, 3)).toBeNull()
    expect(levelUpTo(5, 2)).toBeNull()
  })

  test('처음 본 레벨(이전 값 없음)은 축하하지 않음', () => {
    expect(levelUpTo(undefined, 7)).toBeNull()
  })
})
