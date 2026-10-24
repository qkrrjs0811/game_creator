import { describe, test, expect } from 'vitest'
import { levelUpPoints, levelUpTo, restoreShownLevel } from './levelup'

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

describe('restoreShownLevel', () => {
  test('앱을 닫아 둔 사이 오른 레벨은 다시 열 때 축하할 수 있게 지난번 본 레벨을 돌려줌', () => {
    expect(restoreShownLevel('2', 4)).toBe(2)
    expect(levelUpTo(restoreShownLevel('2', 4), 4)).toBe(4)
  })

  test('그대로면 축하하지 않음', () => {
    expect(levelUpTo(restoreShownLevel('3', 3), 3)).toBeNull()
  })

  test('남긴 값이 없거나 깨졌거나 지금보다 높으면 처음 본 것으로 둠', () => {
    expect(restoreShownLevel(null, 3)).toBeUndefined()
    expect(restoreShownLevel('abc', 3)).toBeUndefined()
    expect(restoreShownLevel('0', 3)).toBeUndefined()
    expect(restoreShownLevel('2.5', 3)).toBeUndefined()
    expect(restoreShownLevel('5', 3)).toBeUndefined()
  })
})

describe('levelUpPoints', () => {
  test('오른 레벨 수만큼 스킬 포인트를 받음', () => {
    expect(levelUpPoints(2, 3)).toBe(1)
    expect(levelUpPoints(1, 4)).toBe(3)
  })

  test('축하하지 않는 경우(처음 봄·그대로·내려감)는 0', () => {
    expect(levelUpPoints(undefined, 7)).toBe(0)
    expect(levelUpPoints(3, 3)).toBe(0)
    expect(levelUpPoints(5, 2)).toBe(0)
  })
})
