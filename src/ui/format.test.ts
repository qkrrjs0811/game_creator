import { test, expect } from 'vitest'
import { formatElapsed, formatMinutes } from './format'

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
