import { describe, test, expect } from 'vitest'
import { playerFighter, simulateBattle } from './battle'
import { BASE_STAT } from './progression'
import { MONSTERS, homeMonster, stageEnemy, stageMonster } from './monsters'
import { STAGES } from './stages'

const stats = (n: number) => ({ str: n, vit: n, int: BASE_STAT })

describe('MONSTERS', () => {
  test('몬스터 5종과 보스 1종, 스테이지마다 하나씩', () => {
    expect(MONSTERS).toHaveLength(STAGES.length)
    expect(MONSTERS.filter((m) => m.boss)).toHaveLength(1)
    expect(MONSTERS.filter((m) => !m.boss)).toHaveLength(5)
    for (const s of STAGES) expect(stageMonster(s.no).boss).toBe(s.boss)
  })

  test('이름·모양·색·능력치가 모두 다르다', () => {
    const uniq = (xs: unknown[]) => new Set(xs.map((x) => JSON.stringify(x))).size
    expect(uniq(MONSTERS.map((m) => m.id))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.name))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.shape))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.color))).toBe(MONSTERS.length)
    expect(uniq(MONSTERS.map((m) => m.stats))).toBe(MONSTERS.length)
  })
})

describe('stageEnemy', () => {
  test('스테이지 몬스터의 이름과 능력치로 싸우고, 뒤로 갈수록 세진다', () => {
    const enemies = STAGES.map((s) => stageEnemy(s.no))
    enemies.forEach((e, i) => expect(e.name).toBe(MONSTERS[i].name))
    for (let i = 1; i < enemies.length; i++) {
      expect(enemies[i].hp).toBeGreaterThan(enemies[i - 1].hp)
      expect(enemies[i].atk).toBeGreaterThan(enemies[i - 1].atk)
    }
  })

  test('범위를 벗어난 번호도 가장 가까운 스테이지로', () => {
    expect(stageEnemy(0)).toEqual(stageEnemy(1))
    expect(stageEnemy(99)).toEqual(stageEnemy(STAGES.length))
  })

  test('처음 시작한 말랑이도 1스테이지는 이길 수 있고 2스테이지는 아직 어렵다', () => {
    const me = playerFighter(stats(BASE_STAT), [])
    for (let seed = 0; seed < 300; seed++) {
      expect(simulateBattle(me, stageEnemy(1), seed).win).toBe(true)
      expect(simulateBattle(me, stageEnemy(2), seed).win).toBe(false)
    }
  })

  test('운동으로 충분히 키우면 보스도 이길 수 있다', () => {
    const me = playerFighter(stats(40), [])
    for (let seed = 0; seed < 100; seed++) expect(simulateBattle(me, stageEnemy(STAGES.length), seed).win).toBe(true)
  })
})

describe('homeMonster', () => {
  test('홈 장면에는 다음에 도전할 스테이지의 몬스터가 나온다', () => {
    expect(homeMonster(0).id).toBe(MONSTERS[0].id)
    expect(homeMonster(2).id).toBe(MONSTERS[2].id)
    expect(homeMonster(STAGES.length).id).toBe(MONSTERS[STAGES.length - 1].id)
    expect(homeMonster(-3).id).toBe(MONSTERS[0].id)
  })
})
