import { describe, test, expect } from 'vitest'
import { ACTIVITIES } from './activities'
import { MISSION_MINUTES, missionDays, missionFor, missionStars, todayMission } from './mission'
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

describe('오늘의 미션', () => {
  test('같은 날은 아침이든 밤이든 늘 같은 미션', () => {
    expect(missionFor(kst('2026-10-25T00:00:00'))).toEqual(missionFor(kst('2026-10-25T23:59:59')))
  })

  test('나흘 이어서 운동·공부·독서·휴식이 한 번씩 돌아가며 나온다', () => {
    const acts = [25, 26, 27, 28].map((d) => missionFor(kst(`2026-10-${d}T12:00:00`)).activity)
    expect(new Set(acts)).toEqual(new Set(['exercise', 'study', 'reading', 'relax']))
    expect(missionFor(kst('2026-10-29T12:00:00')).activity).toBe(acts[0])
  })

  test('달·해가 바뀌어도 하루씩 이어서 돈다', () => {
    const a = missionFor(kst('2026-12-31T12:00:00')).activity
    const b = missionFor(kst('2027-01-01T12:00:00')).activity
    const order: ActivityId[] = ['exercise', 'study', 'reading', 'relax']
    expect(order[(order.indexOf(a) + 1) % 4]).toBe(b)
  })

  test('2026-10-25 미션은 휴식 10분', () => {
    expect(missionFor(kst('2026-10-25T12:00:00'))).toEqual({ activity: 'relax', goal: 10 })
  })

  test('목표 분은 하루 상한 안이고 휴식은 상한보다 짧다', () => {
    for (const id of Object.keys(ACTIVITIES) as ActivityId[]) {
      expect(MISSION_MINUTES[id]).toBeGreaterThan(0)
      expect(MISSION_MINUTES[id]).toBeLessThanOrEqual(ACTIVITIES[id].dailyCapMinutes)
    }
    expect(MISSION_MINUTES.relax).toBeLessThan(ACTIVITIES.relax.dailyCapMinutes)
  })

  test('기록이 없으면 0분, 별 0', () => {
    const now = kst('2026-10-25T12:00:00')
    expect(todayMission([], now)).toEqual({ activity: 'relax', goal: 10, minutes: 0, done: false })
    expect(missionStars([])).toBe(0)
  })

  test('미션 활동의 분만 센다(다른 활동은 세지 않는다)', () => {
    const rs = [rec('exercise', '2026-10-25T08:00:00', '2026-10-25T09:00:00'), rec('relax', '2026-10-25T13:00:00', '2026-10-25T13:04:00')]
    expect(todayMission(rs, kst('2026-10-25T20:00:00'))).toEqual({ activity: 'relax', goal: 10, minutes: 4, done: false })
    rs.push(rec('relax', '2026-10-25T14:00:00', '2026-10-25T14:06:00'))
    expect(todayMission(rs, kst('2026-10-25T20:00:00')).done).toBe(true)
    expect(missionStars(rs)).toBe(1)
  })

  test('상한을 넘은 시간은 세지 않는다', () => {
    const rs = [rec('relax', '2026-10-25T10:00:00', '2026-10-25T12:00:00')]
    expect(todayMission(rs, kst('2026-10-25T20:00:00')).minutes).toBe(ACTIVITIES.relax.dailyCapMinutes)
  })

  test('자정을 넘긴 기록은 날짜별로 나눠 그날 미션에 센다', () => {
    // 10-25 휴식, 10-26 운동
    const rs = [rec('exercise', '2026-10-25T23:50:00', '2026-10-26T00:20:00')]
    expect(todayMission(rs, kst('2026-10-26T12:00:00'))).toEqual({ activity: 'exercise', goal: 20, minutes: 20, done: true })
    expect(missionDays(rs)).toEqual(new Set(['2026-10-26']))
  })

  test('미션 별은 미션을 채운 날 수다', () => {
    const rs = [
      rec('relax', '2026-10-25T08:00:00', '2026-10-25T08:10:00'), // 휴식 날 휴식 10분 → 별
      rec('exercise', '2026-10-26T08:00:00', '2026-10-26T08:19:00'), // 운동 날 19분 → 아님
      rec('study', '2026-10-27T08:00:00', '2026-10-27T08:15:00'), // 공부 날 공부 15분 → 별
      rec('study', '2026-10-28T08:00:00', '2026-10-28T09:00:00'), // 독서 날 공부만 → 아님
    ]
    expect(missionDays(rs)).toEqual(new Set(['2026-10-25', '2026-10-27']))
    expect(missionStars(rs)).toBe(2)
  })

  test('미션은 경험치·능력치를 바꾸지 않는다', () => {
    const rs = [rec('relax', '2026-10-25T08:00:00', '2026-10-25T08:10:00')]
    const before = computeProgress(rs)
    todayMission(rs, kst('2026-10-25T12:00:00'))
    missionStars(rs)
    expect(computeProgress(rs)).toEqual(before)
  })
})
