import { describe, test, expect } from 'vitest'
import { ACHIEVEMENTS, achievementProgress, achievedIds, bestStreak, titleName } from './achievements'
import { computeProgress } from './progression'
import type { ActivityId, ActivityRecord } from './types'

const kst = (s: string) => Date.parse(`${s}+09:00`)
let n = 0
const rec = (activity: ActivityId, a: string, b: string): ActivityRecord => ({
  id: `r${n++}`,
  activity,
  startedAt: kst(a),
  endedAt: kst(b),
})
/** day 날짜에 activity 를 minutes 분 */
const on = (activity: ActivityId, day: string, minutes: number): ActivityRecord => {
  const start = kst(`${day}T08:00:00`)
  return { id: `r${n++}`, activity, startedAt: start, endedAt: start + minutes * 60_000 }
}
const byId = (records: ActivityRecord[]) => new Map(achievementProgress(records).map((a) => [a.id, a]))

describe('업적 목록', () => {
  test('id·칭호 id·칭호 이름이 모두 다르고 칭호 id는 title: 로 시작한다', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    const titles = ACHIEVEMENTS.map((a) => a.titleId)
    const names = ACHIEVEMENTS.map((a) => a.titleName)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(names).size).toBe(names.length)
    for (const t of titles) expect(t.startsWith('title:')).toBe(true)
  })

  test('활동별 누적 시간 이정표: 운동 1·10·50·100시간, 공부·독서 1·10·50시간, 휴식 1·10시간', () => {
    const goals = (activity: ActivityId) =>
      ACHIEVEMENTS.filter((a) => a.kind === 'minutes' && a.activity === activity).map((a) => a.goal / 60)
    expect(goals('exercise')).toEqual([1, 10, 50, 100])
    expect(goals('study')).toEqual([1, 10, 50])
    expect(goals('reading')).toEqual([1, 10, 50])
    expect(goals('relax')).toEqual([1, 10])
  })

  test('도장 수·이어 온 날 수·활동 종류 업적도 있다', () => {
    const kinds = new Set(ACHIEVEMENTS.map((a) => a.kind))
    expect(kinds).toEqual(new Set(['minutes', 'stamps', 'streak', 'variety']))
    expect(ACHIEVEMENTS.find((a) => a.kind === 'variety')?.goal).toBe(4)
  })

  test('칭호 id로 칭호 이름을 찾는다', () => {
    const a = ACHIEVEMENTS[0]
    expect(titleName(a.titleId)).toBe(a.titleName)
    expect(titleName('title:없음')).toBeNull()
  })
})

describe('업적 진행', () => {
  test('기록이 없으면 모두 0이고 아무것도 닿지 않았다', () => {
    const list = achievementProgress([])
    expect(list).toHaveLength(ACHIEVEMENTS.length)
    for (const a of list) {
      expect(a.value).toBe(0)
      expect(a.done).toBe(false)
    }
    expect(achievedIds([])).toEqual([])
  })

  test('운동 누적 분은 인정 분(하루 상한 3시간 안)만 센다', () => {
    // 하루 5시간 켜 둬도 3시간만 인정
    const a = byId([rec('exercise', '2026-10-20T06:00:00', '2026-10-20T11:00:00')])
    expect(a.get('exercise-1')!.value).toBe(180)
    expect(a.get('exercise-1')!.done).toBe(true)
    expect(a.get('exercise-10')!.value).toBe(180)
    expect(a.get('exercise-10')!.done).toBe(false)
  })

  test('여러 날 쌓이면 이정표에 닿는다', () => {
    const records = Array.from({ length: 4 }, (_, i) => on('exercise', `2026-10-${10 + i}`, 150))
    const a = byId(records)
    expect(a.get('exercise-10')!.value).toBe(600)
    expect(a.get('exercise-10')!.done).toBe(true)
    expect(a.get('exercise-50')!.done).toBe(false)
  })

  test('활동마다 따로 센다: 공부는 독서·운동 업적을 채우지 않는다', () => {
    const a = byId([on('study', '2026-10-20', 60)])
    expect(a.get('study-1')!.done).toBe(true)
    expect(a.get('reading-1')!.value).toBe(0)
    expect(a.get('exercise-1')!.value).toBe(0)
  })

  test('휴식은 하루 30분까지만 세서 1시간에 이틀이 걸린다', () => {
    expect(byId([on('relax', '2026-10-20', 90)]).get('relax-1')!.value).toBe(30)
    expect(byId([on('relax', '2026-10-20', 30), on('relax', '2026-10-21', 30)]).get('relax-1')!.done).toBe(true)
  })

  test('도장 수: 하루 목표(30분)를 채운 날 수', () => {
    const records = [on('exercise', '2026-10-01', 30), on('study', '2026-10-05', 40), on('reading', '2026-10-06', 10)]
    const stamps = achievementProgress(records).filter((a) => a.kind === 'stamps')
    for (const a of stamps) expect(a.value).toBe(2)
  })

  test('이어 온 날 수는 가장 길게 이어 온 기록이라 끊겨도 내려가지 않는다', () => {
    const records = [
      ...Array.from({ length: 7 }, (_, i) => on('exercise', `2026-10-0${i + 1}`, 30)),
      on('exercise', '2026-10-20', 30),
    ]
    expect(bestStreak(records)).toBe(7)
    const streak7 = achievementProgress(records).find((a) => a.kind === 'streak' && a.goal === 7)!
    expect(streak7.done).toBe(true)
  })

  test('이어 온 날은 달이 바뀌어도 이어진다', () => {
    expect(bestStreak([on('exercise', '2026-10-31', 30), on('exercise', '2026-11-01', 30)])).toBe(2)
    expect(bestStreak([])).toBe(0)
  })

  test('활동 종류 수: 1분 이상 인정된 활동 수', () => {
    const v = (records: ActivityRecord[]) => achievementProgress(records).find((a) => a.kind === 'variety')!
    expect(v([on('exercise', '2026-10-20', 5), on('study', '2026-10-20', 5)]).value).toBe(2)
    const all = v([
      on('exercise', '2026-10-20', 5),
      on('study', '2026-10-21', 5),
      on('reading', '2026-10-22', 5),
      on('relax', '2026-10-23', 1),
    ])
    expect(all.value).toBe(4)
    expect(all.done).toBe(true)
  })

  test('현재 값은 목표를 넘을 수 있고 달성 여부는 value >= goal', () => {
    for (const a of achievementProgress([on('exercise', '2026-10-20', 180)])) expect(a.done).toBe(a.value >= a.goal)
  })

  test('달성한 업적 id 목록은 목록 순서대로', () => {
    const ids = achievedIds([on('exercise', '2026-10-20', 60), on('study', '2026-10-21', 60)])
    expect(ids).toContain('exercise-1')
    expect(ids).toContain('study-1')
    const order = ACHIEVEMENTS.map((a) => a.id).filter((id) => ids.includes(id))
    expect(ids).toEqual(order)
  })

  test('업적을 계산해도 기록·경험치·능력치는 그대로다', () => {
    const records = [on('exercise', '2026-10-20', 90), on('reading', '2026-10-21', 40)]
    const copy = JSON.parse(JSON.stringify(records))
    const before = computeProgress(records)
    achievementProgress(records)
    expect(records).toEqual(copy)
    expect(computeProgress(records)).toEqual(before)
  })
})
