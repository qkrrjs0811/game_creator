import { describe, test, expect } from 'vitest'
import { CHAT_MAX_CHARS, chatLines, keepChatIndex, nextChatIndex, rewardChatText, type ChatInput } from './chatter'
import type { UpcomingReward } from './rewards'
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

  test('이번 주 목표는 도장판에서만 보여 주고 말랑이는 말하지 않는다', () => {
    // 수요일 저녁에 월·화 도장(3일 더면 채울 수 있음), 또는 이번 주를 이미 채운 때
    const wed = kst('2026-10-28T20:00:00')
    const records = [exerciseOn('2026-10-26', 30), exerciseOn('2026-10-27', 30)]
    expect(kinds(input({ records, now: wed, lastSeen: wed }))).not.toContain('week')
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
    expect(kinds(input({ records: days.map((d) => exerciseOn(d, 30)) }))).not.toContain('week')
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

describe('한마디에 가까운 보상', () => {
  const reward = (over: Partial<UpcomingReward>): UpcomingReward => ({
    kind: 'stamp',
    icon: '🌟',
    name: '반짝 도장 별핀',
    value: 5,
    goal: 7,
    need: '도장 2개 더',
    ratio: 0.7,
    ...over,
  })
  /** 월~금 도장 5개(일요일 저녁, 오늘은 아직) → 도장 모자까지 2개 */
  const fiveStamps = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].map((d) => exerciseOn(d, 30))

  test('보상 종류마다 짧은 한 줄로 바꾼다', () => {
    expect(rewardChatText(reward({}))).toBe('🎁 도장 2개면 새 모자!')
    expect(rewardChatText(reward({ kind: 'mission', need: '미션 별 3개 더' }))).toBe('🎁 미션 별 3개면 새 모자!')
    expect(rewardChatText(reward({ kind: 'week', need: '주간 목표 1번 더' }))).toBe('🎁 주간 목표 1번이면 새 색!')
    expect(rewardChatText(reward({ kind: 'chapter', need: '스테이지 2개 더 깨기' }))).toBe('🎁 2곳 더 깨면 새 모자!')
    expect(rewardChatText(reward({ kind: 'achievement', need: '운동 40분 더' }))).toBe('🎁 운동 40분이면 새 칭호!')
    expect(rewardChatText(reward({ kind: 'achievement', need: '도장 3개 더' }))).toBe('🎁 도장 3개면 새 칭호!')
    expect(rewardChatText(reward({ kind: 'achievement', need: '2일 더 이어 하기' }))).toBe('🎁 2일 더 이어 가면 새 칭호!')
    expect(rewardChatText(reward({ kind: 'achievement', need: '활동 1가지 더 해 보기' }))).toBe('🎁 1가지 더 해 보면 새 칭호!')
    expect(rewardChatText(reward({ kind: 'growth', need: '활동 30분 더' }))).toBe('🎁 활동 30분이면 쑥 자라!')
  })

  test('보스를 아직 이기기 어렵거나 글이 말풍선보다 길면 넣지 않는다', () => {
    expect(rewardChatText(reward({ kind: 'chapter', need: '운동 20분 더 하면 이길 만해요' }))).toBeNull()
    expect(rewardChatText(reward({ kind: 'growth', need: '활동 12시간 10분 더' }))).toBeNull()
  })

  test('절반 넘게 다가간 보상을 오늘 목표·미션 뒤에 하나 넣는다', () => {
    const lines = chatLines(input({ records: fiveStamps }))
    const k = lines.map((l) => l.kind)
    expect(k.filter((x) => x === 'reward')).toHaveLength(1)
    expect(k.indexOf('reward')).toBeGreaterThan(k.indexOf('goal'))
    expect(k.indexOf('reward')).toBeGreaterThan(k.indexOf('mission'))
    expect(texts(input({ records: fiveStamps }))).toContain('🎁 도장 2개면 새 모자!')
  })

  test('절반을 못 넘었으면 보상 한마디가 없다', () => {
    expect(kinds(input({}))).not.toContain('reward')
    expect(kinds(input({ records: [exerciseOn('2026-10-24', 30)] }))).not.toContain('reward')
  })
})

describe('한마디에 최고까지 남은 분', () => {
  /** 어제(토) 운동 40분이 하루 최고 */
  const best40 = exerciseOn('2026-10-24', 40)
  const study = (m: number) => rec('study', `${SUN}T11:00:00`, `${SUN}T11:${String(m).padStart(2, '0')}:00`)

  test('오늘이 하루 최고의 절반을 넘었으면 넘기까지 남은 분을 알려 준다', () => {
    const lines = chatLines(input({ records: [best40, study(33)] }))
    const best = lines.find((l) => l.kind === 'best')
    expect(best?.text).toBe('🥇 최고까지 8분 남았어!')
    expect(Array.from(best!.text).length).toBeLessThanOrEqual(CHAT_MAX_CHARS)
    const k = lines.map((l) => l.kind)
    expect(k.indexOf('best')).toBeGreaterThan(k.indexOf('goal'))
  })

  test('최고와 같으면 1분만 더 하면 넘는다', () => {
    expect(texts(input({ records: [best40, study(40)] }))).toContain('🥇 최고까지 1분 남았어!')
  })

  test('절반 이하거나 이미 넘었으면 말하지 않는다', () => {
    expect(kinds(input({ records: [best40, study(20)] }))).not.toContain('best')
    expect(kinds(input({ records: [best40, study(41)] }))).not.toContain('best')
  })

  test('지난 기록이 없으면(오늘이 첫날) 말하지 않는다', () => {
    expect(kinds(input({ records: [study(30)] }))).not.toContain('best')
    expect(kinds(input({}))).not.toContain('best')
  })

  test('하루 최고는 상한 안 인정 분으로 본다', () => {
    // 어제 휴식 3시간이어도 상한 30분만 인정 → 오늘 공부 25분이면 6분 남음
    const relax = rec('relax', '2026-10-24T09:00:00', '2026-10-24T12:00:00')
    expect(texts(input({ records: [relax, study(25)] }))).toContain('🥇 최고까지 6분 남았어!')
  })
})

describe('말풍선 눌러 다음 한마디', () => {
  test('누르면 다음 후보로, 마지막 뒤엔 처음으로 돌아간다', () => {
    expect(nextChatIndex(0, 3)).toBe(1)
    expect(nextChatIndex(1, 3)).toBe(2)
    expect(nextChatIndex(2, 3)).toBe(0)
    expect(nextChatIndex(0, 1)).toBe(0)
    // 후보가 줄어 범위를 벗어났으면 처음으로
    expect(nextChatIndex(5, 3)).toBe(0)
    expect(nextChatIndex(0, 0)).toBe(0)
  })

  test('후보가 그대로면 보던 자리를 지키고, 바뀌면(기록·날이 바뀌면) 처음부터 다시', () => {
    const a = ['🎯 오늘 목표까지 25분!', '📜 오늘은 휴식 10분 어때?', '💪 오늘도 같이 크는 중!']
    expect(keepChatIndex(a, [...a], 2)).toBe(2)
    expect(keepChatIndex(a, ['🎯 오늘 목표까지 20분!', ...a.slice(1)], 2)).toBe(0)
    expect(keepChatIndex(a, a.slice(0, 2), 1)).toBe(0)
    expect(keepChatIndex([], a, 0)).toBe(0)
  })
})

describe('말랑이 한마디 · 다짐은 뺐다', () => {
  test('아침에도 다짐을 정하자고 하지 않고, 다짐 한마디도 없다', () => {
    const morning = kst(`${SUN}T08:00:00`)
    const records = [rec('study', `${SUN}T10:00:00`, `${SUN}T10:12:00`)]
    for (const c of [input({ now: morning, lastSeen: morning }), input({ now: morning, lastSeen: morning, records }), input({})]) {
      for (const line of chatLines(c)) expect(line.text).not.toContain('다짐')
    }
  })
})
