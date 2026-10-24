import { describe, test, expect } from 'vitest'
import { statRows } from './stats'
import { computeProgress } from './progression'
import type { ActivityRecord } from './types'

const MIN = 60_000
const T0 = new Date(2026, 9, 25, 8).getTime()
const exercise = (minutes: number): ActivityRecord[] => [
  { id: 'e', activity: 'exercise', startedAt: T0, endedAt: T0 + minutes * MIN },
]

describe('statRows', () => {
  test('처음에는 힘·체력·지능 모두 기본값이고, 운동 10분이면 힘·체력이 1 오른다', () => {
    expect(statRows(computeProgress([])).map((r) => [r.id, r.value, r.toNext])).toEqual([
      ['str', 5, 10],
      ['vit', 5, 10],
      ['int', 5, null],
    ])
  })

  test('다음 +1까지 남은 분은 오른 활동의 인정 분으로 센다', () => {
    const rows = statRows(computeProgress(exercise(37)))
    expect(rows.find((r) => r.id === 'str')).toMatchObject({ value: 8, toNext: 3, source: '운동' })
    expect(rows.find((r) => r.id === 'vit')).toMatchObject({ value: 8, toNext: 3 })
  })

  test('지능은 아직 오르는 활동이 없어 준비 중으로 둔다', () => {
    const int = statRows(computeProgress(exercise(120))).find((r) => r.id === 'int')!
    expect(int).toMatchObject({ value: 5, toNext: null, source: null, name: '지능' })
  })

  test('하루 상한을 넘긴 시간은 남은 분에 들어가지 않는다', () => {
    // 200분 운동해도 인정은 180분 → 힘 5+18, 다음까지 10분
    const str = statRows(computeProgress(exercise(200))).find((r) => r.id === 'str')!
    expect(str).toMatchObject({ value: 23, toNext: 10 })
  })
})
