import { describe, expect, test } from 'vitest'
import { BLINK_MS, FACES, HAPPY_MS, blinkGap, canBlink, endFace, moodFace, pickFace, stepFace } from './face'

describe('moodFace', () => {
  test('쉬는 중은 기본, 활동 중은 집중, 휴식 중은 졸림, 상한을 채우면 기쁨', () => {
    expect(moodFace('rest', [])).toBe('idle')
    expect(moodFace('exercise', [])).toBe('focus')
    expect(moodFace('study', [])).toBe('focus')
    expect(moodFace('reading', [])).toBe('focus')
    expect(moodFace('relax', [])).toBe('sleepy')
    expect(moodFace('full', [])).toBe('happy')
  })

  test('휴식을 많이 한 말랑이는 쉬는 중에도 졸린 눈이다', () => {
    expect(moodFace('rest', ['relax'])).toBe('sleepy')
    expect(moodFace('rest', ['exercise', 'relax'])).toBe('sleepy')
    // 활동 중에는 특징보다 지금 하는 일이 먼저다
    expect(moodFace('study', ['relax'])).toBe('focus')
  })
})

describe('전투 표정', () => {
  test('때릴 땐 집중, 맞으면 맞음, 피하면 기쁨', () => {
    expect(stepFace({ actor: 'player', kind: 'hit' })).toBe('focus')
    expect(stepFace({ actor: 'player', kind: 'miss' })).toBe('focus')
    expect(stepFace({ actor: 'enemy', kind: 'hit' })).toBe('hurt')
    expect(stepFace({ actor: 'enemy', kind: 'miss' })).toBe('happy')
  })

  test('이기면 승리, 지면 맞음', () => {
    expect(endFace(true)).toBe('win')
    expect(endFace(false)).toBe('hurt')
  })
})

describe('깜빡임', () => {
  test('눈을 뜬 표정만 깜빡인다', () => {
    expect(FACES.filter(canBlink)).toEqual(['idle', 'focus'])
  })

  test('몇 초마다 깜빡이고 가끔 두 번 연달아 깜빡인다. 같은 번호면 늘 같다', () => {
    const gaps = Array.from({ length: 12 }, (_, i) => blinkGap(i))
    expect(gaps).toEqual(Array.from({ length: 12 }, (_, i) => blinkGap(i)))
    const long = gaps.filter((g) => g >= 2000)
    expect(long.length).toBeGreaterThanOrEqual(8)
    for (const g of long) expect(g).toBeLessThanOrEqual(5000)
    // 두 번 깜빡임은 눈을 뜬 틈이 보일 만큼 띄운다
    const double = gaps.filter((g) => g < 2000)
    expect(double.length).toBeGreaterThan(0)
    for (const g of double) expect(g).toBeGreaterThanOrEqual(BLINK_MS + 80)
    // 두 번 연달아 짧지 않다
    gaps.forEach((g, i) => i > 0 && g < 2000 && expect(gaps[i - 1]).toBeGreaterThanOrEqual(2000))
  })
})

describe('pickFace', () => {
  test('눌린 뒤 잠깐은 기쁨, 깜빡이는 동안은 감은 눈, 아니면 기본 표정', () => {
    expect(pickFace('idle', { now: 100, happyUntil: 100 + HAPPY_MS })).toBe('happy')
    expect(pickFace('idle', { now: 1000, happyUntil: 900 })).toBe('idle')
    expect(pickFace('idle', { now: 1000, blinkUntil: 1050 })).toBe('blink')
    expect(pickFace('focus', { now: 1000, blinkUntil: 1050 })).toBe('blink')
    // 졸린 눈·승리·맞음은 깜빡이지 않는다
    expect(pickFace('sleepy', { now: 1000, blinkUntil: 1050 })).toBe('sleepy')
    expect(pickFace('win', { now: 1000, blinkUntil: 1050, happyUntil: 2000 })).toBe('win')
    expect(pickFace('hurt', { now: 1000, happyUntil: 2000 })).toBe('hurt')
  })
})
