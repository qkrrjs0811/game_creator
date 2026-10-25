import { describe, expect, it } from 'vitest'
import { SOUND_NAMES, parseSoundOn, serializeSoundOn, soundLength, soundRecipe, stepSound } from './sound'

describe('soundRecipe', () => {
  it('모든 효과음은 짧고(1.2초 안) 귀가 아프지 않은 크기다', () => {
    for (const name of SOUND_NAMES) {
      const tones = soundRecipe(name)
      expect(tones.length).toBeGreaterThan(0)
      expect(soundLength(name)).toBeLessThanOrEqual(1.2)
      for (const t of tones) {
        expect(t.at).toBeGreaterThanOrEqual(0)
        expect(t.dur).toBeGreaterThan(0)
        expect(t.gain).toBeGreaterThan(0)
        expect(t.gain).toBeLessThanOrEqual(0.3)
        expect(t.freq).toBeGreaterThanOrEqual(60)
        expect(t.freq).toBeLessThanOrEqual(2400)
      }
    }
  })

  it('타격 소리는 다음 걸음(250ms) 전에 끝난다', () => {
    expect(soundLength('hit')).toBeLessThanOrEqual(0.25)
    expect(soundLength('miss')).toBeLessThanOrEqual(0.25)
  })

  it('치명타는 보통 타격보다 크고 길다', () => {
    const peak = (n: Parameters<typeof soundRecipe>[0]) => Math.max(...soundRecipe(n).map((t) => t.gain))
    expect(peak('crit')).toBeGreaterThan(peak('hit'))
    expect(soundLength('crit')).toBeGreaterThan(soundLength('hit'))
  })

  it('승리·레벨업은 올라가는 가락, 패배는 내려가는 가락이다', () => {
    const first = (n: Parameters<typeof soundRecipe>[0]) => soundRecipe(n)[0].freq
    const last = (n: Parameters<typeof soundRecipe>[0]) => {
      const t = soundRecipe(n)
      const end = t[t.length - 1]
      return end.to ?? end.freq
    }
    expect(last('win')).toBeGreaterThan(first('win'))
    expect(last('levelup')).toBeGreaterThan(first('levelup'))
    expect(last('lose')).toBeLessThan(first('lose'))
  })
})

describe('stepSound', () => {
  it('전투 한 걸음의 소리를 고른다', () => {
    expect(stepSound('hit', false)).toBe('hit')
    expect(stepSound('hit', true)).toBe('crit')
    expect(stepSound('miss', false)).toBe('miss')
  })
})

describe('parseSoundOn', () => {
  it('기본은 켬이고, 끈 것만 끔으로 읽는다', () => {
    expect(parseSoundOn(null)).toBe(true)
    expect(parseSoundOn('이상한 값')).toBe(true)
    expect(parseSoundOn(serializeSoundOn(false))).toBe(false)
    expect(parseSoundOn(serializeSoundOn(true))).toBe(true)
  })
})
