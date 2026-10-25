import { describe, test, expect } from 'vitest'
import { PLEDGE_MINUTES, canChangePledge, parsePledge, pledgeCelebrateNow, pledgeOptions, pledgeProgress, serializePledge } from './pledge'
import { computeProgress } from './progression'
import type { ActivityId, ActivityRecord } from './types'

const MIN = 60_000
const t0 = Date.parse('2026-10-26T08:00:00+09:00')
const now = t0 + 10 * 60 * MIN // 18:00

let n = 0
const rec = (activity: ActivityId, start: number, minutes: number): ActivityRecord => ({ id: `r${n++}`, activity, startedAt: start, endedAt: start + minutes * MIN })

describe('다짐 시간 고르기', () => {
  test('10·20·30·60분 중에서 고른다', () => {
    expect(PLEDGE_MINUTES).toEqual([10, 20, 30, 60])
  })

  test('기록이 없으면 활동 상한 안의 시간만 고를 수 있다(휴식은 30분까지)', () => {
    expect(pledgeOptions([], 'study', now)).toEqual([10, 20, 30, 60])
    expect(pledgeOptions([], 'relax', now)).toEqual([10, 20, 30])
  })

  test('오늘 이미 한 분보다 긴 시간만 고를 수 있다', () => {
    const records = [rec('study', t0, 25)]
    expect(pledgeOptions(records, 'study', now)).toEqual([30, 60])
    expect(pledgeOptions(records, 'reading', now)).toEqual([10, 20, 30, 60])
  })

  test('오늘 상한을 다 채운 활동은 고를 시간이 없다', () => {
    expect(pledgeOptions([rec('relax', t0, 40)], 'relax', now)).toEqual([])
  })

  test('어제 한 분은 오늘 고르기에 상관없다', () => {
    expect(pledgeOptions([rec('study', t0 - 24 * 60 * MIN, 50)], 'study', now)).toEqual([10, 20, 30, 60])
  })
})

describe('다짐 보조 키', () => {
  test('써 둔 값을 그날 그대로 다시 읽는다', () => {
    const p = { day: '2026-10-26', activity: 'study' as const, minutes: 30 }
    expect(parsePledge(serializePledge(p), now)).toEqual(p)
  })

  test('지난 날짜의 다짐은 없음으로 본다(날이 바뀌면 비워진다)', () => {
    const p = { day: '2026-10-25', activity: 'study' as const, minutes: 30 }
    expect(parsePledge(serializePledge(p), now)).toBeNull()
  })

  test('없거나 깨졌거나 모양이 틀리면 없음', () => {
    expect(parsePledge(null, now)).toBeNull()
    expect(parsePledge('{oops', now)).toBeNull()
    expect(parsePledge('[]', now)).toBeNull()
    expect(parsePledge(JSON.stringify({ day: '2026-10-26', activity: 'sleep', minutes: 30 }), now)).toBeNull()
    expect(parsePledge(JSON.stringify({ day: '2026-10-26', activity: 'study', minutes: 25 }), now)).toBeNull()
    expect(parsePledge(JSON.stringify({ day: '2026-10-26', activity: 'study' }), now)).toBeNull()
    expect(parsePledge(JSON.stringify({ activity: 'study', minutes: 30 }), now)).toBeNull()
  })

  test('상한보다 긴 휴식 다짐은 없음으로 본다', () => {
    expect(parsePledge(JSON.stringify({ day: '2026-10-26', activity: 'relax', minutes: 60 }), now)).toBeNull()
  })
})

describe('다짐 진행', () => {
  const pledge = { day: '2026-10-26', activity: 'study' as const, minutes: 30 }

  test('다짐이 없으면 진행도 없다', () => {
    expect(pledgeProgress(null, [], now)).toBeNull()
  })

  test('오늘 공부 12분이면 30분 중 12분, 18분 남음', () => {
    expect(pledgeProgress(pledge, [rec('study', t0, 12)], now)).toEqual({ activity: 'study', goal: 30, minutes: 12, remaining: 18, ratio: 12 / 30, done: false })
  })

  test('다른 활동과 어제 기록은 세지 않는다', () => {
    const records = [rec('reading', t0, 40), rec('study', t0 - 24 * 60 * MIN, 50)]
    expect(pledgeProgress(pledge, records, now)!.minutes).toBe(0)
  })

  test('채우면 지켰다, 남은 분 0, 막대는 가득에서 멈춘다', () => {
    const p = pledgeProgress(pledge, [rec('study', t0, 45)], now)!
    expect(p.done).toBe(true)
    expect(p.remaining).toBe(0)
    expect(p.ratio).toBe(1)
    expect(p.minutes).toBe(45)
  })

  test('하루 상한을 넘긴 분은 세지 않는다', () => {
    const p = pledgeProgress({ day: '2026-10-26', activity: 'relax', minutes: 30 }, [rec('relax', t0, 90)], now)!
    expect(p.minutes).toBe(30)
    expect(p.done).toBe(true)
  })

  test('켜 둔 타이머 몫(기록에 합친 것)도 센다', () => {
    const live = { id: 'live', activity: 'study' as const, startedAt: now - 20 * MIN, endedAt: now }
    expect(pledgeProgress(pledge, [rec('study', t0, 12), live], now)!.minutes).toBe(32)
  })

  test('다짐은 경험치·능력치를 바꾸지 않는다(기록만 읽는다)', () => {
    const records = [rec('study', t0, 30)]
    const before = computeProgress(records)
    pledgeProgress(pledge, records, now)
    expect(computeProgress(records)).toEqual(before)
    expect(records).toHaveLength(1)
  })
})

describe('다짐 바꾸기', () => {
  const pledge = { day: '2026-10-26', activity: 'study' as const, minutes: 30 }

  test('다짐이 없으면 정할 수 있다', () => {
    expect(canChangePledge(null, [], now)).toBe(true)
  })

  test('채우기 전에는 바꿀 수 있다', () => {
    expect(canChangePledge(pledge, [rec('study', t0, 29)], now)).toBe(true)
  })

  test('채운 뒤에는 바꿀 수 없다', () => {
    expect(canChangePledge(pledge, [rec('study', t0, 30)], now)).toBe(false)
  })
})

describe('다짐 지킴 알림', () => {
  const pledge = { day: '2026-10-26', activity: 'study' as const, minutes: 30 }

  test('채웠고 오늘 아직 안 알렸으면 띄운다', () => {
    const p = pledgeProgress(pledge, [rec('study', t0, 30)], now)
    expect(pledgeCelebrateNow(pledge, p, null)).toBe(true)
    expect(pledgeCelebrateNow(pledge, p, '2026-10-25')).toBe(true)
  })

  test('오늘 이미 알렸으면 다시 안 띄운다', () => {
    const p = pledgeProgress(pledge, [rec('study', t0, 30)], now)
    expect(pledgeCelebrateNow(pledge, p, '2026-10-26')).toBe(false)
  })

  test('아직 못 채웠거나 다짐이 없으면 안 띄운다', () => {
    expect(pledgeCelebrateNow(pledge, pledgeProgress(pledge, [rec('study', t0, 10)], now), null)).toBe(false)
    expect(pledgeCelebrateNow(null, null, null)).toBe(false)
  })
})
