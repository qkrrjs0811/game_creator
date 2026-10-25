import { describe, test, expect } from 'vitest'
import { goalStreak, stampCount } from './goal'
import { computeProgress } from './progression'
import { REST_EVERY_STAMPS, REST_MAX, parseSeenRests, restEarnedNow, restStreak, restedInMonth, restedYesterday, restText } from './rest'
import { achievementProgress, bestStreak } from './achievements'
import { chatLines } from './chatter'
import { upcomingRewards } from './rewards'
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
      best: 0,
      earned: 0,
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
    expect(r).toEqual({ streak: 10, rests: 0, toNextRest: 5, restedDays: ['2026-10-08'], best: 10, earned: 1 })
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
    expect(r).toEqual({ streak: 8, rests: 0, toNextRest: 7, restedDays: ['2026-10-08'], best: 7, earned: 1 })
    // best 는 도장 찍은 날에만 늘린다: 오늘을 못 찍어 내일 지킨 날이 풀려도 업적이 내려가지 않게
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

  test('가장 길게 이어 온 날(best)은 끊겨도 남는다', () => {
    expect(restStreak(run(1, 12, [8, 9]), kst('2026-10-12T20:00:00'))).toMatchObject({ streak: 3, best: 7 })
  })
})

describe('쉼표를 쓰는 곳', () => {
  // 1~10일 중 8일만 빠짐: 쉼표로 10일 이어 옴(쉼표 없이는 2일)
  const rs = run(1, 10, [8])
  const now = kst('2026-10-10T20:00:00')

  test('업적의 가장 긴 이어 온 날도 쉼표로 지킨 날을 넣어 센다', () => {
    expect(bestStreak(rs)).toBe(10)
    expect(achievementProgress(rs).find((a) => a.kind === 'streak' && a.goal === 7)!.done).toBe(true)
    expect(bestStreak([])).toBe(0)
  })

  test('업적의 가장 긴 이어 온 날은 쉼표 없는 셈보다 짧아지지 않음', () => {
    for (let mask = 0; mask < 4096; mask += 11) {
      const skip: number[] = []
      for (let b = 0; b < 12; b++) if (mask & (1 << b)) skip.push(b * 2 + 2)
      const records = run(1, 25, skip)
      // 쉼표 없이 센 가장 긴 날 = 날마다 저녁의 goalStreak 중 가장 큰 값
      let plain = 0
      for (let d = 1; d <= 25; d++) plain = Math.max(plain, goalStreak(records, kst(`2026-10-${String(d).padStart(2, '0')}T20:00:00`)))
      expect(bestStreak(records)).toBeGreaterThanOrEqual(plain)
    }
  })

  test('말랑이 한마디의 이어 온 날', () => {
    const lines = chatLines({ records: rs, stageProgress: 0, skills: [], now, lastSeen: now - 60_000 })
    expect(lines.find((l) => l.kind === 'streak')?.text).toBe('🔥 10일째 같이 하는 중!')
  })

  test('곧 받을 보상의 이어 하기 업적은 쉼표로 이어 온 날부터 센다', () => {
    // 1~28일 중 20일만 빠짐: 쉼표로 28일(쉼표 없이는 8일)
    const records = run(1, 28, [20])
    const rewards = upcomingRewards({ records, stageProgress: 0, skills: [], now: kst('2026-10-28T20:00:00') })
    const streak = rewards.find((r) => r.kind === 'achievement')!
    expect(streak).toMatchObject({ value: 28, goal: 30, need: '2일 더 이어 하기' })
  })
})

describe('도장판 쉼표 표시', () => {
  test('그 달에 쉼표로 지킨 날의 일(日)만 고른다', () => {
    expect(restedInMonth(['2026-09-30', '2026-10-09', '2026-10-21', '2026-11-01'], 2026, 10)).toEqual([9, 21])
    expect(restedInMonth([], 2026, 10)).toEqual([])
  })

  test('기록에서 지킨 날이 달력에 이어짐', () => {
    const r = restStreak(run(1, 12, [9]), kst('2026-10-12T20:00:00'))
    expect(restedInMonth(r.restedDays, 2026, 10)).toEqual([9])
  })

  test('쉼표 수와 다음 쉼표까지 남은 도장', () => {
    expect(restText({ rests: 1, toNextRest: 3 })).toBe('🛟 쉼표 1 / 2개 · 다음 쉼표까지 도장 3개')
    expect(restText({ rests: 0, toNextRest: 7 })).toBe('🛟 쉼표 0 / 2개 · 다음 쉼표까지 도장 7개')
  })

  test('가득 들고 있으면 더 모으지 않는다고 알려 줌', () => {
    expect(restText({ rests: 2, toNextRest: 4 })).toBe('🛟 쉼표 2 / 2개 · 가득 찼어요')
  })
})

describe('쉼표 알림', () => {
  test('실제로 얻은 쉼표 수(가득 차서 버려진 것은 빼고)', () => {
    expect(restStreak(run(1, 6), kst('2026-10-06T20:00:00')).earned).toBe(0)
    expect(restStreak(run(1, 7), kst('2026-10-07T20:00:00')).earned).toBe(1)
    expect(restStreak(run(1, 14), kst('2026-10-14T20:00:00')).earned).toBe(2)
    // 21번째 도장에서 얻은 쉼표는 가득 차서 버려짐
    expect(restStreak(run(1, 21), kst('2026-10-21T20:00:00')).earned).toBe(2)
    // 쉼표를 쓴 뒤 다시 얻으면 늘어남
    expect(restStreak(run(1, 22, [8]), kst('2026-10-22T20:00:00')).earned).toBe(3)
  })

  test('얻은 쉼표 수는 기록이 늘어도 내려가지 않음', () => {
    let prev = 0
    for (let d = 1; d <= 30; d++) {
      const e = restStreak(run(1, d, [8, 15, 16]), kst(`2026-10-${String(d).padStart(2, '0')}T20:00:00`)).earned
      expect(e).toBeGreaterThanOrEqual(prev)
      prev = e
    }
  })

  test('어제를 쉼표로 지켰는지', () => {
    const r = restStreak(run(1, 7), kst('2026-10-09T07:00:00'))
    expect(restedYesterday(r.restedDays, kst('2026-10-09T07:00:00'))).toBe(true)
    const r2 = restStreak(run(1, 10, [8]), kst('2026-10-10T20:00:00'))
    expect(restedYesterday(r2.restedDays, kst('2026-10-10T20:00:00'))).toBe(false)
    expect(restedYesterday(r2.restedDays, kst('2026-10-09T20:00:00'))).toBe(true)
  })

  test('본 쉼표 수 읽기', () => {
    expect(parseSeenRests(null)).toBeNull()
    expect(parseSeenRests('abc')).toBeNull()
    expect(parseSeenRests('-1')).toBeNull()
    expect(parseSeenRests('2')).toBe(2)
  })

  test('새로 얻었을 때만 한 번 띄움, 처음 여는 창은 기억만 함', () => {
    expect(restEarnedNow(1, null)).toEqual({ show: false, remember: 1 })
    expect(restEarnedNow(1, 0)).toEqual({ show: true, remember: 1 })
    expect(restEarnedNow(1, 1)).toEqual({ show: false, remember: null })
    expect(restEarnedNow(0, 0)).toEqual({ show: false, remember: null })
    expect(restEarnedNow(1, 3)).toEqual({ show: false, remember: null })
  })

  test('어제를 쉼표로 지켰으면 말랑이 한마디 맨 앞에서 알려 줌', () => {
    const now = kst('2026-10-09T07:00:00')
    const lines = chatLines({ records: run(1, 7), stageProgress: 0, skills: [], now, lastSeen: now - 60_000 })
    expect(lines[0]).toEqual({ kind: 'rested', text: '🛟 어제는 쉼표가 지켜 줬어!' })
    const plain = chatLines({ records: run(1, 8), stageProgress: 0, skills: [], now, lastSeen: now - 60_000 })
    expect(plain.some((l) => l.kind === 'rested')).toBe(false)
  })
})
