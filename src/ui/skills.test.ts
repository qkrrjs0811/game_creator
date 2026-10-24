import { expect, test } from 'vitest'
import { objectParticle } from './skills'

test('받침에 맞는 을/를', () => {
  expect(objectParticle('단단한 몸')).toBe('을')
  expect(objectParticle('날쌘 발')).toBe('을')
  expect(objectParticle('말랑 펀치')).toBe('를')
})
