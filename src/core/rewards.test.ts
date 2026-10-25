import { describe, test, expect } from 'vitest'
import { chapterCosmetic } from './cosmetics'
import { leftMinutesText, upcomingRewards, type RewardInput } from './rewards'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
const rec = (activity: ActivityId, a: string, b: string): ActivityRecord => ({
  id: `r${n++}`,
  activity,
  startedAt: kst(a),
  endedAt: kst(b),
})

const now = kst('2026-10-25T20:00:00')
const input = (over: Partial<RewardInput>): RewardInput => ({ records: [], stageProgress: 0, skills: [], now, ...over })

/** 2026-10-25 에서 i일 전 날짜 */
const daysAgo = (i: number) => {
  const d = new Date(2026, 9, 25 - i)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** day 에 운동 m분(60분 미만) */
const exerciseOn = (day: string, m: number) => rec('exercise', `${day}T09:00:00`, `${day}T09:${String(m).padStart(2, '0')}:00`)
/** 최근 count 일 동안 날마다 운동 30분(도장) */
const stampDays = (count: number) => Array.from({ length: count }, (_, i) => exerciseOn(daysAgo(i), 30))

describe('남은 분 글', () => {
  test('시간과 분으로 쓴다', () => {
    expect(leftMinutesText(40)).toBe('40분')
    expect(leftMinutesText(60)).toBe('1시간')
    expect(leftMinutesText(130)).toBe('2시간 10분')
    expect(leftMinutesText(0.2)).toBe('1분')
  })
})

describe('곧 받을 보상', () => {
  test('기록이 없으면 모든 종류의 첫 보상이 진척 0으로 나온다', () => {
    const list = upcomingRewards(input({}))
    expect(list.map((r) => r.kind)).toEqual(['stamp', 'mission', 'week', 'chapter', 'achievement', 'prop', 'growth'])
    expect(list.every((r) => r.ratio === 0)).toBe(true)
    const stamp = list[0]
    expect(stamp).toMatchObject({ name: '반짝 도장 별핀', icon: '🌟', value: 0, goal: 7, need: '도장 7개 더' })
    expect(list[1]).toMatchObject({ name: '네잎클로버 핀', need: '미션 별 5개 더' })
    expect(list[2]).toMatchObject({ name: '레몬 말랑', need: '주간 목표 1번 더' })
    expect(list[3]).toMatchObject({ name: chapterCosmetic(1)!.name, value: 0, goal: 10 })
    expect(list[3].need).toMatch(/^운동 .+ 더 하면 이길 만해요$/)
    // 성장: Lv 5(어린이)까지 경험치 700 = 활동 70분
    expect(list[5]).toMatchObject({ name: '아령', icon: '🏋️', value: 0, goal: 60, need: '운동 1시간 더' })
    expect(list[6]).toMatchObject({ name: '어린이 말랑이', value: 1, goal: 5, need: '활동 1시간 10분 더' })
  })

  test('소품은 활동 중 가장 가까운 다음 소품 하나를 그 활동 남은 시간으로 알려 준다', () => {
    // 공부 50분(연필꽂이까지 10분), 독서 2시간(책 더미는 받았고 책갈피까지 3시간)
    const records = [
      rec('study', '2026-10-24T09:00:00', '2026-10-24T09:50:00'),
      rec('reading', '2026-10-23T09:00:00', '2026-10-23T11:00:00'),
    ]
    const props = upcomingRewards(input({ records })).filter((r) => r.kind === 'prop')
    expect(props).toHaveLength(1)
    expect(props[0]).toMatchObject({ name: '연필꽂이', value: 50, goal: 60, need: '공부 10분 더' })
    expect(props[0].ratio).toBeCloseTo(50 / 60)
  })

  test('받은 소품 다음 단계는 앞 단계부터 진척을 센다', () => {
    const records = [rec('reading', '2026-10-23T09:00:00', '2026-10-23T11:00:00')]
    const p = upcomingRewards(input({ records })).find((r) => r.kind === 'prop')!
    // 운동·공부·휴식은 진척 0, 독서는 책갈피까지 (120-60)/(300-60)
    expect(p).toMatchObject({ name: '책갈피', value: 120, goal: 300, need: '독서 3시간 더' })
    expect(p.ratio).toBeCloseTo(60 / 240)
  })

  test('도장이 7개에 가까우면 도장 모자가 맨 앞이다', () => {
    const list = upcomingRewards(input({ records: stampDays(5) }))
    expect(list[0]).toMatchObject({ kind: 'stamp', value: 5, goal: 7, need: '도장 2개 더' })
    expect(list[0].ratio).toBeCloseTo(5 / 7)
  })

  test('받은 단계 다음 보상을 고르고, 진척은 받은 단계부터 센다', () => {
    const stamp = upcomingRewards(input({ records: stampDays(8) })).find((r) => r.kind === 'stamp')!
    expect(stamp).toMatchObject({ name: '무지개 머리띠', value: 8, goal: 30, need: '도장 22개 더' })
    expect(stamp.ratio).toBeCloseTo(1 / 23)
  })

  test('다 받은 종류는 뺀다', () => {
    const list = upcomingRewards(input({ records: stampDays(100) }))
    expect(list.some((r) => r.kind === 'stamp')).toBe(false)
  })

  test('가장 가까운 업적 하나를 남은 시간으로 알려 준다', () => {
    const list = upcomingRewards(input({ records: [exerciseOn(daysAgo(1), 50)] }))
    const ach = list.filter((r) => r.kind === 'achievement')
    expect(ach).toHaveLength(1)
    expect(ach[0]).toMatchObject({ name: '땀방울 새싹', value: 50, goal: 60, need: '운동 10분 더' })
    expect(ach[0].ratio).toBeCloseTo(50 / 60)
    expect(list[0].kind).toBe('achievement')
  })

  test('이어 하기 업적은 지금 이어 온 날로 남은 날을 센다', () => {
    // 어제·그제 도장(2일) → 3일 이어 하기까지 하루
    const records = [exerciseOn(daysAgo(1), 30), exerciseOn(daysAgo(2), 30)]
    const all = upcomingRewards(input({ records }))
    const ach = all.find((r) => r.kind === 'achievement')!
    expect(ach).toMatchObject({ name: '사흘 친구', value: 2, goal: 3, need: '1일 더 이어 하기' })
  })

  test('장 보스 모자는 이번 장에서 깬 만큼 가깝다', () => {
    const ch = upcomingRewards(input({ stageProgress: 17 })).find((r) => r.kind === 'chapter')!
    expect(ch).toMatchObject({ name: chapterCosmetic(2)!.name, icon: chapterCosmetic(2)!.icon, value: 7, goal: 10 })
    expect(ch.ratio).toBeCloseTo(0.7)
  })

  test('성장 단계는 경험치로 진척을 센다', () => {
    const g = upcomingRewards(input({ records: [exerciseOn(daysAgo(1), 50)] })).find((r) => r.kind === 'growth')!
    expect(g).toMatchObject({ value: 4, goal: 5, need: '활동 20분 더' })
    expect(g.ratio).toBeCloseTo(500 / 700)
  })

  test('가까운(진척이 큰) 순서이고 진척은 0 이상 1 미만이다', () => {
    const list = upcomingRewards(input({ records: [...stampDays(5), exerciseOn(daysAgo(6), 50)], stageProgress: 3 }))
    for (let i = 1; i < list.length; i++) expect(list[i - 1].ratio).toBeGreaterThanOrEqual(list[i].ratio)
    expect(list.every((r) => r.ratio >= 0 && r.ratio < 1)).toBe(true)
  })
})
