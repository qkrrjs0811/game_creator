import { test, expect } from 'vitest'
import { charName, checkName, DEFAULT_NAME, renameMalang } from './name'
import { parseBackup } from './backup'
import { newSave } from './session'

test('이름을 짓지 않았으면 말랑이', () => {
  expect(charName(newSave())).toBe(DEFAULT_NAME)
  expect(DEFAULT_NAME).toBe('말랑이')
})

test('1~8자 이름은 앞뒤 빈칸을 빼고 받는다', () => {
  expect(checkName('  콩떡 ')).toEqual({ ok: true, name: '콩떡' })
  expect(checkName('가나다라마바사아')).toEqual({ ok: true, name: '가나다라마바사아' })
  expect(checkName('a')).toEqual({ ok: true, name: 'a' })
})

test('가운데 빈칸이 여러 개면 하나로 줄이고 줄바꿈·제어 문자는 뺀다', () => {
  expect(checkName('말랑   콩')).toEqual({ ok: true, name: '말랑 콩' })
  expect(checkName('콩\n떡\u0007')).toEqual({ ok: true, name: '콩 떡' })
})

test('비었거나 8자를 넘으면 거절', () => {
  expect(checkName('   ')).toEqual({ ok: false, reason: 'empty' })
  expect(checkName('가나다라마바사아자')).toEqual({ ok: false, reason: 'long' })
})

test('이모지는 한 글자로 센다', () => {
  expect(checkName('🍡🍡🍡🍡🍡🍡🍡🍡')).toEqual({ ok: true, name: '🍡🍡🍡🍡🍡🍡🍡🍡' })
})

test('이름을 지으면 저장에 남고 기록·성장은 그대로', () => {
  const s = { ...newSave(), stageProgress: 3, skills: ['punch'] }
  const next = renameMalang(s, ' 콩떡 ')!
  expect(next.name).toBe('콩떡')
  expect(charName(next)).toBe('콩떡')
  expect({ ...next, name: undefined }).toEqual({ ...s, name: undefined })
})

test('틀린 이름이면 바꾸지 않는다(null)', () => {
  expect(renameMalang(newSave(), '')).toBeNull()
  expect(renameMalang(newSave(), '아주아주아주긴이름')).toBeNull()
})

test('기본 이름으로 되돌리면 저장에서 이름을 지운다', () => {
  const named = renameMalang(newSave(), '콩떡')!
  const back = renameMalang(named, '말랑이')!
  expect(back).toEqual(newSave())
  expect('name' in back).toBe(false)
})

test('이름이 없던 이전 형식 저장은 말랑이로 읽는다', () => {
  const r = parseBackup(JSON.stringify(newSave()))
  expect(r.ok && charName(r.save)).toBe('말랑이')
  expect(r.ok && 'name' in r.save).toBe(false)
})

test('지은 이름은 백업을 오가도 남는다', () => {
  const r = parseBackup(JSON.stringify({ ...newSave(), name: '콩떡' }))
  expect(r).toEqual({ ok: true, save: { ...newSave(), name: '콩떡' } })
})

test('저장의 이름이 너무 길거나 비었으면 기록은 살리고 이름만 기본으로', () => {
  for (const name of ['', '아주아주아주긴이름']) {
    const r = parseBackup(JSON.stringify({ ...newSave(), stageProgress: 2, name }))
    expect(r).toEqual({ ok: true, save: { ...newSave(), stageProgress: 2 } })
  }
})

test('이름 자리에 글자가 아닌 값이 있으면 틀린 저장', () => {
  expect(parseBackup(JSON.stringify({ ...newSave(), name: 3 }))).toEqual({ ok: false })
})
