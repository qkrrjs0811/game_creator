import { describe, test, expect } from 'vitest'
import { lastWeekLetter, letterNow, parseSeenLetter, suggestText } from './letter'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
/** 그날 아침 activity 를 m분 */
const rec = (date: string, activity: ActivityId, m: number): ActivityRecord => ({
  id: `l${n++}`,
  activity,
  startedAt: kst(`${date}T08:00:00`),
  endedAt: kst(`${date}T08:00:00`) + m * 60_000,
})

// 2026-10-26(월)이 이번 주. 지난주 = 10-19(월) ~ 10-25(일), 그 전 주 = 10-12 ~ 10-18
const MONDAY = kst('2026-10-26T09:00:00')

describe('지난주 편지', () => {
  test('지난주 기록이 없으면 편지를 만들지 않는다', () => {
    expect(lastWeekLetter([], MONDAY)).toBeNull()
    // 그 전 주와 이번 주에만 기록이 있어도 없다
    expect(lastWeekLetter([rec('2026-10-14', 'exercise', 40), rec('2026-10-26', 'study', 20)], MONDAY)).toBeNull()
  })

  test('지난주와 그 전 주 합계·차이(상한 안 인정 분)', () => {
    const rs = [
      rec('2026-10-13', 'exercise', 30),
      rec('2026-10-20', 'exercise', 50),
      rec('2026-10-21', 'relax', 60), // 휴식 상한 30분
      rec('2026-10-26', 'study', 100), // 이번 주는 세지 않는다
    ]
    const l = lastWeekLetter(rs, MONDAY)!
    expect(l.week).toBe('2026-10-19')
    expect(l.total).toBe(80)
    expect(l.prevTotal).toBe(30)
    expect(l.diff).toBe(50)
  })

  test('도장 찍은 날 수와 주간 목표 달성', () => {
    const four = ['20', '21', '22', '23'].map((d) => rec(`2026-10-${d}`, 'exercise', 30))
    const l4 = lastWeekLetter([...four, rec('2026-10-24', 'exercise', 10)], MONDAY)!
    expect(l4.stamped).toBe(4)
    expect(l4.goal).toBe(5)
    expect(l4.goalDone).toBe(false)
    const l5 = lastWeekLetter([...four, rec('2026-10-25', 'study', 30)], MONDAY)!
    expect(l5.stamped).toBe(5)
    expect(l5.goalDone).toBe(true)
  })

  test('활동별 분, 가장 많이 한 활동과 날', () => {
    const rs = [
      rec('2026-10-19', 'study', 20),
      rec('2026-10-22', 'exercise', 25),
      rec('2026-10-22', 'reading', 15),
      rec('2026-10-24', 'study', 30),
    ]
    const l = lastWeekLetter(rs, MONDAY)!
    expect(l.minutes).toEqual({ exercise: 25, study: 50, reading: 15, relax: 0 })
    expect(l.top).toBe('study')
    expect(l.best).toEqual({ key: '2026-10-22', minutes: 40 })
  })

  test('덜 한 활동을 하나 권한다(같으면 운동·공부·독서·휴식 순, 가장 많이 한 활동은 빼고)', () => {
    const l = lastWeekLetter([rec('2026-10-20', 'exercise', 30), rec('2026-10-21', 'study', 10)], MONDAY)!
    expect(l.suggest).toBe('reading')
    expect(l.suggestText).toBe('이번 주엔 📚 독서도 해 볼까?')
    const even = ['exercise', 'study', 'reading', 'relax'].map((a) => rec('2026-10-20', a as ActivityId, 10))
    const le = lastWeekLetter(even, MONDAY)!
    expect(le.top).toBe('exercise')
    expect(le.suggest).toBe('study')
  })

  test('권하는 한 줄', () => {
    expect(suggestText('exercise')).toBe('이번 주엔 🏃 운동도 해 볼까?')
    expect(suggestText('study')).toBe('이번 주엔 ✏️ 공부도 해 볼까?')
    expect(suggestText('relax')).toBe('이번 주엔 🍵 휴식도 해 볼까?')
  })

  test('주 중간에도 지난주를 본다(일요일 밤은 아직 그 주)', () => {
    const rs = [rec('2026-10-20', 'exercise', 30)]
    expect(lastWeekLetter(rs, kst('2026-10-29T21:00:00'))!.week).toBe('2026-10-19')
    // 10-25(일) 밤이면 지난주는 10-12 주라 기록이 없다
    expect(lastWeekLetter(rs, kst('2026-10-25T23:00:00'))).toBeNull()
  })
})

describe('본 편지 보조 키', () => {
  test('주 키(YYYY-MM-DD)만 읽는다', () => {
    expect(parseSeenLetter(null)).toBeNull()
    expect(parseSeenLetter('')).toBeNull()
    expect(parseSeenLetter('abc')).toBeNull()
    expect(parseSeenLetter('2026-10-19')).toBe('2026-10-19')
  })

  test('처음 여는 창은 기억만, 새 주면 한 번 띄운다', () => {
    expect(letterNow('2026-10-19', null)).toEqual({ show: false, remember: '2026-10-19' })
    expect(letterNow('2026-10-19', '2026-10-12')).toEqual({ show: true, remember: '2026-10-19' })
    expect(letterNow('2026-10-19', '2026-10-19')).toEqual({ show: false, remember: null })
    expect(letterNow(null, '2026-10-12')).toEqual({ show: false, remember: null })
  })
})
