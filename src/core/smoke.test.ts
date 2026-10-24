import { test, expect } from 'vitest'

test('timezone is KST', () => {
  expect(new Date(Date.parse('2026-10-24T00:30:00+09:00')).getDate()).toBe(24)
})
