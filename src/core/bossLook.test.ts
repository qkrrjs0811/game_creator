import { describe, expect, test } from 'vitest'
import { MONSTERS } from './monsters'
import { MONSTER_TOP } from './monsterLook'
import { endlessStage } from './endless'
import { hitImpact } from './impact'
import { ATTACK_CEILING, MONSTER_BOTTOM, MONSTER_IDLE, attackPlan, poseY, type Pose } from './monsterMotion'
import { BOSS_BAR_RAISE, BOSS_CAPE, BOSS_HALO, bossLook, monsterCeiling, monsterScale, monsterTop } from './bossLook'

const boss = MONSTERS.find((m) => m.boss)!
const plain = MONSTERS.filter((m) => !m.boss)

describe('보스 모습', () => {
  test('보스만 더 크고 왕관·망토·후광을 두른다', () => {
    expect(bossLook(boss)).toEqual(['crown', 'cape', 'halo'])
    expect(monsterScale(boss)).toBeGreaterThanOrEqual(1.1)
    for (const m of plain) {
      expect(bossLook(m)).toEqual([])
      expect(monsterScale(m)).toBe(1)
    }
  })

  test('끝없는 스테이지의 장 보스도 보스 모습이다', () => {
    for (const no of [10, 20, 50]) expect(bossLook(endlessStage(no).monster)).toContain('halo')
    expect(bossLook(endlessStage(19).monster)).toEqual([])
  })

  test('커져도 발끝은 땅에 그대로 있고 머리끝만 올라간다', () => {
    for (const m of plain) expect(monsterTop(m)).toBe(MONSTER_TOP[m.shape])
    const s = monsterScale(boss)
    expect(monsterTop(boss)).toBeCloseTo(MONSTER_BOTTOM - (MONSTER_BOTTOM - MONSTER_TOP[boss.shape]) * s)
    expect(monsterTop(boss)).toBeLessThan(MONSTER_TOP[boss.shape])
  })

  test('보스 HP 막대는 커진 만큼 위로 올라가고, 다른 몬스터 막대는 그대로다', () => {
    expect(BOSS_BAR_RAISE).toBeGreaterThan(0)
    expect(BOSS_BAR_RAISE).toBeLessThanOrEqual(16)
    expect(monsterCeiling(boss)).toBe(ATTACK_CEILING - BOSS_BAR_RAISE)
    for (const m of plain) expect(monsterCeiling(m)).toBe(ATTACK_CEILING)
  })

  test('커진 보스가 뛰어올라도 머리가 자기 HP 막대에 닿지 않는다', () => {
    const fx = hitImpact('hit', true, 650, true)
    const top = monsterTop(boss)
    // 움츠릴 때 바깥 몸이 1.06배 커지는 것까지 친다
    const head = (p: Pose) => (top * p.sy + poseY(p)) * 1.06
    for (const p of attackPlan(boss.shape, fx)) expect(head(p.pose)).toBeGreaterThanOrEqual(monsterCeiling(boss))
    expect(head(MONSTER_IDLE[boss.shape].pose)).toBeGreaterThanOrEqual(monsterCeiling(boss))
  })

  test('망토·후광은 몸 뒤에서 머리끝보다 위로, 땅보다 아래로 나가지 않는다', () => {
    const top = MONSTER_TOP[boss.shape]
    expect(BOSS_HALO.y - BOSS_HALO.ry).toBeGreaterThanOrEqual(top)
    expect(BOSS_HALO.y + BOSS_HALO.ry).toBeLessThanOrEqual(MONSTER_BOTTOM)
    expect(BOSS_CAPE.top).toBeGreaterThan(top)
    expect(BOSS_CAPE.bottom).toBeLessThanOrEqual(MONSTER_BOTTOM)
    // 몸(가로 ±42)보다 넓어야 옆으로 보인다
    expect(BOSS_CAPE.halfWidth).toBeGreaterThan(42)
    expect(BOSS_HALO.rx).toBeGreaterThan(42)
  })
})
