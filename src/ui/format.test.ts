import { test, expect } from 'vitest'
import { formatElapsed, formatMinutes, sessionSummary } from './format'

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
  const g = { minutes: 32, exp: 320, stats: { str: 3, vit: 3, int: 0 } }
  expect(sessionSummary(g, false)).toEqual({ title: '🎉 운동 32분 했어요!', detail: 'EXP +320 · 💪 힘 +3 · ❤️ 체력 +3' })
  expect(sessionSummary({ ...g, exp: 40, stats: { str: 0, vit: 0, int: 0 } }, false).detail).toBe('EXP +40')
})

test('경험치를 못 얻었으면 까닭을 알려 줌', () => {
  const none = { str: 0, vit: 0, int: 0 }
  expect(sessionSummary({ minutes: 20, exp: 0, stats: none }, true)).toEqual({
    title: '🎉 운동 20분 했어요!',
    detail: '오늘 상한을 채워서 경험치는 내일 다시 쌓여요',
  })
  expect(sessionSummary({ minutes: 0, exp: 0, stats: none }, false)).toEqual({
    title: '🎉 운동을 마쳤어요!',
    detail: '1분 넘게 하면 경험치가 쌓여요',
  })
})
