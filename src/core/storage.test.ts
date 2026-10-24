import { test, expect } from 'vitest'
import { loadSave, writeSave, SAVE_KEY } from './storage'
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
