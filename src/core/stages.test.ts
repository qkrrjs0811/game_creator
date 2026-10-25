import { describe, test, expect } from 'vitest'
import { STAGES } from './stages'

describe('STAGES', () => {
  test('1장 앞쪽 이름: 스테이지 5개와 옛 보스', () => {
    expect(STAGES).toHaveLength(6)
    expect(STAGES.filter((s) => s.boss)).toHaveLength(1)
    expect(STAGES[STAGES.length - 1].boss).toBe(true)
    expect(STAGES.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
