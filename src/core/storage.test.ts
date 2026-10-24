import { test, expect } from 'vitest'
import { canPersist, loadSave, syncSave, writeSave, SAVE_KEY } from './storage'
import { newSave } from './session'

const mem = () => {
  const m = new Map<string, string>()
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

test('저장 후 불러오면 같음', () => {
  const kv = mem()
  const s = { ...newSave(), skills: ['a'] }
  expect(writeSave(kv, s)).toBe(true)
  expect(loadSave(kv, 0)).toEqual(s)
})

test('없으면 새 저장', () => {
  expect(loadSave(mem(), 0)).toEqual(newSave())
})

test('깨진 데이터는 다른 키로 보존하고 새로 시작', () => {
  const kv = mem()
  kv.m.set(SAVE_KEY, '{not json')
  expect(loadSave(kv, 1234)).toEqual(newSave())
  expect(kv.m.get(`${SAVE_KEY}:corrupt:1234`)).toBe('{not json')
})

test('형식이 다른 데이터도 깨진 것으로 보존', () => {
  const kv = mem()
  kv.m.set(SAVE_KEY, '{"version":2}')
  expect(loadSave(kv, 7)).toEqual(newSave())
  expect(kv.m.get(`${SAVE_KEY}:corrupt:7`)).toBe('{"version":2}')
})

test('저장소가 예외를 던져도 죽지 않음', () => {
  const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
  expect(loadSave(bad, 0)).toEqual(newSave())
  expect(writeSave(bad, newSave())).toBe(false)
})

test('구조가 깨진 저장(records 안에 null)도 깨진 것으로 보존하고 새로 시작', () => {
  const kv = mem()
  const raw = JSON.stringify({ ...newSave(), records: [null] })
  kv.m.set(SAVE_KEY, raw)
  expect(loadSave(kv, 9)).toEqual(newSave())
  expect(kv.m.get(`${SAVE_KEY}:corrupt:9`)).toBe(raw)
})

test('다른 창이 저장한 내용을 따라간다', () => {
  const kv = mem()
  const stale = newSave()
  const fresh = { ...newSave(), records: [{ id: 'exercise-0', activity: 'exercise' as const, startedAt: 0, endedAt: 60_000 }] }
  writeSave(kv, fresh)
  expect(syncSave(kv, stale)).toEqual(fresh)
})

test('저장이 그대로면 지금 객체를 돌려준다', () => {
  const kv = mem()
  const s = { ...newSave(), skills: ['a'] }
  writeSave(kv, s)
  expect(syncSave(kv, s)).toBe(s)
})

test('저장이 없거나 깨졌으면 지금 것을 지키고 보존 키도 만들지 않는다', () => {
  const kv = mem()
  const s = { ...newSave(), stageProgress: 2 }
  expect(syncSave(kv, s)).toBe(s)
  kv.m.set(SAVE_KEY, '{not json')
  expect(syncSave(kv, s)).toBe(s)
  kv.m.set(SAVE_KEY, '{"version":2}')
  expect(syncSave(kv, s)).toBe(s)
  expect([...kv.m.keys()]).toEqual([SAVE_KEY])
  const bad = { getItem: () => { throw new Error('x') }, setItem: () => {} }
  expect(syncSave(bad, s)).toBe(s)
})

test('저장소에 써지고 다시 읽히면 저장할 수 있음', () => {
  const kv = mem()
  expect(canPersist(kv)).toBe(true)
  // 시험 값은 저장 키를 건드리지 않는다
  expect(kv.m.has(SAVE_KEY)).toBe(false)
})

test('쓰기가 막혔거나(가득 참 등) 써도 읽히지 않으면 저장할 수 없음', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
  expect(canPersist(full)).toBe(false)
  const lost = { getItem: () => null, setItem: () => {} }
  expect(canPersist(lost)).toBe(false)
  const broken = { getItem: () => { throw new Error('x') }, setItem: () => {} }
  expect(canPersist(broken)).toBe(false)
})
