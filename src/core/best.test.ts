import { describe, test, expect } from 'vitest'
import { bestValues, bestsBroken, bestsNow, parseSeenBests, personalBests } from './best'
import { computeProgress } from './progression'
import { restStreak } from './rest'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
/** 그날 at 시각부터 activity 를 m분 */
const rec = (date: string, activity: ActivityId, m: number, at = '08:00:00'): ActivityRecord => ({
  id: `b${n++}`,
  activity,
  startedAt: kst(`${date}T${at}`),
  endedAt: kst(`${date}T${at}`) + m * 60_000,
})
const NOW = kst('2026-10-25T21:00:00')

describe('내 최고 기록', () => {
  test('기록이 없으면 모두 비어 있다', () => {
    const b = personalBests([], NOW)
    expect(b.session).toEqual({ exercise: 0, study: 0, reading: 0, relax: 0 })
    expect(b.day).toBeNull()
    expect(b.week).toBeNull()
    expect(b.streak).toBe(0)
  })

  test('활동별 한 번에 가장 길게 한 인정 분', () => {
    const b = personalBests(
      [rec('2026-10-20', 'exercise', 25), rec('2026-10-21', 'exercise', 40), rec('2026-10-21', 'study', 15, '10:00:00')],
      NOW,
    )
    expect(b.session).toEqual({ exercise: 40, study: 15, reading: 0, relax: 0 })
  })

  test('한 번 최고는 하루 상한 안의 분만 센다', () => {
    // 휴식 상한 30분: 한 번에 90분 켜 둬도 30분
    expect(personalBests([rec('2026-10-20', 'relax', 90)], NOW).session.relax).toBe(30)
    // 같은 날 앞에서 상한을 거의 채웠으면 뒤 세션은 남은 만큼만
    const b = personalBests([rec('2026-10-20', 'study', 100), rec('2026-10-20', 'study', 60, '12:00:00')], NOW)
    expect(b.session.study).toBe(100)
    const late = personalBests([rec('2026-10-20', 'study', 110), rec('2026-10-20', 'study', 115, '12:00:00')], NOW)
    expect(late.session.study).toBe(110)
  })

  test('자정을 걸친 한 번은 두 날의 상한을 따로 쓴다', () => {
    // 휴식 23:40~00:40 → 첫날 20분 + 다음 날 30분(상한) = 50분
    const b = personalBests([rec('2026-10-20', 'relax', 60, '23:40:00')], NOW)
    expect(b.session.relax).toBe(50)
  })

  test('하루 최고: 인정 분 합계와 날짜(같으면 먼저 한 날)', () => {
    const b = personalBests(
      [
        rec('2026-10-19', 'exercise', 30),
        rec('2026-10-20', 'exercise', 40),
        rec('2026-10-20', 'relax', 60, '12:00:00'), // 30분만
        rec('2026-10-22', 'study', 70),
      ],
      NOW,
    )
    expect(b.day).toEqual({ key: '2026-10-20', minutes: 70 })
  })

  test('주 최고: 월~일 인정 분 합계와 그 주 월요일', () => {
    const b = personalBests(
      [
        rec('2026-10-12', 'exercise', 50),
        rec('2026-10-18', 'exercise', 50), // 10-12 주 100
        rec('2026-10-19', 'study', 60),
        rec('2026-10-25', 'reading', 30), // 10-19 주 90
      ],
      NOW,
    )
    expect(b.week).toEqual({ key: '2026-10-12', minutes: 100 })
  })

  test('가장 길게 이어 온 날은 쉼표 규칙과 같고 지금 이어 온 날보다 짧지 않다', () => {
    const rs: ActivityRecord[] = []
    for (let d = 1; d <= 9; d++) if (d !== 5) rs.push(rec(`2026-10-0${d}`, 'exercise', 30))
    for (let d = 12; d <= 14; d++) rs.push(rec(`2026-10-${d}`, 'exercise', 30))
    const now = kst('2026-10-14T21:00:00')
    const b = personalBests(rs, now)
    const r = restStreak(rs, now)
    expect(b.streak).toBe(r.best)
    expect(b.streak).toBeGreaterThanOrEqual(r.streak)
    expect(b.streak).toBe(4) // 1~4일 (쉼표가 아직 없어 5일 빈 곳은 못 메움)
  })

  test('기록만 읽고 경험치·능력치는 그대로', () => {
    const rs = [rec('2026-10-20', 'exercise', 40), rec('2026-10-21', 'study', 30)]
    const before = computeProgress(rs)
    personalBests(rs, NOW)
    expect(computeProgress(rs)).toEqual(before)
  })
})

describe('최고 기록 갱신 고르기', () => {
  const base = bestValues(personalBests([rec('2026-10-20', 'exercise', 30), rec('2026-10-20', 'study', 20, '10:00:00')], NOW))

  test('본 값으로 줄이면 숫자만 남는다', () => {
    expect(base).toEqual({ session: { exercise: 30, study: 20, reading: 0, relax: 0 }, day: 50, week: 50, streak: 1 })
  })

  test('늘어난 항목만 고른다(전에 0이던 첫 기록은 갱신으로 치지 않는다)', () => {
    const now = { ...base, session: { ...base.session, exercise: 45, reading: 10 }, day: 50, week: 60 }
    expect(bestsBroken(now, base)).toEqual(['exercise', 'week'])
    expect(bestsBroken(base, base)).toEqual([])
  })

  test('처음 여는 창은 기억만, 새 기록이면 한 번 띄우고, 같으면 조용히', () => {
    expect(bestsNow(base, null)).toEqual({ show: false, broken: [], remember: base })
    const up = { ...base, day: 70, streak: 2 }
    expect(bestsNow(up, base)).toEqual({ show: true, broken: ['day', 'streak'], remember: up })
    expect(bestsNow(base, base)).toEqual({ show: false, broken: [], remember: null })
  })

  test('기록이 줄어 본 값보다 작아지면(백업 가져오기 등) 띄우지 않고 지금 값을 기억한다', () => {
    const down = { ...base, day: 10 }
    expect(bestsNow(down, base)).toEqual({ show: false, broken: [], remember: down })
  })

  test('보조 키 파서', () => {
    expect(parseSeenBests(JSON.stringify(base))).toEqual(base)
    expect(parseSeenBests(null)).toBeNull()
    expect(parseSeenBests('엉망')).toBeNull()
    expect(parseSeenBests('[1,2]')).toBeNull()
    expect(parseSeenBests(JSON.stringify({ ...base, day: -1 }))).toBeNull()
    expect(parseSeenBests(JSON.stringify({ ...base, session: { exercise: 'a' } }))).toBeNull()
    // 빠진 활동은 0으로 읽는다
    expect(parseSeenBests(JSON.stringify({ ...base, session: { exercise: 30 } }))).toEqual({
      ...base,
      session: { exercise: 30, study: 0, reading: 0, relax: 0 },
    })
  })
})
