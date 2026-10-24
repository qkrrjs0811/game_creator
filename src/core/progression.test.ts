import { describe, test, expect } from 'vitest'
import { computeProgress, creditedMinutes, expToNext } from './progression'

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
    expect(p.stats).toEqual({ str: 8, vit: 8, int: 5 })
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
