import { test, expect } from 'vitest'
import { backupFileName, exportBackup, importLosesProgress, parseBackup } from './backup'
import { newSave } from './session'
import type { SaveData } from './types'

const sample = (): SaveData => ({
  ...newSave(),
  records: [
    { id: 'exercise-1000', activity: 'exercise', startedAt: 1000, endedAt: 61_000 },
    { id: 'exercise-90000', activity: 'exercise', startedAt: 90_000, endedAt: 1_890_000 },
  ],
  skills: ['a'],
  stageProgress: 2,
  cosmetics: ['hat'],
  worn: ['hat'],
})

test('입은 꾸미기가 없던 이전 형식은 아무것도 안 입은 것으로 읽음', () => {
  const { worn: _, ...old } = sample()
  const r = parseBackup(JSON.stringify(old))
  expect(r).toEqual({ ok: true, save: { ...sample(), worn: [] } })
})

test('내보낸 백업을 다시 읽으면 같은 저장', () => {
  const s = sample()
  const r = parseBackup(exportBackup(s, 5000))
  expect(r).toEqual({ ok: true, save: s })
})

test('진행 중 세션도 함께 보존', () => {
  const s = { ...sample(), active: { activity: 'exercise' as const, startedAt: 2_000_000 } }
  expect(parseBackup(exportBackup(s, 0))).toEqual({ ok: true, save: s })
})

test('백업 파일에는 앱 표시와 내보낸 시각이 들어감', () => {
  const obj = JSON.parse(exportBackup(sample(), 5000))
  expect(obj.app).toBe('growth-game')
  expect(obj.exportedAt).toBe(5000)
})

test('저장 데이터를 그대로 담은 파일도 받아 줌', () => {
  const s = sample()
  expect(parseBackup(JSON.stringify(s))).toEqual({ ok: true, save: s })
})

test('JSON이 아니면 거절', () => {
  expect(parseBackup('{not json').ok).toBe(false)
  expect(parseBackup('').ok).toBe(false)
})

test('형식이 틀리면 거절', () => {
  const bad: unknown[] = [
    null,
    42,
    [],
    { app: 'other', save: sample() },
    { ...sample(), version: 2 },
    { ...sample(), records: 'x' },
    { ...sample(), records: [{ id: 'a', activity: 'dance', startedAt: 1, endedAt: 5 }] },
    { ...sample(), records: [{ id: 1, activity: 'exercise', startedAt: 1, endedAt: 5 }] },
    { ...sample(), records: [{ id: 'a', activity: 'exercise', startedAt: '1', endedAt: 5 }] },
    { ...sample(), active: { activity: 'exercise' } },
    { ...sample(), skills: [1] },
    { ...sample(), stageProgress: -1 },
    { ...sample(), stageProgress: 1.5 },
    { ...sample(), cosmetics: null },
    { ...sample(), worn: null },
    { ...sample(), worn: [1] },
  ]
  for (const b of bad) expect(parseBackup(JSON.stringify(b)).ok, JSON.stringify(b)).toBe(false)
})

test('모르는 필드는 버리고 아는 필드만 남김', () => {
  const s = sample()
  const r = parseBackup(JSON.stringify({ ...s, extra: 1, records: s.records.map((x) => ({ ...x, junk: true })) }))
  expect(r).toEqual({ ok: true, save: s })
})

test('파일 이름은 내보낸 날짜를 씀', () => {
  expect(backupFileName(new Date(2026, 9, 4, 23, 0).getTime())).toBe('growth-backup-2026-10-04.json')
})

test('끝이 시작보다 이른 기록이 섞여 있어도 백업 전체를 거절하지 않고 바로잡아 받음', () => {
  const save = { ...newSave(), records: [{ id: 'r', activity: 'exercise' as const, startedAt: 5000, endedAt: 1000 }] }
  const r = parseBackup(JSON.stringify(save))
  expect(r).toEqual({ ok: true, save: { ...save, records: [{ id: 'r', activity: 'exercise', startedAt: 5000, endedAt: 5000 }] } })
})

test('백업이 지금보다 덜 자랐으면(경험치나 깬 스테이지가 적으면) 잃는 것으로 봄', () => {
  const now = 2_000_000
  const s = sample()
  expect(importLosesProgress(s, newSave(), now)).toBe(true)
  expect(importLosesProgress(s, { ...s, stageProgress: 1 }, now)).toBe(true)
  expect(importLosesProgress(s, { ...s, records: s.records.slice(1) }, now)).toBe(true)
})

test('같거나 더 자란 백업은 잃지 않음', () => {
  const now = 2_000_000
  const s = sample()
  expect(importLosesProgress(s, s, now)).toBe(false)
  expect(importLosesProgress(newSave(), s, now)).toBe(false)
  expect(importLosesProgress(s, { ...s, stageProgress: 3 }, now)).toBe(false)
})

test('진행 중 타이머의 시간도 지금 것으로 셈', () => {
  const now = 1_000 + 31 * 60_000
  const running: SaveData = { ...newSave(), active: { activity: 'exercise', startedAt: 1_000 } }
  const done: SaveData = {
    ...newSave(),
    records: [{ id: 'exercise-1000', activity: 'exercise', startedAt: 1_000, endedAt: 1_000 + 10 * 60_000 }],
  }
  expect(importLosesProgress(running, done, now)).toBe(true)
  expect(importLosesProgress(done, running, now)).toBe(false)
})
