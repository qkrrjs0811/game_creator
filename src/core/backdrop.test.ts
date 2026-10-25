import { describe, test, expect } from 'vitest'
import { BACKDROP_DECORS, chapterBackdrop, stageBackdrop } from './backdrop'

/** HSL 밝기(0~1) */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((v) => v / 255)
  return (Math.max(...ch) + Math.min(...ch)) / 2
}

describe('chapterBackdrop 장마다 배경', () => {
  test('1장은 지금 하늘색→연두 배경 그대로', () => {
    expect(chapterBackdrop(1)).toMatchObject({ sky: '#bfe6ff', skyLow: '#e4f7d6', decor: 'clouds' })
  })

  test('같은 장은 언제나 같은 배경', () => {
    expect(chapterBackdrop(7)).toEqual(chapterBackdrop(7))
  })

  test('이웃한 장은 하늘색과 장식이 다르다', () => {
    for (let c = 1; c <= 40; c++) {
      const a = chapterBackdrop(c)
      const b = chapterBackdrop(c + 1)
      expect(a.sky).not.toBe(b.sky)
      expect(a.decor).not.toBe(b.decor)
    }
  })

  test('처음 여덟 장은 모두 다른 장식', () => {
    const decors = new Set(Array.from({ length: 8 }, (_, i) => chapterBackdrop(i + 1).decor))
    expect(decors.size).toBe(8)
    for (const d of decors) expect(BACKDROP_DECORS).toContain(d)
  })

  test('모든 색은 #rrggbb 파스텔(밝기 0.75 이상)이라 갈색 글자가 잘 읽힌다', () => {
    for (let c = 1; c <= 30; c++) {
      const b = chapterBackdrop(c)
      for (const hex of [b.sky, b.skyLow, b.ground]) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/)
        expect(lightness(hex)).toBeGreaterThanOrEqual(0.75)
      }
    }
  })

  test('끝없이 이어져도 배경이 있다', () => {
    expect(chapterBackdrop(1000).sky).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('이상한 장 번호는 1장으로 본다', () => {
    expect(chapterBackdrop(0)).toEqual(chapterBackdrop(1))
    expect(chapterBackdrop(-3)).toEqual(chapterBackdrop(1))
    expect(chapterBackdrop(Number.NaN)).toEqual(chapterBackdrop(1))
  })
})

describe('stageBackdrop 스테이지의 배경', () => {
  test('스테이지 번호가 속한 장의 배경', () => {
    expect(stageBackdrop(1)).toEqual(chapterBackdrop(1))
    expect(stageBackdrop(10)).toEqual(chapterBackdrop(1))
    expect(stageBackdrop(11)).toEqual(chapterBackdrop(2))
    expect(stageBackdrop(123)).toEqual(chapterBackdrop(13))
  })
})
