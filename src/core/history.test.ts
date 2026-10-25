import { describe, test, expect } from 'vitest'
import { activityTotals, bestDay, dayMinutes, recentDays, recordSummary, weekTotals } from './history'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
const rec = (activity: ActivityId, a: string, b: string): ActivityRecord => ({
  id: `h${n++}`,
  activity,
  startedAt: kst(a),
  endedAt: kst(b),
})

// 2026-10-19(월) ~ 2026-10-25(일)
const NOW = kst('2026-10-25T12:00:00')

describe('기록 돌아보기', () => {
  test('날짜별·활동별 인정 분', () => {
    const m = dayMinutes([
      rec('exercise', '2026-10-24T08:00:00', '2026-10-24T08:20:00'),
      rec('exercise', '2026-10-24T18:00:00', '2026-10-24T18:10:30'),
      rec('study', '2026-10-24T20:00:00', '2026-10-24T20:45:00'),
    ])
    const day = m.get('2026-10-24')!
    expect(day.minutes).toEqual({ exercise: 30, study: 45, reading: 0, relax: 0 })
    expect(day.total).toBe(75)
  })

  test('하루 상한 안의 분만 센다', () => {
    const m = dayMinutes([
      rec('relax', '2026-10-24T08:00:00', '2026-10-24T10:00:00'),
      rec('exercise', '2026-10-24T10:00:00', '2026-10-24T14:00:00'),
    ])
    const day = m.get('2026-10-24')!
    expect(day.minutes.relax).toBe(30)
    expect(day.minutes.exercise).toBe(180)
    expect(day.total).toBe(210)
  })

  test('자정을 넘긴 기록은 날짜마다 나눈다', () => {
    const m = dayMinutes([rec('reading', '2026-10-23T23:40:00', '2026-10-24T00:15:00')])
    expect(m.get('2026-10-23')!.minutes.reading).toBe(20)
    expect(m.get('2026-10-24')!.minutes.reading).toBe(15)
  })

  test('최근 7일 막대: 6일 전부터 오늘까지, 요일과 오늘·도장 표시', () => {
    const days = recentDays(
      [
        rec('exercise', '2026-10-25T08:00:00', '2026-10-25T08:30:00'),
        rec('study', '2026-10-21T08:00:00', '2026-10-21T08:10:00'),
      ],
      NOW,
    )
    expect(days.map((d) => d.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(days.map((d) => d.today)).toEqual([false, false, false, false, false, false, true])
    expect(days[2].minutes.study).toBe(10)
    expect(days[2].total).toBe(10)
    expect(days[2].stamped).toBe(false)
    expect(days[6].total).toBe(30)
    expect(days[6].stamped).toBe(true)
    expect(days[0].total).toBe(0)
    expect(days[0].minutes).toEqual({ exercise: 0, study: 0, reading: 0, relax: 0 })
  })

  test('최근 날 수와 끝 날을 바꿀 수 있다(달을 넘어도)', () => {
    const days = recentDays([], kst('2026-11-02T09:00:00'), 4)
    expect(days.map((d) => d.key)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  test('이번 주·지난주 합계와 차이', () => {
    const w = weekTotals(
      [
        rec('exercise', '2026-10-13T08:00:00', '2026-10-13T09:00:00'),
        rec('study', '2026-10-18T22:00:00', '2026-10-18T22:30:00'),
        rec('exercise', '2026-10-20T08:00:00', '2026-10-20T09:00:00'),
        rec('reading', '2026-10-25T08:00:00', '2026-10-25T09:10:00'),
        // 지지난주는 세지 않는다
        rec('exercise', '2026-10-11T08:00:00', '2026-10-11T09:00:00'),
      ],
      NOW,
    )
    expect(w).toEqual({ thisWeek: 130, lastWeek: 90, diff: 40 })
  })

  test('지난주보다 덜 했으면 차이가 음수', () => {
    const w = weekTotals([rec('exercise', '2026-10-13T08:00:00', '2026-10-13T09:00:00')], NOW)
    expect(w).toEqual({ thisWeek: 0, lastWeek: 60, diff: -60 })
  })

  test('활동별 누적 인정 분', () => {
    expect(
      activityTotals([
        rec('exercise', '2026-10-13T08:00:00', '2026-10-13T12:00:00'),
        rec('exercise', '2026-10-14T08:00:00', '2026-10-14T08:15:00'),
        rec('relax', '2026-10-14T09:00:00', '2026-10-14T09:20:00'),
      ]),
    ).toEqual({ exercise: 195, study: 0, reading: 0, relax: 20 })
  })

  test('가장 많이 한 날(같으면 먼저 한 날)', () => {
    expect(bestDay([])).toBeNull()
    expect(
      bestDay([
        rec('exercise', '2026-10-13T08:00:00', '2026-10-13T08:40:00'),
        rec('study', '2026-10-15T08:00:00', '2026-10-15T08:40:00'),
        rec('reading', '2026-10-14T08:00:00', '2026-10-14T08:20:00'),
        rec('relax', '2026-10-14T09:00:00', '2026-10-14T09:10:00'),
      ]),
    ).toEqual({ key: '2026-10-13', minutes: 40 })
  })

  test('1분도 안 되는 기록만 있으면 가장 많이 한 날이 없다', () => {
    expect(bestDay([rec('exercise', '2026-10-13T08:00:00', '2026-10-13T08:00:30')])).toBeNull()
  })

  test('한데 모은 요약과 기록 없음', () => {
    const empty = recordSummary([], NOW)
    expect(empty.empty).toBe(true)
    expect(empty.days).toHaveLength(7)
    expect(empty.best).toBeNull()
    expect(empty.week).toEqual({ thisWeek: 0, lastWeek: 0, diff: 0 })

    const s = recordSummary([rec('exercise', '2026-10-24T08:00:00', '2026-10-24T08:30:00')], NOW)
    expect(s.empty).toBe(false)
    expect(s.totals.exercise).toBe(30)
    expect(s.best).toEqual({ key: '2026-10-24', minutes: 30 })
    expect(s.week.thisWeek).toBe(30)
    expect(s.days[5].total).toBe(30)
  })

  test('기록을 바꾸지 않는다', () => {
    const records = [rec('exercise', '2026-10-24T08:00:00', '2026-10-24T08:30:00')]
    const copy = JSON.parse(JSON.stringify(records))
    recordSummary(records, NOW)
    expect(records).toEqual(copy)
  })
})
