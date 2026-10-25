import { describe, test, expect } from 'vitest'
import { FAR_RISE, FILL_ALPHA, sceneryFill, type Box } from './sceneryFill'

/** 폰 장면 크기(장면 너비 약 362, 높이 약 470)와 말랑이·몬스터·소품 자리 */
const W = 362
const H = 470
const TOP = 300
const FEET = TOP + 14
const KEEP: Box[] = [
  { x0: 109 - 56, x1: 109 + 56, y0: 0, y1: FEET + 4 },
  { x0: 261 - 64, x1: 261 + 64, y0: 0, y1: FEET + 4 },
  { x0: 33, x1: 77, y0: FEET - 48, y1: FEET + 4 },
]
const input = { w: W, h: H, top: TOP, feet: FEET, keepOut: KEEP }

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

describe('sceneryFill 장면 채우기', () => {
  test('같은 크기면 언제나 같은 자리', () => {
    expect(sceneryFill(input)).toEqual(sceneryFill(input))
  })

  test('먼 언덕이 장면 양 끝까지 이어져 땅 위 하늘을 낮춘다', () => {
    const { farHills } = sceneryFill(input)
    expect(farHills.length).toBeGreaterThanOrEqual(4)
    expect(Math.min(...farHills.map((c) => c.x - c.r))).toBeLessThanOrEqual(0)
    expect(Math.max(...farHills.map((c) => c.x + c.r))).toBeGreaterThanOrEqual(W)
    for (const c of farHills) {
      // 땅 위로 조금만 솟아 캐릭터 몸 아래쪽 뒤에만 깔린다
      const rise = TOP - (c.y - c.r)
      expect(rise).toBeGreaterThan(0)
      expect(rise).toBeLessThanOrEqual(FAR_RISE)
    }
  })

  test('나무·풀은 말랑이·몬스터·소품 자리와 겹치지 않는다', () => {
    const { trees, tufts } = sceneryFill(input)
    expect(trees.length).toBeGreaterThanOrEqual(2)
    expect(tufts.length).toBeGreaterThanOrEqual(6)
    for (const item of [...trees, ...tufts]) for (const k of KEEP) expect(overlaps(item.box, k)).toBe(false)
  })

  test('나무는 땅 위끝에 서고, 풀은 땅 띠 안에 있다', () => {
    const { trees, tufts } = sceneryFill(input)
    for (const t of trees) {
      expect(t.box.y1).toBeGreaterThanOrEqual(TOP)
      expect(t.box.y0).toBeGreaterThan(0)
    }
    for (const t of tufts) {
      expect(t.box.y0).toBeGreaterThanOrEqual(TOP)
      expect(t.box.y1).toBeLessThanOrEqual(H)
      expect(t.box.x0).toBeGreaterThanOrEqual(0)
      expect(t.box.x1).toBeLessThanOrEqual(W)
    }
  })

  test('작은 구름은 하늘 가장자리 가운데쯤이라 말풍선(위쪽 가운데)과 땅에 닿지 않는다', () => {
    const { puffs } = sceneryFill(input)
    expect(puffs.length).toBeGreaterThanOrEqual(2)
    for (const p of puffs) {
      expect(p.x < W * 0.25 || p.x > W * 0.75).toBe(true)
      expect(p.y).toBeGreaterThan(TOP * 0.3)
      expect(p.y).toBeLessThan(TOP * 0.7)
    }
  })

  test('배경 채우기는 모두 연하다(반투명 0.6 이하)', () => {
    for (const a of Object.values(FILL_ALPHA)) {
      expect(a).toBeGreaterThan(0)
      expect(a).toBeLessThanOrEqual(0.6)
    }
  })

  test('넓은 장면에는 더 많이 채운다', () => {
    const wide = sceneryFill({ ...input, w: W * 2, keepOut: [] })
    const narrow = sceneryFill({ ...input, keepOut: [] })
    expect(wide.tufts.length).toBeGreaterThan(narrow.tufts.length)
    expect(wide.farHills.length).toBeGreaterThan(narrow.farHills.length)
  })

  test('낮은 장면(저장 실패 경고)에서도 땅 띠 밖으로 나가지 않는다', () => {
    const low = { w: W, h: 385, top: 224, feet: 238, keepOut: [] }
    for (const t of sceneryFill(low).tufts) expect(t.box.y1).toBeLessThanOrEqual(385)
  })
})
