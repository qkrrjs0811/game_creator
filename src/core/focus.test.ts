import { describe, test, expect } from 'vitest'
import { FOCUS_TARGETS, focusCelebrateNow, focusProgress, focusTargetFor, parseFocusDefault, parseFocusGoal, serializeFocusGoal } from './focus'
import { computeProgress } from './progression'
import { newSave, startSession } from './session'

const MIN = 60_000
const t0 = Date.parse('2026-10-25T08:00:00+09:00')

describe('집중 목표 고르기', () => {
  test('없음·15·25·45·60분 중에서 고른다', () => {
    expect(FOCUS_TARGETS).toEqual([0, 15, 25, 45, 60])
  })
})

describe('집중 목표 진행', () => {
  test('목표가 없으면 진행도 없다', () => {
    expect(focusProgress(0, t0, t0 + 10 * MIN)).toBeNull()
  })

  test('켠 지 12분이면 25분 중 12분, 13분 남음', () => {
    expect(focusProgress(25, t0, t0 + 12 * MIN)).toEqual({ target: 25, elapsedMinutes: 12, remainingMinutes: 13, ratio: 12 / 25, reached: false })
  })

  test('12분 30초면 12분 했고 13분 남음(남은 분은 올려 센다)', () => {
    const p = focusProgress(25, t0, t0 + 12 * MIN + 30_000)!
    expect(p.elapsedMinutes).toBe(12)
    expect(p.remainingMinutes).toBe(13)
    expect(p.reached).toBe(false)
  })

  test('정확히 목표 분에 닿으면 달성, 남은 분 0', () => {
    const p = focusProgress(25, t0, t0 + 25 * MIN)!
    expect(p.reached).toBe(true)
    expect(p.remainingMinutes).toBe(0)
    expect(p.ratio).toBe(1)
  })

  test('목표를 넘겨도 진행 분은 계속 세고 막대는 가득에서 멈춘다', () => {
    const p = focusProgress(15, t0, t0 + 40 * MIN)!
    expect(p.elapsedMinutes).toBe(40)
    expect(p.remainingMinutes).toBe(0)
    expect(p.ratio).toBe(1)
    expect(p.reached).toBe(true)
  })

  test('시계가 시작보다 앞이면 0분으로 본다', () => {
    expect(focusProgress(25, t0, t0 - 5 * MIN)).toEqual({ target: 25, elapsedMinutes: 0, remainingMinutes: 25, ratio: 0, reached: false })
  })

  test('고를 수 없는 목표 분이면 진행도 없다', () => {
    expect(focusProgress(30, t0, t0 + 10 * MIN)).toBeNull()
    expect(focusProgress(-5, t0, t0 + 10 * MIN)).toBeNull()
  })
})

describe('집중 목표 보조 키', () => {
  test('써 둔 값을 그대로 다시 읽는다', () => {
    expect(parseFocusGoal(serializeFocusGoal({ startedAt: t0, minutes: 25 }))).toEqual({ startedAt: t0, minutes: 25 })
  })

  test('없거나 깨졌거나 모양이 틀리면 null', () => {
    expect(parseFocusGoal(null)).toBeNull()
    expect(parseFocusGoal('{oops')).toBeNull()
    expect(parseFocusGoal('[]')).toBeNull()
    expect(parseFocusGoal(JSON.stringify({ startedAt: 'x', minutes: 25 }))).toBeNull()
    expect(parseFocusGoal(JSON.stringify({ startedAt: t0, minutes: 30 }))).toBeNull()
    expect(parseFocusGoal(JSON.stringify({ startedAt: t0 }))).toBeNull()
  })

  test('켜 둔 타이머와 시작 시각이 같을 때만 그 목표를 쓴다', () => {
    const goal = { startedAt: t0, minutes: 25 }
    expect(focusTargetFor(goal, { activity: 'exercise', startedAt: t0 })).toBe(25)
    expect(focusTargetFor(goal, { activity: 'study', startedAt: t0 + MIN })).toBe(0)
    expect(focusTargetFor(goal, null)).toBe(0)
    expect(focusTargetFor(null, { activity: 'exercise', startedAt: t0 })).toBe(0)
  })

  test('다음에 쓸 기본 목표: 고를 수 있는 값만, 아니면 없음', () => {
    expect(parseFocusDefault('25')).toBe(25)
    expect(parseFocusDefault('60')).toBe(60)
    expect(parseFocusDefault('0')).toBe(0)
    expect(parseFocusDefault('30')).toBe(0)
    expect(parseFocusDefault('abc')).toBe(0)
    expect(parseFocusDefault(null)).toBe(0)
  })

  test('목표는 경험치·능력치를 바꾸지 않는다(기록만 센다)', () => {
    const save = startSession(newSave(), 'exercise', t0)
    const before = computeProgress(save.records)
    focusProgress(25, t0, t0 + 30 * MIN)
    parseFocusGoal(serializeFocusGoal({ startedAt: t0, minutes: 25 }))
    expect(computeProgress(save.records)).toEqual(before)
  })
})

describe('집중 목표 달성 연출', () => {
  const active = { activity: 'exercise' as const, startedAt: t0 }

  test('목표에 닿았고 이 타이머로 아직 축하하지 않았으면 축하한다', () => {
    expect(focusCelebrateNow(focusProgress(25, t0, t0 + 25 * MIN), active, null)).toBe(true)
    expect(focusCelebrateNow(focusProgress(25, t0, t0 + 90 * MIN), active, String(t0 - 5 * MIN))).toBe(true)
  })

  test('아직 못 닿았거나 목표가 없으면 축하하지 않는다', () => {
    expect(focusCelebrateNow(focusProgress(25, t0, t0 + 24 * MIN), active, null)).toBe(false)
    expect(focusCelebrateNow(focusProgress(0, t0, t0 + 30 * MIN), active, null)).toBe(false)
    expect(focusCelebrateNow(focusProgress(25, t0, t0 + 30 * MIN), null, null)).toBe(false)
  })

  test('이 타이머로 이미 축하했으면 다시 열어도 한 번만', () => {
    expect(focusCelebrateNow(focusProgress(25, t0, t0 + 30 * MIN), active, String(t0))).toBe(false)
  })
})
