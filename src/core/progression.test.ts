import { describe, test, expect } from 'vitest'
import { computeProgress, creditedMinutes, expToNext, todayStatus } from './progression'

const kst = (s: string) => Date.parse(`${s}+09:00`)
const rec = (a: string, b: string, id = a) => ({ id, activity: 'exercise' as const, startedAt: kst(a), endedAt: kst(b) })

describe('progression', () => {
  test('30분 운동 → 경험치 300, 레벨 3', () => {
    const p = computeProgress([rec('2026-10-24T19:00:00', '2026-10-24T19:30:00')])
    expect(p.creditedMinutes.exercise).toBe(30)
    expect(p.exp).toBe(300)
    expect(p.level).toBe(3)
    expect(p.expIntoLevel).toBe(50)
    expect(p.expForNextLevel).toBe(200)
    expect(p.stats).toEqual({ str: 8, vit: 8, int: 5, focus: 5 })
    expect(p.skillPoints).toBe(2)
  })

  test('하루 상한 180분', () => {
    expect(creditedMinutes([rec('2026-10-24T08:00:00', '2026-10-24T12:00:00')], 'exercise')).toBe(180)
  })

  test('같은 날 여러 세션은 합쳐서 상한 적용', () => {
    const rs = [rec('2026-10-24T08:00:00', '2026-10-24T10:00:00', 'a'), rec('2026-10-24T18:00:00', '2026-10-24T20:00:00', 'b')]
    expect(creditedMinutes(rs, 'exercise')).toBe(180)
  })

  test('자정을 넘긴 세션은 날짜별로 나눠 각각 상한', () => {
    expect(creditedMinutes([rec('2026-10-24T22:00:00', '2026-10-25T02:00:00')], 'exercise')).toBe(240)
    expect(creditedMinutes([rec('2026-10-24T23:00:00', '2026-10-25T01:00:00')], 'exercise')).toBe(120)
  })

  test('자정을 걸친 짧은 세션도 분을 잃지 않음', () => {
    expect(creditedMinutes([rec('2026-10-24T23:59:30', '2026-10-25T00:00:30')], 'exercise')).toBe(1)
    expect(creditedMinutes([rec('2026-10-24T23:50:30', '2026-10-25T00:20:30')], 'exercise')).toBe(30)
  })

  test('끝이 시작보다 이르면 0분', () => {
    expect(creditedMinutes([rec('2026-10-24T10:00:00', '2026-10-24T09:00:00')], 'exercise')).toBe(0)
  })

  test('기록 없음 → 레벨 1', () => {
    const p = computeProgress([])
    expect(p).toMatchObject({ exp: 0, level: 1, expIntoLevel: 0, expForNextLevel: 100, skillPoints: 0 })
  })

  test('expToNext', () => {
    expect([1, 2, 3].map(expToNext)).toEqual([100, 150, 200])
  })
})

describe('todayStatus', () => {
  test('오늘 인정된 분과 상한', () => {
    const rs = [rec('2026-10-24T09:00:00', '2026-10-24T09:30:00', 'a'), rec('2026-10-25T08:00:00', '2026-10-25T08:42:30', 'b')]
    expect(todayStatus(rs, 'exercise', kst('2026-10-25T12:00:00'))).toEqual({ minutes: 42, cap: 180, reached: false })
  })

  test('어제 시작해 오늘로 넘어온 세션은 오늘 부분만 셈', () => {
    const rs = [rec('2026-10-24T23:00:00', '2026-10-25T00:20:00')]
    expect(todayStatus(rs, 'exercise', kst('2026-10-25T01:00:00')).minutes).toBe(20)
  })

  test('상한에 닿으면 180분에서 멈추고 reached', () => {
    const rs = [rec('2026-10-25T08:00:00', '2026-10-25T12:00:00')]
    expect(todayStatus(rs, 'exercise', kst('2026-10-25T13:00:00'))).toEqual({ minutes: 180, cap: 180, reached: true })
  })

  test('기록이 없으면 0분', () => {
    expect(todayStatus([], 'exercise', kst('2026-10-25T13:00:00'))).toEqual({ minutes: 0, cap: 180, reached: false })
  })
})

describe('공부', () => {
  const study = (a: string, b: string, id = a) => ({ id, activity: 'study' as const, startedAt: kst(a), endedAt: kst(b) })

  test('공부 5분마다 지능이 1 오르고 힘·체력은 그대로, 경험치는 함께 쌓인다', () => {
    const p = computeProgress([study('2026-10-24T19:00:00', '2026-10-24T19:30:00')])
    expect(p.creditedMinutes).toEqual({ exercise: 0, study: 30, reading: 0 })
    expect(p.stats).toEqual({ str: 5, vit: 5, int: 11, focus: 5 })
    expect(p.exp).toBe(300)
  })

  test('공부 하루 상한은 120분이고 운동 상한과 따로 센다', () => {
    const rs = [study('2026-10-24T08:00:00', '2026-10-24T11:00:00'), rec('2026-10-24T12:00:00', '2026-10-24T13:00:00')]
    expect(creditedMinutes(rs, 'study')).toBe(120)
    expect(creditedMinutes(rs, 'exercise')).toBe(60)
    expect(todayStatus(rs, 'study', kst('2026-10-24T20:00:00'))).toEqual({ minutes: 120, cap: 120, reached: true })
    expect(todayStatus(rs, 'exercise', kst('2026-10-24T20:00:00'))).toEqual({ minutes: 60, cap: 180, reached: false })
    expect(computeProgress(rs).stats).toEqual({ str: 11, vit: 11, int: 29, focus: 5 })
  })

  test('운동만 한 기록은 예전과 같다', () => {
    const p = computeProgress([rec('2026-10-24T19:00:00', '2026-10-24T21:00:00')])
    expect(p.stats).toEqual({ str: 17, vit: 17, int: 5, focus: 5 })
    expect(p.exp).toBe(1200)
  })
})

describe('독서', () => {
  const read = (a: string, b: string, id = a) => ({ id, activity: 'reading' as const, startedAt: kst(a), endedAt: kst(b) })

  test('독서 5분마다 집중이 1 오르고 지능·힘·체력은 그대로, 경험치는 함께 쌓인다', () => {
    const p = computeProgress([read('2026-10-24T19:00:00', '2026-10-24T19:30:00')])
    expect(p.creditedMinutes).toEqual({ exercise: 0, study: 0, reading: 30 })
    expect(p.stats).toEqual({ str: 5, vit: 5, int: 5, focus: 11 })
    expect(p.exp).toBe(300)
  })

  test('독서 하루 상한은 120분이고 공부·운동 상한과 따로 센다', () => {
    const rs = [
      read('2026-10-24T08:00:00', '2026-10-24T11:00:00'),
      { id: 's', activity: 'study' as const, startedAt: kst('2026-10-24T12:00:00'), endedAt: kst('2026-10-24T12:30:00') },
      rec('2026-10-24T13:00:00', '2026-10-24T14:00:00'),
    ]
    expect(creditedMinutes(rs, 'reading')).toBe(120)
    expect(todayStatus(rs, 'reading', kst('2026-10-24T20:00:00'))).toEqual({ minutes: 120, cap: 120, reached: true })
    expect(todayStatus(rs, 'study', kst('2026-10-24T20:00:00'))).toEqual({ minutes: 30, cap: 120, reached: false })
    expect(computeProgress(rs).stats).toEqual({ str: 11, vit: 11, int: 11, focus: 29 })
    expect(computeProgress(rs).exp).toBe(2100)
  })
})
