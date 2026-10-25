import { describe, test, expect } from 'vitest'
import { MONSTERS } from './monsters'
import { STAGES } from './stages'

describe('MONSTERS', () => {
  test('1장 앞쪽 몬스터 5종과 보스 1종의 모습', () => {
    expect(MONSTERS).toHaveLength(STAGES.length)
    expect(MONSTERS.filter((m) => m.boss)).toHaveLength(1)
    expect(MONSTERS.filter((m) => !m.boss)).toHaveLength(5)
  })

  test('이름·모양·색이 모두 다르다', () => {
    const uniq = (xs: unknown[]) => new Set(xs.map((x) => JSON.stringify(x))).size
    expect(uniq(MONSTERS.map((m) => m.id))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.name))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.shape))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.color))).toBe(MONSTERS.length)
  })
})
