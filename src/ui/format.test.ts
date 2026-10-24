import { test, expect } from 'vitest'
import { formatElapsed } from './format'

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
