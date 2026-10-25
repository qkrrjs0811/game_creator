import { describe, expect, test } from 'vitest'
import { MONSTERS } from './monsters'
import { endlessStage } from './endless'
import { autoStepDelay, stepDelay } from './replay'
import { bossDropOffset, bossEntrance, bossNameTag } from './bossEntrance'

const boss = MONSTERS.find((m) => m.boss)!
const plain = MONSTERS.filter((m) => !m.boss)

describe('보스 등장 연출', () => {
  test('보스 전투에만 등장 연출이 있다', () => {
    expect(bossEntrance(boss, 600)).not.toBeNull()
    expect(bossEntrance(endlessStage(20).monster, 600)).not.toBeNull()
    for (const m of plain) expect(bossEntrance(m, 600)).toBeNull()
    expect(bossEntrance(endlessStage(19).monster, 600)).toBeNull()
  })

  test('어두워짐 → 쿵 내려옴 → 이름표 → 밝아짐 순서이고, 끝나야 첫 걸음이 온다', () => {
    const e = bossEntrance(boss, 600)!
    expect(e.dim).toBeGreaterThan(0)
    // 화면이 다 어두워진 뒤 떨어지기 시작한다
    expect(e.dropAt).toBeGreaterThanOrEqual(e.dim)
    // 땅에 닿는 순간 쿵(흔들림)과 함께 이름표가 뜬다
    expect(e.landAt).toBe(e.dropAt + e.drop)
    expect(e.tagAt).toBe(e.landAt)
    expect(e.shake).toBeGreaterThan(0)
    // 이름표를 읽을 시간을 준다
    expect(e.hold).toBeGreaterThanOrEqual(700)
    expect(e.fadeAt).toBe(e.tagAt + e.hold)
    expect(e.total).toBe(e.fadeAt + e.fade)
  })

  test('어둡게 해도 캐릭터가 보일 만큼만 어둡게 한다', () => {
    const e = bossEntrance(boss, 600)!
    expect(e.dimAlpha).toBeGreaterThan(0.2)
    expect(e.dimAlpha).toBeLessThanOrEqual(0.45)
  })

  test('한 판 전투는 2초 안, 빠른 자동 진행은 더 짧게 끝난다', () => {
    for (const steps of [2, 10, 40]) {
      const one = bossEntrance(boss, stepDelay(steps))!
      const auto = bossEntrance(boss, autoStepDelay(steps))!
      expect(one.total).toBeLessThanOrEqual(2000)
      expect(auto.total).toBeLessThan(one.total)
      // 너무 빨라 무슨 일인지 모르게 되지는 않는다
      expect(auto.total).toBeGreaterThanOrEqual(900)
      expect(auto.hold).toBeGreaterThanOrEqual(400)
    }
  })

  test('떨어지기 전에는 머리끝까지 장면 위 밖에 있다', () => {
    // 몬스터 발 자리 y=250, 머리끝 -70(몸 기준)
    const off = bossDropOffset(250, -70)
    expect(250 + off + -70).toBeLessThanOrEqual(-8)
    expect(off).toBeLessThan(0)
  })

  test('이름표는 "보스 등장!"과 몬스터 이름이다', () => {
    expect(bossNameTag(boss)).toEqual({ title: '보스 등장!', name: boss.name })
  })
})
