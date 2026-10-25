import { test, expect } from 'vitest'
import { formatElapsed, formatMinutes, objectJosa, sessionSummary, topicJosa } from './format'

test('한 시간 미만은 MM:SS', () => {
  expect(formatElapsed(0)).toBe('00:00')
  expect(formatElapsed(30 * 60_000)).toBe('30:00')
  expect(formatElapsed(65_999)).toBe('01:05')
})

test('한 시간 이상은 H:MM:SS', () => {
  expect(formatElapsed(3_600_000 + 61_000)).toBe('1:01:01')
})

test('음수는 00:00', () => {
  expect(formatElapsed(-5000)).toBe('00:00')
})

test('분은 한 시간 미만이면 N분, 이상이면 N시간 M분', () => {
  expect(formatMinutes(40)).toBe('40분')
  expect(formatMinutes(60)).toBe('1시간')
  expect(formatMinutes(130)).toBe('2시간 10분')
})

test('운동 마침 요약은 한 시간·얻은 경험치·오른 능력치를 보여 줌', () => {
  const g = { minutes: 32, exp: 320, stats: { str: 3, vit: 3, int: 0, focus: 0 } }
  expect(sessionSummary(g, false)).toEqual({ title: '🎉 운동 32분 했어요!', detail: 'EXP +320 · 💪 힘 +3 · ❤️ 체력 +3' })
  expect(sessionSummary({ ...g, exp: 40, stats: { str: 0, vit: 0, int: 0, focus: 0 } }, false).detail).toBe('EXP +40')
})

test('공부 마침 요약은 공부 이름과 오른 지능을 보여 줌', () => {
  const g = { minutes: 25, exp: 250, stats: { str: 0, vit: 0, int: 5, focus: 0 } }
  expect(sessionSummary(g, false, 'study')).toEqual({ title: '🎉 공부 25분 했어요!', detail: 'EXP +250 · 🧠 지능 +5' })
  expect(sessionSummary({ ...g, minutes: 0, exp: 0 }, false, 'study').title).toBe('🎉 공부를 마쳤어요!')
})

test('독서 마침 요약은 독서 이름과 오른 집중을 보여 줌', () => {
  const g = { minutes: 15, exp: 150, stats: { str: 0, vit: 0, int: 0, focus: 3 } }
  expect(sessionSummary(g, false, 'reading')).toEqual({ title: '🎉 독서 15분 했어요!', detail: 'EXP +150 · 🎯 집중 +3' })
  expect(sessionSummary({ ...g, minutes: 0, exp: 0 }, false, 'reading').title).toBe('🎉 독서를 마쳤어요!')
})

test('휴식 마침 요약은 휴식 이름과 오른 체력을 보여 줌', () => {
  const g = { minutes: 30, exp: 300, stats: { str: 0, vit: 2, int: 0, focus: 0 } }
  expect(sessionSummary(g, true, 'relax')).toEqual({ title: '🎉 휴식 30분 했어요!', detail: 'EXP +300 · ❤️ 체력 +2' })
})

test('받침에 맞춰 을/를, 은/는을 고른다', () => {
  expect(['운동', '공부', '독서', '휴식'].map(objectJosa)).toEqual(['을', '를', '를', '을'])
  expect(['운동', '공부', '독서', '휴식'].map(topicJosa)).toEqual(['은', '는', '는', '은'])
})

test('경험치를 못 얻었으면 까닭을 알려 줌', () => {
  const none = { str: 0, vit: 0, int: 0, focus: 0 }
  expect(sessionSummary({ minutes: 20, exp: 0, stats: none }, true)).toEqual({
    title: '🎉 운동 20분 했어요!',
    detail: '상한을 채워서 경험치는 내일 쌓여요',
  })
  expect(sessionSummary({ minutes: 0, exp: 0, stats: none }, false)).toEqual({
    title: '🎉 운동을 마쳤어요!',
    detail: '1분 넘게 하면 경험치가 쌓여요',
  })
})
