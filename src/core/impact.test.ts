import { describe, expect, it } from 'vitest'
import { contactAt, finishDelay, hitImpact, hpTrail, impactLength, isFinalBlow } from './impact'
import type { ReplayStep } from './replay'

describe('hitImpact', () => {
  it('보통 타격은 움츠렸다 튀어 나가 부딪히고, 60~100ms 멈춘 뒤 밀리며 번쩍인다', () => {
    const i = hitImpact('hit', false, 800)
    expect(i.windup).toBeGreaterThan(0)
    expect(i.pull).toBeGreaterThan(0)
    expect(i.reach).toBeGreaterThan(i.pull)
    expect(i.hitstop).toBeGreaterThanOrEqual(60)
    expect(i.hitstop).toBeLessThanOrEqual(100)
    expect(i.flash).toBe(true)
    expect(i.knock).toBeGreaterThan(0)
    expect(i.squash).toBeGreaterThan(0)
    expect(i.sparks).toBeGreaterThan(0)
    // 보통 타격은 화면을 흔들거나 진동하지 않는다
    expect(i.shake).toBe(0)
    expect(i.vibrate).toBe(0)
  })

  it('치명타는 더 오래 멈추고 더 멀리 밀리며, 화면이 흔들리고 진동한다', () => {
    const hit = hitImpact('hit', false, 800)
    const crit = hitImpact('hit', true, 800)
    expect(crit.hitstop).toBeGreaterThan(hit.hitstop)
    expect(crit.hitstop).toBeLessThanOrEqual(100)
    expect(crit.knock).toBeGreaterThan(hit.knock)
    expect(crit.squash).toBeGreaterThan(hit.squash)
    expect(crit.sparks).toBeGreaterThan(hit.sparks)
    expect(crit.shake).toBeGreaterThan(0)
    expect(crit.shakePx).toBeGreaterThan(0)
    expect(crit.vibrate).toBeGreaterThan(0)
    // 잠깐 느려지듯 천천히 밀려난다
    expect(crit.back).toBeGreaterThan(hit.back)
  })

  it('빗나가면 멈춤·번쩍임·조각 없이 피하기만 한다', () => {
    const i = hitImpact('miss', false, 800)
    expect(i.windup).toBeGreaterThan(0)
    expect(i.hitstop).toBe(0)
    expect(i.flash).toBe(false)
    expect(i.knock).toBe(0)
    expect(i.squash).toBe(0)
    expect(i.sparks).toBe(0)
    expect(i.shake).toBe(0)
    expect(i.vibrate).toBe(0)
  })

  it('걸음 사이가 짧은 자동 진행에서도 한 번의 타격이 다음 걸음 전에 끝나고, 멈춤은 60ms 이상이다', () => {
    for (const delay of [250, 300, 350, 400, 500, 800]) {
      for (const [kind, crit] of [['hit', false], ['hit', true], ['miss', false]] as const) {
        const i = hitImpact(kind, crit, delay)
        expect(impactLength(i)).toBeLessThanOrEqual(delay)
        if (kind === 'hit') expect(i.hitstop).toBeGreaterThanOrEqual(60)
      }
    }
  })

  it('걸음이 짧으면 움직임도 빨라지지만, 길어도 한 걸음 동작은 느려지지 않는다', () => {
    expect(contactAt(hitImpact('hit', false, 250))).toBeLessThan(contactAt(hitImpact('hit', false, 800)))
    expect(contactAt(hitImpact('hit', false, 2000))).toBe(contactAt(hitImpact('hit', false, 800)))
  })
})

describe('마지막 한 방', () => {
  const step = (over: Partial<ReplayStep>): ReplayStep => ({
    actor: 'player',
    kind: 'hit',
    damage: 9,
    targetHp: 0,
    playerHp: 0.6,
    enemyHp: 0,
    ...over,
  })

  it('마지막 걸음에서 맞은 쪽 HP가 0이 되면 마지막 한 방이다', () => {
    expect(isFinalBlow(step({}), true)).toBe(true)
    expect(isFinalBlow(step({ actor: 'enemy', playerHp: 0, enemyHp: 0.3 }), true)).toBe(true)
    // 마지막이 아니거나, 빗나갔거나, 쓰러뜨리지 못했으면(오래 끌어 진 판) 아니다
    expect(isFinalBlow(step({}), false)).toBe(false)
    expect(isFinalBlow(step({ kind: 'miss', damage: 0, targetHp: 4, enemyHp: 0.2 }), true)).toBe(false)
    expect(isFinalBlow(step({ targetHp: 4, enemyHp: 0.2 }), true)).toBe(false)
  })

  it('마지막 한 방은 느린 동작으로 더 오래 멈추고, 더 크게 밀리고 흔들린다', () => {
    for (const delay of [250, 400, 800]) {
      for (const crit of [false, true]) {
        const hit = hitImpact('hit', crit, delay)
        const ko = hitImpact('hit', crit, delay, true)
        expect(contactAt(ko)).toBeGreaterThan(contactAt(hit))
        expect(ko.hitstop).toBeGreaterThanOrEqual(180)
        expect(ko.back).toBeGreaterThan(hit.back)
        expect(ko.knock).toBeGreaterThan(hit.knock)
        expect(ko.sparks).toBeGreaterThan(hit.sparks)
        expect(ko.shake).toBeGreaterThan(0)
        expect(ko.vibrate).toBeGreaterThan(0)
      }
    }
  })

  it('결과는 마지막 한 방 연출이 다 끝난 뒤에 보여 준다', () => {
    for (const delay of [250, 400, 800]) {
      const ko = hitImpact('hit', true, delay, true)
      expect(finishDelay(ko)).toBeGreaterThan(impactLength(ko))
      // 그래도 너무 오래 기다리게 하지 않는다
      expect(finishDelay(ko)).toBeLessThanOrEqual(1600)
      // 보통 걸음(오래 끌어 진 판)은 0.7초쯤 뒤, 마지막 한 방보다 빨리
      const plain = finishDelay(hitImpact('hit', false, delay))
      expect(plain).toBeGreaterThanOrEqual(700)
      expect(plain).toBeLessThan(finishDelay(ko))
    }
  })
})

describe('hpTrail', () => {
  it('옅은 막대는 잠깐 기다렸다가 깎인 만큼 천천히 따라 줄어든다', () => {
    const small = hpTrail(0.1)
    const big = hpTrail(0.6)
    expect(small.wait).toBeGreaterThan(0)
    expect(big.duration).toBeGreaterThan(small.duration)
    expect(big.duration).toBeLessThanOrEqual(900)
    expect(hpTrail(0).duration).toBeGreaterThan(0)
  })
})
