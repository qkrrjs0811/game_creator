import { describe, test, expect } from 'vitest'
import { DAILY_GOAL_MINUTES, goalDays, goalStreak, stampCount, todayGoal } from './goal'
import { computeProgress } from './progression'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
const rec = (activity: ActivityId, a: string, b: string): ActivityRecord => ({
  id: `r${n++}`,
  activity,
  startedAt: kst(a),
  endedAt: kst(b),
})
/** 그날 아침 운동 m분 */
const day = (date: string, m = 30) => rec('exercise', `${date}T08:00:00`, `${date}T08:${String(m).padStart(2, '0')}:00`)

describe('하루 목표', () => {
  test('목표는 30분', () => {
    expect(DAILY_GOAL_MINUTES).toBe(30)
  })

  test('기록이 없으면 오늘 0분, 도장 0, 이어 온 날 0', () => {
    const now = kst('2026-10-25T12:00:00')
    expect(todayGoal([], now)).toEqual({ minutes: 0, goal: 30, done: false })
    expect(stampCount([])).toBe(0)
    expect(goalStreak([], now)).toBe(0)
  })

  test('여러 활동을 합쳐 오늘 분을 센다', () => {
    const rs = [
      rec('exercise', '2026-10-25T08:00:00', '2026-10-25T08:10:00'),
      rec('study', '2026-10-25T09:00:00', '2026-10-25T09:12:00'),
    ]
    expect(todayGoal(rs, kst('2026-10-25T20:00:00'))).toEqual({ minutes: 22, goal: 30, done: false })
    rs.push(rec('reading', '2026-10-25T21:00:00', '2026-10-25T21:08:00'))
    expect(todayGoal(rs, kst('2026-10-25T22:00:00'))).toEqual({ minutes: 30, goal: 30, done: true })
  })

  test('오늘 분은 목표를 넘어도 실제 분을 보여 준다', () => {
    expect(todayGoal([day('2026-10-25', 50)], kst('2026-10-25T12:00:00')).minutes).toBe(50)
  })

  test('어제 기록은 오늘 목표에 세지 않음', () => {
    expect(todayGoal([day('2026-10-24')], kst('2026-10-25T12:00:00')).minutes).toBe(0)
  })

  test('상한을 넘긴 시간은 목표에 세지 않음: 휴식만 2시간 켜 둬도 30분', () => {
    const rs = [rec('relax', '2026-10-25T08:00:00', '2026-10-25T10:00:00')]
    expect(todayGoal(rs, kst('2026-10-25T12:00:00')).minutes).toBe(30)
  })

  test('나눠 한 휴식은 합쳐 상한(30분)까지만 센다', () => {
    const rs = [rec('relax', '2026-10-25T08:00:00', '2026-10-25T08:20:00'), rec('relax', '2026-10-25T09:00:00', '2026-10-25T09:40:00')]
    expect(todayGoal(rs, kst('2026-10-25T12:00:00'))).toEqual({ minutes: 30, goal: 30, done: true })
    const short = [rec('relax', '2026-10-25T08:00:00', '2026-10-25T08:20:00'), rec('relax', '2026-10-25T09:00:00', '2026-10-25T09:05:00')]
    expect(todayGoal(short, kst('2026-10-25T12:00:00')).done).toBe(false)
  })

  test('자정을 걸친 세션은 날짜별로 나눠 센다', () => {
    const rs = [rec('exercise', '2026-10-24T23:45:00', '2026-10-25T00:20:00')]
    expect(todayGoal(rs, kst('2026-10-24T23:59:00')).minutes).toBe(15)
    expect(todayGoal(rs, kst('2026-10-25T08:00:00')).minutes).toBe(20)
    expect(stampCount(rs)).toBe(0)
  })

  test('끝이 시작보다 이른 기록은 0분', () => {
    expect(todayGoal([rec('exercise', '2026-10-25T10:00:00', '2026-10-25T09:00:00')], kst('2026-10-25T12:00:00')).minutes).toBe(0)
  })
})

describe('도장', () => {
  test('목표를 채운 날마다 도장 하나, 하루에 여러 번 채워도 하나', () => {
    const rs = [day('2026-10-20'), day('2026-10-20'), day('2026-10-22', 29), day('2026-10-23', 45)]
    expect(stampCount(rs)).toBe(2)
    expect([...goalDays(rs)].sort()).toEqual(['2026-10-20', '2026-10-23'])
  })

  test('같은 날 짧은 세션 여럿을 합쳐 도장', () => {
    const rs = [day('2026-10-20', 10), rec('study', '2026-10-20T12:00:00', '2026-10-20T12:10:00'), rec('relax', '2026-10-20T22:00:00', '2026-10-20T22:10:00')]
    expect(stampCount(rs)).toBe(1)
  })

  test('날짜 키는 YYYY-MM-DD(한 자리 달·날은 0을 붙임)', () => {
    expect([...goalDays([day('2026-03-05')])]).toEqual(['2026-03-05'])
  })
})

describe('이어 온 날', () => {
  const rs = [day('2026-10-21'), day('2026-10-22'), day('2026-10-23'), day('2026-10-24')]

  test('오늘 채웠으면 오늘까지 센다', () => {
    expect(goalStreak([...rs, day('2026-10-25')], kst('2026-10-25T20:00:00'))).toBe(5)
  })

  test('오늘 아직 못 채웠어도 어제까지 이어 왔으면 끊기지 않음', () => {
    expect(goalStreak(rs, kst('2026-10-25T07:00:00'))).toBe(4)
  })

  test('어제를 건너뛰면 끊김', () => {
    expect(goalStreak(rs, kst('2026-10-26T07:00:00'))).toBe(0)
    expect(goalStreak([...rs, day('2026-10-26')], kst('2026-10-26T20:00:00'))).toBe(1)
  })

  test('중간에 빈 날이 있으면 그 뒤부터 센다', () => {
    const gap = [day('2026-10-20'), day('2026-10-22'), day('2026-10-23')]
    expect(goalStreak(gap, kst('2026-10-23T20:00:00'))).toBe(2)
  })

  test('달·해가 바뀌어도 이어 센다', () => {
    const wrap = [day('2025-12-30'), day('2025-12-31'), day('2026-01-01')]
    expect(goalStreak(wrap, kst('2026-01-01T20:00:00'))).toBe(3)
  })
})

test('하루 목표 계산은 경험치·능력치를 바꾸지 않음(기록만 읽음)', () => {
  const rs = [day('2026-10-24'), day('2026-10-25', 12)]
  const before = computeProgress(rs)
  const copy = JSON.parse(JSON.stringify(rs))
  todayGoal(rs, kst('2026-10-25T12:00:00'))
  stampCount(rs)
  goalStreak(rs, kst('2026-10-25T12:00:00'))
  expect(rs).toEqual(copy)
  expect(computeProgress(rs)).toEqual(before)
})
