import { describe, test, expect } from 'vitest'
import { goalStreak, stampCount } from './goal'
import { computeProgress } from './progression'
import { REST_EVERY_STAMPS, REST_MAX, restStreak } from './rest'
import type { ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
/** 그날 아침 운동 m분 */
const day = (date: string, m = 30): ActivityRecord => ({
  id: `r${n++}`,
  activity: 'exercise',
  startedAt: kst(`${date}T08:00:00`),
  endedAt: kst(`${date}T08:${String(m).padStart(2, '0')}:00`),
})
/** 2026-10-01부터 하루씩 n일 (빼고 싶은 날짜는 skip) */
const run = (from: number, to: number, skip: number[] = []) => {
  const rs: ActivityRecord[] = []
  for (let d = from; d <= to; d++) if (!skip.includes(d)) rs.push(day(`2026-10-${String(d).padStart(2, '0')}`))
  return rs
}

describe('쉼표', () => {
  test('도장 7개마다 하나, 최대 2개', () => {
    expect(REST_EVERY_STAMPS).toBe(7)
    expect(REST_MAX).toBe(2)
  })

  test('기록이 없으면 모두 0', () => {
    expect(restStreak([], kst('2026-10-25T12:00:00'))).toEqual({
      streak: 0,
      rests: 0,
      toNextRest: 7,
      restedDays: [],
    })
  })

  test('도장 6개면 쉼표 없음, 7개면 하나, 다음까지 남은 도장 수', () => {
    expect(restStreak(run(1, 6), kst('2026-10-06T20:00:00'))).toMatchObject({ streak: 6, rests: 0, toNextRest: 1 })
    expect(restStreak(run(1, 7), kst('2026-10-07T20:00:00'))).toMatchObject({ streak: 7, rests: 1, toNextRest: 7 })
    expect(restStreak(run(1, 9), kst('2026-10-09T20:00:00'))).toMatchObject({ rests: 1, toNextRest: 5 })
  })

  test('쉼표는 2개까지만 들고 있음', () => {
    expect(restStreak(run(1, 21), kst('2026-10-21T20:00:00'))).toMatchObject({ streak: 21, rests: 2 })
  })

  test('하루 빈 날을 쉼표로 메워 이어 간다(지킨 날도 센다)', () => {
    const rs = run(1, 10, [8])
    const r = restStreak(rs, kst('2026-10-10T20:00:00'))
    expect(r).toEqual({ streak: 10, rests: 0, toNextRest: 5, restedDays: ['2026-10-08'] })
    expect(goalStreak(rs, kst('2026-10-10T20:00:00'))).toBe(2)
  })

  test('쉼표가 없으면 하루 빈 날도 끊김', () => {
    expect(restStreak(run(1, 5, [3]), kst('2026-10-05T20:00:00'))).toMatchObject({ streak: 2, restedDays: [] })
  })

  test('이틀 이상 빈 곳은 메우지 않고 쉼표도 쓰지 않음', () => {
    const r = restStreak(run(1, 12, [8, 9]), kst('2026-10-12T20:00:00'))
    expect(r).toMatchObject({ streak: 3, rests: 1, restedDays: [] })
  })

  test('어제를 못 찍은 오늘: 아직 오늘을 안 찍어도 어제를 지켜 준다', () => {
    const r = restStreak(run(1, 7), kst('2026-10-09T07:00:00'))
    expect(r).toEqual({ streak: 8, rests: 0, toNextRest: 7, restedDays: ['2026-10-08'] })
  })

  test('어제·그제를 다 못 찍었으면 끊기고 쉼표는 남는다', () => {
    expect(restStreak(run(1, 7), kst('2026-10-10T07:00:00'))).toMatchObject({ streak: 0, rests: 1, restedDays: [] })
  })

  test('지킨 날은 도장 수에 넣지 않음', () => {
    const rs = run(1, 10, [8])
    restStreak(rs, kst('2026-10-10T20:00:00'))
    expect(stampCount(rs)).toBe(9)
    // 지킨 날을 빼고 도장 9개 → 7개째에 하나 얻고, 다음까지 5개
    expect(restStreak(rs, kst('2026-10-10T20:00:00')).toNextRest).toBe(5)
  })

  test('쉼표 두 개로 따로 떨어진 하루씩 두 번 지킨다', () => {
    const r = restStreak(run(1, 20, [16, 18]), kst('2026-10-20T20:00:00'))
    expect(r).toMatchObject({ streak: 20, rests: 0, restedDays: ['2026-10-16', '2026-10-18'] })
  })

  test('어떤 기록에서도 지금 이어 온 날보다 짧아지지 않음', () => {
    // 1~25일 중 일부를 빼는 여러 모양(비트 패턴)으로 확인
    for (let mask = 0; mask < 4096; mask += 7) {
      const skip: number[] = []
      for (let b = 0; b < 12; b++) if (mask & (1 << b)) skip.push(b * 2 + 1)
      const rs = run(1, 25, skip)
      for (const now of [kst('2026-10-25T20:00:00'), kst('2026-10-26T07:00:00'), kst('2026-10-27T07:00:00')]) {
        expect(restStreak(rs, now).streak).toBeGreaterThanOrEqual(goalStreak(rs, now))
      }
    }
  })

  test('기록만 읽고 경험치·능력치를 바꾸지 않음', () => {
    const rs = run(1, 10, [8])
    const before = computeProgress(rs)
    const copy = JSON.parse(JSON.stringify(rs))
    restStreak(rs, kst('2026-10-10T20:00:00'))
    expect(rs).toEqual(copy)
    expect(computeProgress(rs)).toEqual(before)
  })
})
