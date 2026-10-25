import { describe, test, expect } from 'vitest'
import { WEEKLY_GOAL_DAYS, doneWeeks, weekGoal, weekKey } from './week'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
const rec = (activity: ActivityId, a: string, b: string): ActivityRecord => ({
  id: `w${n++}`,
  activity,
  startedAt: kst(a),
  endedAt: kst(b),
})
/** 그날 아침 운동 m분 */
const day = (date: string, m = 30) => rec('exercise', `${date}T08:00:00`, `${date}T08:${String(m).padStart(2, '0')}:00`)
const days = (...dates: string[]) => dates.map((d) => day(d))

// 2026-10-19(월) ~ 2026-10-25(일)
describe('주간 목표', () => {
  test('목표는 한 주에 5일', () => {
    expect(WEEKLY_GOAL_DAYS).toBe(5)
  })

  test('주는 월요일에 시작한다', () => {
    expect(weekKey(kst('2026-10-19T00:00:00'))).toBe('2026-10-19')
    expect(weekKey(kst('2026-10-22T15:00:00'))).toBe('2026-10-19')
    expect(weekKey(kst('2026-10-25T23:59:59'))).toBe('2026-10-19')
    expect(weekKey(kst('2026-10-26T00:00:00'))).toBe('2026-10-26')
  })

  test('달과 해를 넘는 주', () => {
    expect(weekKey(kst('2026-11-01T12:00:00'))).toBe('2026-10-26')
    expect(weekKey(kst('2027-01-01T12:00:00'))).toBe('2026-12-28')
  })

  test('기록이 없으면 0일, 요일 7칸, 채운 주 0', () => {
    const w = weekGoal([], kst('2026-10-22T12:00:00'))
    expect(w.week).toBe('2026-10-19')
    expect(w.stamped).toBe(0)
    expect(w.goal).toBe(5)
    expect(w.done).toBe(false)
    expect(w.doneWeeks).toBe(0)
    expect(w.days.map((d) => d.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
  })

  test('요일 칸: 찍음·안 찍음·오늘·아직 안 옴', () => {
    const rs = days('2026-10-19', '2026-10-21', '2026-10-22')
    const w = weekGoal(rs, kst('2026-10-22T12:00:00'))
    expect(w.days.map((d) => d.stamped)).toEqual([true, false, true, true, false, false, false])
    expect(w.days.map((d) => d.today)).toEqual([false, false, false, true, false, false, false])
    expect(w.days.map((d) => d.future)).toEqual([false, false, false, false, true, true, true])
    expect(w.stamped).toBe(3)
    expect(w.done).toBe(false)
  })

  test('지난주·다음 주 도장은 이번 주에 세지 않음', () => {
    const rs = days('2026-10-18', '2026-10-20', '2026-10-26')
    expect(weekGoal(rs, kst('2026-10-22T12:00:00')).stamped).toBe(1)
  })

  test('하루 목표(30분)를 못 채운 날은 세지 않음', () => {
    const rs = [day('2026-10-19', 29), day('2026-10-20')]
    expect(weekGoal(rs, kst('2026-10-22T12:00:00')).stamped).toBe(1)
  })

  test('켜 두고 잊어도 상한 안만 센다: 휴식만 2시간이면 30분으로 하루 도장', () => {
    const rs = [rec('relax', '2026-10-19T08:00:00', '2026-10-19T10:00:00')]
    expect(weekGoal(rs, kst('2026-10-22T12:00:00')).stamped).toBe(1)
  })

  test('5일을 채우면 이번 주 목표 달성, 채운 주 수에도 센다', () => {
    const rs = days('2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23')
    const w = weekGoal(rs, kst('2026-10-23T20:00:00'))
    expect(w.stamped).toBe(5)
    expect(w.done).toBe(true)
    expect(w.doneWeeks).toBe(1)
  })

  test('7일 다 찍어도 한 주는 한 번만 센다', () => {
    const rs = days('2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25')
    expect(weekGoal(rs, kst('2026-10-25T20:00:00')).stamped).toBe(7)
    expect(doneWeeks(rs)).toBe(1)
  })

  test('채운 주 수는 지난 주들까지 센다(이어지지 않아도 됨)', () => {
    const rs = [
      // 10-05 주: 5일
      ...days('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'),
      // 10-12 주: 4일(못 채움)
      ...days('2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'),
      // 10-19 주: 월·수·금·토·일 5일
      ...days('2026-10-19', '2026-10-21', '2026-10-23', '2026-10-24', '2026-10-25'),
    ]
    expect(doneWeeks(rs)).toBe(2)
    const w = weekGoal(rs, kst('2026-10-26T09:00:00'))
    expect(w.week).toBe('2026-10-26')
    expect(w.stamped).toBe(0)
    expect(w.doneWeeks).toBe(2)
  })

  test('일요일 밤과 월요일 아침은 다른 주', () => {
    const rs = [
      ...days('2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'),
      rec('exercise', '2026-10-25T23:40:00', '2026-10-26T00:20:00'),
    ]
    // 일요일 20분 + 월요일 20분: 둘 다 30분이 안 돼 도장이 없다
    expect(weekGoal(rs, kst('2026-10-25T23:59:00')).stamped).toBe(4)
    expect(doneWeeks(rs)).toBe(0)
  })

  test('기록을 바꾸지 않는다', () => {
    const rs = days('2026-10-19', '2026-10-20')
    const copy = JSON.parse(JSON.stringify(rs))
    weekGoal(rs, kst('2026-10-22T12:00:00'))
    doneWeeks(rs)
    expect(rs).toEqual(copy)
  })
})
