import { describe, expect, it } from 'vitest'
import { contactAt, hitImpact, impactLength } from './impact'

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
