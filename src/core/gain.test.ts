import { describe, test, expect } from 'vitest'
import { sessionGain } from './gain'
import { newSave } from './session'
import type { SaveData } from './types'

const MIN = 60_000
const T0 = new Date(2026, 9, 25, 8).getTime()
const running = (records: SaveData['records'] = []): SaveData => ({
  ...newSave(),
  records,
  active: { activity: 'exercise', startedAt: T0 },
})

describe('sessionGain', () => {
  test('그만할 때 이번 운동으로 얻은 분·경험치·능력치', () => {
    expect(sessionGain(running(), T0 + 32 * MIN + 30_000)).toEqual({
      minutes: 32,
      exp: 320,
      stats: { str: 3, vit: 3, int: 0, focus: 0 },
    })
  })

  test('이미 쌓은 분과 합쳐 10분을 넘기면 능력치가 오른다', () => {
    const before = [{ id: 'a', activity: 'exercise' as const, startedAt: T0 - 60 * MIN, endedAt: T0 - 52 * MIN }]
    expect(sessionGain(running(before), T0 + 3 * MIN)?.stats).toEqual({ str: 1, vit: 1, int: 0, focus: 0 })
  })

  test('하루 상한을 넘긴 시간은 했지만 경험치는 늘지 않는다', () => {
    const full = [{ id: 'a', activity: 'exercise' as const, startedAt: T0 - 180 * MIN, endedAt: T0 }]
    const g = sessionGain(running(full), T0 + 20 * MIN)!
    expect(g.minutes).toBe(20)
    expect(g.exp).toBe(0)
    expect(g.stats).toEqual({ str: 0, vit: 0, int: 0, focus: 0 })
  })

  test('진행 중인 운동이 없으면 null', () => {
    expect(sessionGain(newSave(), T0)).toBeNull()
  })
})
