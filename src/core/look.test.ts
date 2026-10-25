import { describe, test, expect } from 'vitest'
import { GROWTH_STAGES, growthStage, lookName, mainTraits, malangLook, TRAIT_LABELS } from './look'
import { computeProgress } from './progression'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
/** day 날짜에 activity 를 minutes 분 */
const on = (activity: ActivityId, day: string, minutes: number): ActivityRecord => {
  const start = kst(`${day}T08:00:00`)
  return { id: `r${n++}`, activity, startedAt: start, endedAt: start + minutes * 60_000 }
}
const mins = (m: Partial<Record<ActivityId, number>>): Record<ActivityId, number> => ({
  exercise: 0,
  study: 0,
  reading: 0,
  relax: 0,
  ...m,
})

describe('성장 단계', () => {
  test('아기 → 어린이 → 청소년 → 어른, 레벨 1·5·10·20부터', () => {
    expect(GROWTH_STAGES.map((s) => s.name)).toEqual(['아기', '어린이', '청소년', '어른'])
    expect(GROWTH_STAGES.map((s) => s.minLevel)).toEqual([1, 5, 10, 20])
  })

  test('몸 크기 배율은 1부터 단계마다 커지고 장면에 들어갈 만큼(1.3 이하)만 커진다', () => {
    const scales = GROWTH_STAGES.map((s) => s.scale)
    expect(scales[0]).toBe(1)
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1])
    expect(scales[scales.length - 1]).toBeLessThanOrEqual(1.3)
  })

  test('레벨로 단계와 다음 단계 레벨·남은 레벨을 정한다', () => {
    expect(growthStage(1)).toMatchObject({ index: 0, stage: { id: 'baby' }, nextLevel: 5, levelsToNext: 4 })
    expect(growthStage(4)).toMatchObject({ index: 0, nextLevel: 5, levelsToNext: 1 })
    expect(growthStage(5)).toMatchObject({ index: 1, stage: { id: 'kid' }, nextLevel: 10, levelsToNext: 5 })
    expect(growthStage(9)).toMatchObject({ index: 1, levelsToNext: 1 })
    expect(growthStage(10)).toMatchObject({ index: 2, stage: { id: 'teen' }, nextLevel: 20, levelsToNext: 10 })
    expect(growthStage(20)).toMatchObject({ index: 3, stage: { id: 'adult' }, nextLevel: null, levelsToNext: null })
    expect(growthStage(99)).toMatchObject({ index: 3, nextLevel: null })
  })

  test('레벨이 오르면 단계는 내려가지 않는다', () => {
    let prev = 0
    for (let level = 1; level <= 40; level++) {
      const { index } = growthStage(level)
      expect(index).toBeGreaterThanOrEqual(prev)
      prev = index
    }
  })
})

describe('특징(많이 한 활동)', () => {
  test('기록이 없으면 특징이 없다', () => {
    expect(mainTraits(mins({}))).toEqual([])
  })

  test('가장 많이 한 활동 하나', () => {
    expect(mainTraits(mins({ exercise: 100, study: 30 }))).toEqual(['exercise'])
    expect(mainTraits(mins({ reading: 40 }))).toEqual(['reading'])
    expect(mainTraits(mins({ relax: 30, exercise: 5 }))).toEqual(['relax'])
  })

  test('두 번째가 첫째의 3/4 이상이면 둘(많은 순)', () => {
    expect(mainTraits(mins({ exercise: 100, study: 75 }))).toEqual(['exercise', 'study'])
    expect(mainTraits(mins({ exercise: 100, study: 74 }))).toEqual(['exercise'])
    expect(mainTraits(mins({ study: 60, reading: 80 }))).toEqual(['reading', 'study'])
  })

  test('셋 이상 비슷해도 둘까지만, 같으면 운동·공부·독서·휴식 순', () => {
    expect(mainTraits(mins({ exercise: 50, study: 50, reading: 50, relax: 50 }))).toEqual(['exercise', 'study'])
    expect(mainTraits(mins({ relax: 20, reading: 20 }))).toEqual(['reading', 'relax'])
  })
})

describe('모습 이름', () => {
  test('특징 + 단계 + 말랑이', () => {
    expect(TRAIT_LABELS.exercise).toBe('운동파')
    expect(lookName(['exercise'], GROWTH_STAGES[1])).toBe('운동파 어린이 말랑이')
    expect(lookName(['study', 'reading'], GROWTH_STAGES[2])).toBe('공부·독서파 청소년 말랑이')
    expect(lookName([], GROWTH_STAGES[0])).toBe('아기 말랑이')
  })
})

describe('기록에서 모습', () => {
  test('빈 기록은 특징 없는 아기 말랑이', () => {
    expect(malangLook([])).toMatchObject({ index: 0, traits: [], name: '아기 말랑이', nextLevel: 5, levelsToNext: 4 })
  })

  test('운동 70분이면 레벨 5 → 운동파 어린이 말랑이', () => {
    const records = [on('exercise', '2026-10-20', 70)]
    expect(computeProgress(records).level).toBe(5)
    expect(malangLook(records)).toMatchObject({ stage: { id: 'kid' }, traits: ['exercise'], name: '운동파 어린이 말랑이' })
  })

  test('하루 상한을 넘은 시간은 특징에 세지 않는다', () => {
    // 휴식 3시간을 해도 상한 30분만 인정 → 공부 50분이 더 많다(30 < 50의 3/4)
    const records = [on('relax', '2026-10-20', 180), on('study', '2026-10-21', 50)]
    expect(malangLook(records).traits).toEqual(['study'])
  })

  test('1분이 안 되는 기록만 있으면 특징이 없다', () => {
    const start = kst('2026-10-20T08:00:00')
    const records: ActivityRecord[] = [{ id: 'x', activity: 'reading', startedAt: start, endedAt: start + 30_000 }]
    expect(malangLook(records).traits).toEqual([])
  })

  test('기록을 바꾸지 않는다', () => {
    const records = [on('exercise', '2026-10-20', 70)]
    const copy = JSON.parse(JSON.stringify(records))
    malangLook(records)
    expect(records).toEqual(copy)
  })
})
