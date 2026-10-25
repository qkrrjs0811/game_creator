import { describe, test, expect } from 'vitest'
import { CHAT_MAX_CHARS, chatLines, type ChatInput } from './chatter'
import { missionFor } from './mission'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
const rec = (activity: ActivityId, a: string, b: string): ActivityRecord => ({
  id: `r${n++}`,
  activity,
  startedAt: kst(a),
  endedAt: kst(b),
})

/** 2026-10-25(일) 미션은 휴식 10분, 2026-10-26(월)은 운동 20분 */
const SUN = '2026-10-25'
const now = kst(`${SUN}T20:00:00`)
const input = (over: Partial<ChatInput>): ChatInput => ({
  records: [],
  stageProgress: 0,
  skills: [],
  now,
  lastSeen: now - 60_000,
  ...over,
})
const kinds = (i: ChatInput) => chatLines(i).map((l) => l.kind)
const texts = (i: ChatInput) => chatLines(i).map((l) => l.text)

/** day(YYYY-MM-DD)에 운동 m분 */
const exerciseOn = (day: string, m: number) => rec('exercise', `${day}T09:00:00`, `${day}T09:${String(m).padStart(2, '0')}:00`)

describe('말랑이 한마디', () => {
  test('기록이 없으면 첫인사가 맨 앞이고 오늘 목표·미션이 뒤따른다', () => {
    const lines = chatLines(input({}))
    expect(lines[0]).toEqual({ kind: 'welcome', text: '👋 안녕! 타이머 켜 볼까?' })
    expect(lines.map((l) => l.kind)).toEqual(['welcome', 'goal', 'mission', 'winnable', 'cheer'])
    expect(lines[1].text).toBe('🎯 오늘 목표까지 30분!')
    expect(lines[2].text).toBe('📜 오늘은 휴식 10분 어때?')
  })

  test('오늘 목표까지 남은 분을 알려 준다', () => {
    const t = texts(input({ records: [exerciseOn(SUN, 18)] }))
    expect(t[0]).toBe('🎯 오늘 목표까지 12분!')
  })

  test('미션을 조금 했으면 남은 분을 알려 준다', () => {
    const records = [rec('relax', `${SUN}T10:00:00`, `${SUN}T10:04:00`)]
    expect(texts(input({ records }))).toContain('📜 휴식 미션 6분 남았어!')
  })

  test('오늘 목표·미션을 다 채우면 고맙다는 말이 맨 앞', () => {
    const records = [exerciseOn(SUN, 30), rec('relax', `${SUN}T10:00:00`, `${SUN}T10:10:00`)]
    const k = kinds(input({ records }))
    expect(k[0]).toBe('allDone')
    expect(k).not.toContain('goal')
    expect(k).not.toContain('mission')
    expect(chatLines(input({ records }))[0].text).toBe('🌟 오늘 도장 고마워!')
  })

  test('목표만 채우고 미션이 남았으면 미션이 고맙다는 말보다 앞', () => {
    const k = kinds(input({ records: [exerciseOn(SUN, 30)] }))
    expect(k.indexOf('mission')).toBeLessThan(k.indexOf('allDone'))
    expect(k).not.toContain('goal')
  })

  test('이어 온 날: 오늘 채웠으면 N일째, 아직이면 오늘 하면 N+1일째', () => {
    const before = [exerciseOn('2026-10-23', 30), exerciseOn('2026-10-24', 30)]
    expect(texts(input({ records: before }))).toContain('🔥 오늘 하면 3일째야!')
    expect(texts(input({ records: [...before, exerciseOn(SUN, 30)] }))).toContain('🔥 3일째 같이 하는 중!')
    expect(kinds(input({ records: [exerciseOn('2026-10-20', 30)] }))).not.toContain('streak')
  })

  test('이번 주 목표: 남은 날 안에 채울 수 있으면 며칠 더인지', () => {
    // 2026-10-26(월)~ 주. 수요일 저녁에 월·화 도장 → 3일 더, 수·목·금·토·일 5일 남음
    const wed = kst('2026-10-28T20:00:00')
    const records = [exerciseOn('2026-10-26', 30), exerciseOn('2026-10-27', 30)]
    expect(texts(input({ records, now: wed, lastSeen: wed }))).toContain('📅 이번 주 3일만 더!')
  })

  test('이번 주 목표를 이제 못 채우면 말하지 않고, 채웠으면 축하한다', () => {
    // 일요일 저녁, 이번 주 도장 0 → 1일밖에 안 남음
    expect(kinds(input({}))).not.toContain('week')
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
    const t = texts(input({ records: days.map((d) => exerciseOn(d, 30)) }))
    expect(t).toContain('🏅 이번 주 목표 채웠어!')
  })

  test('이길 만한 스테이지가 있으면 모험을 권한다', () => {
    expect(texts(input({}))).toContain('🍀 이길 만한 곳이 있어!')
    // 깬 스테이지가 많고 기록이 적으면 이길 만한 곳이 없다
    expect(kinds(input({ stageProgress: 30 }))).not.toContain('winnable')
  })

  test('하루 넘게 안 열었으면 반가워하며 짧게 같이 하자고 한다', () => {
    const records = [exerciseOn('2026-10-20', 30)]
    const lines = chatLines(input({ records, lastSeen: kst('2026-10-21T08:00:00') }))
    expect(lines[0]).toEqual({ kind: 'missed', text: '🥺 보고 싶었어! 5분만 같이?' })
    // 조금 전에 봤거나 본 시각을 모르면 없음
    expect(kinds(input({ records }))).not.toContain('missed')
    expect(kinds(input({ records, lastSeen: null }))).not.toContain('missed')
  })

  test('오늘 목표를 이미 채웠으면 오랜만이어도 반가움 대신 고마움', () => {
    const records = [exerciseOn(SUN, 30)]
    expect(kinds(input({ records, lastSeen: kst('2026-10-20T08:00:00') }))).not.toContain('missed')
  })

  test('마지막은 늘 기본 한마디라 목록이 비지 않는다', () => {
    const k = kinds(input({ records: [exerciseOn(SUN, 30)], stageProgress: 30 }))
    expect(k[k.length - 1]).toBe('cheer')
    expect(chatLines(input({}))[chatLines(input({})).length - 1].text).toBe('💪 오늘도 같이 크는 중!')
  })

  test('한 줄은 말풍선에 들어가게 짧다(여러 날·여러 경우)', () => {
    const many: ActivityRecord[] = []
    for (let d = 1; d <= 200; d++) {
      const day = new Date(2026, 3, d)
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      many.push(exerciseOn(key, 30))
    }
    const cases: ChatInput[] = [
      input({}),
      input({ records: many, now: kst('2026-10-17T20:00:00') }),
      input({ records: many, lastSeen: kst('2026-01-01T00:00:00') }),
      input({ records: [rec('reading', `${SUN}T10:00:00`, `${SUN}T10:01:00`)] }),
    ]
    for (let d = 0; d < 4; d++) {
      const t = kst(`2026-10-${26 + d}T07:00:00`)
      expect(missionFor(t)).toBeTruthy()
      cases.push(input({ now: t, lastSeen: t }))
    }
    for (const c of cases) {
      for (const line of chatLines(c)) expect(Array.from(line.text).length, line.text).toBeLessThanOrEqual(CHAT_MAX_CHARS)
    }
  })

  test('기록만 읽고 바꾸지 않는다', () => {
    const records = [exerciseOn(SUN, 12)]
    const copy = JSON.parse(JSON.stringify(records))
    chatLines(input({ records }))
    expect(records).toEqual(copy)
  })
})
