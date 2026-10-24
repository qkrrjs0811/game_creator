import { test, expect } from 'vitest'
import { newSave, startSession, stopSession, liveRecords } from './session'

test('시작 → 정지하면 기록 1개, active 비움', () => {
  const s = stopSession(startSession(newSave(), 'exercise', 1000), 61_000)
  expect(s.active).toBeNull()
  expect(s.records).toEqual([{ id: 'exercise-1000', activity: 'exercise', startedAt: 1000, endedAt: 61_000 }])
})

test('진행 중에 다시 시작해도 시작 시각이 안 바뀜', () => {
  const s1 = startSession(newSave(), 'exercise', 1000)
  expect(startSession(s1, 'exercise', 5000)).toBe(s1)
})

test('진행 중 아닐 때 정지는 변화 없음', () => {
  const s = newSave()
  expect(stopSession(s, 5000)).toBe(s)
})

test('liveRecords는 진행 중 세션을 now까지 포함', () => {
  const s = startSession(newSave(), 'exercise', 0)
  expect(liveRecords(s, 600_000)).toEqual([{ id: 'exercise-0', activity: 'exercise', startedAt: 0, endedAt: 600_000 }])
})
