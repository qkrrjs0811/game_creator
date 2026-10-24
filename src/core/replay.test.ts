import { describe, test, expect } from 'vitest'
import { playerFighter, simulateBattle } from './battle'
import { BASE_STAT } from './progression'
import { battleTimeline, stageEnemy, stepDelay } from './replay'
import { STAGES } from './stages'

const base = { str: BASE_STAT, vit: BASE_STAT, int: BASE_STAT }

describe('stageEnemy', () => {
  test('스테이지마다 상대가 있고 뒤로 갈수록 세진다', () => {
    const enemies = STAGES.map((s) => stageEnemy(s.no))
    for (let i = 1; i < enemies.length; i++) {
      expect(enemies[i].hp).toBeGreaterThan(enemies[i - 1].hp)
      expect(enemies[i].atk).toBeGreaterThan(enemies[i - 1].atk)
    }
  })

  test('처음 시작한 말랑이도 1스테이지는 이길 수 있고 2스테이지는 아직 어렵다', () => {
    const me = playerFighter(base, [])
    // 씨앗(흔들림)이 달라도 결과는 같다
    for (let seed = 0; seed < 300; seed++) {
      expect(simulateBattle(me, stageEnemy(1), seed).win).toBe(true)
      expect(simulateBattle(me, stageEnemy(2), seed).win).toBe(false)
    }
  })
})

describe('battleTimeline', () => {
  test('기록 한 줄마다 장면 한 걸음, 양쪽 HP 비율이 따라간다', () => {
    const me = playerFighter(base, [])
    const enemy = stageEnemy(1)
    const result = simulateBattle(me, enemy, 7)
    const t = battleTimeline(me, enemy, result)
    expect(t.steps).toHaveLength(result.log.length)
    expect(t.win).toBe(result.win)
    for (const s of t.steps) {
      expect(s.playerHp).toBeGreaterThanOrEqual(0)
      expect(s.playerHp).toBeLessThanOrEqual(1)
      expect(s.enemyHp).toBeGreaterThanOrEqual(0)
      expect(s.enemyHp).toBeLessThanOrEqual(1)
    }
    const last = t.steps[t.steps.length - 1]
    expect(last.enemyHp).toBe(0)
    expect(last.playerHp).toBeCloseTo(result.playerHp / me.hp)
  })

  test('맞은 쪽 HP만 줄고, 빗나가면 그대로', () => {
    const me = playerFighter(base, [])
    const enemy = stageEnemy(1)
    const t = battleTimeline(me, enemy, simulateBattle(me, enemy, 3))
    let prev = { playerHp: 1, enemyHp: 1 }
    for (const s of t.steps) {
      if (s.actor === 'player') expect(s.playerHp).toBe(prev.playerHp)
      else expect(s.enemyHp).toBe(prev.enemyHp)
      if (s.kind === 'miss') expect([s.playerHp, s.enemyHp]).toEqual([prev.playerHp, prev.enemyHp])
      prev = s
    }
  })
})

describe('stepDelay', () => {
  test('짧은 전투는 천천히, 긴 전투도 너무 길어지지 않게', () => {
    expect(stepDelay(4)).toBe(800)
    expect(stepDelay(60)).toBe(350)
    expect(stepDelay(20) * 20).toBeLessThanOrEqual(10_000)
  })
})
