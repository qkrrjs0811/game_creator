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
  test('처음에는 힘·체력·지능·집중 모두 기본값이고, 운동 10분이면 힘·체력이 1 오른다', () => {
    expect(statRows(computeProgress([])).map((r) => [r.id, r.value, r.toNext])).toEqual([
      ['str', 5, 10],
      ['vit', 5, 10],
      ['int', 5, 5],
      ['focus', 5, 5],
    ])
  })

  test('집중은 독서로 5분마다 1씩 오른다', () => {
    const read: ActivityRecord[] = [{ id: 'r', activity: 'reading', startedAt: T0, endedAt: T0 + 12 * MIN }]
    const rows = statRows(computeProgress(read), ['reading'])
    expect(rows.find((r) => r.id === 'focus')).toMatchObject({ value: 7, toNext: 3, source: '독서', name: '집중', tomorrow: true })
    expect(rows.find((r) => r.id === 'int')).toMatchObject({ value: 5, toNext: 5, source: '공부', tomorrow: false })
  })

  test('다음 +1까지 남은 분은 오른 활동의 인정 분으로 센다', () => {
    const rows = statRows(computeProgress(exercise(37)))
    expect(rows.find((r) => r.id === 'str')).toMatchObject({ value: 8, toNext: 3, source: '운동' })
    expect(rows.find((r) => r.id === 'vit')).toMatchObject({ value: 8, toNext: 3 })
  })

  test('지능은 공부로 오르고 5분마다 1씩이라 다음까지 남은 분도 5분 단위로 센다', () => {
    expect(statRows(computeProgress(exercise(120))).find((r) => r.id === 'int')).toMatchObject({ value: 5, toNext: 5, source: '공부', name: '지능' })
    const studied: ActivityRecord[] = [{ id: 's', activity: 'study', startedAt: T0, endedAt: T0 + 13 * MIN }]
    const rows = statRows(computeProgress(studied), ['study'])
    expect(rows.find((r) => r.id === 'int')).toMatchObject({ value: 7, toNext: 2, tomorrow: true })
    expect(rows.find((r) => r.id === 'str')).toMatchObject({ value: 5, toNext: 10, tomorrow: false })
  })

  test('능력치마다 전투에서 하는 일을 알려 준다', () => {
    expect(statRows(computeProgress([])).map((r) => [r.id, r.role])).toEqual([
      ['str', '공격'],
      ['vit', 'HP·방어'],
      ['int', '치명타·두루'],
      ['focus', '회피·두루'],
    ])
  })

  test('하루 상한을 넘긴 시간은 남은 분에 들어가지 않는다', () => {
    // 200분 운동해도 인정은 180분 → 힘 5+18, 다음까지 10분
    const str = statRows(computeProgress(exercise(200))).find((r) => r.id === 'str')!
    expect(str).toMatchObject({ value: 23, toNext: 10 })
  })

  test('오늘 상한을 채운 활동으로 오르는 능력치는 내일 이어서 오른다고 표시한다', () => {
    const p = computeProgress(exercise(200))
    const rows = statRows(p, ['exercise'])
    expect(rows.find((r) => r.id === 'str')).toMatchObject({ toNext: 10, tomorrow: true })
    expect(rows.find((r) => r.id === 'vit')).toMatchObject({ tomorrow: true })
    expect(rows.find((r) => r.id === 'int')).toMatchObject({ tomorrow: false })
    // 상한 전이면 오늘 더 하면 된다
    expect(statRows(computeProgress(exercise(37))).find((r) => r.id === 'str')).toMatchObject({ tomorrow: false })
  })
})
