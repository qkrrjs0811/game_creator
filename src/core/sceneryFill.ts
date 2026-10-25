/** 장면 안의 네모 칸(위에서부터 px) */
export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface FillInput {
  /** 장면 너비·높이 */
  w: number
  h: number
  /** 땅 띠 위끝 */
  top: number
  /** 말랑이·몬스터 발끝 */
  feet: number
  /** 나무·풀이 들어가면 안 되는 칸(캐릭터·소품) */
  keepOut: Box[]
}

export interface SceneryFill {
  /** 땅 뒤로 낮게 솟은 먼 언덕(원 중심과 반지름) */
  farHills: { x: number; y: number; r: number }[]
  /** 먼 언덕 위의 둥근 나무. (x, 아래끝 y)에 서고 size는 잎 반지름 */
  trees: { x: number; y: number; size: number; box: Box }[]
  /** 땅 띠 위의 풀 포기. (x, 아래끝 y) */
  tufts: { x: number; y: number; s: number; box: Box }[]
  /** 하늘 가장자리의 작은 구름 */
  puffs: { x: number; y: number; s: number }[]
}

/** 먼 언덕이 땅 위끝보다 솟는 최대 높이 */
export const FAR_RISE = 24
/** 채우기 그림의 반투명. 캐릭터가 묻히지 않게 모두 연하다 */
export const FILL_ALPHA = { farHills: 0.5, trees: 0.45, tufts: 0.55, puffs: 0.5 } as const

const TREE_SPOTS = [0.04, 0.15, 0.5, 0.86, 0.97]
const TUFT_STEP = 44

/** 0~1 사이의 고정된 흔들림(자리마다 늘 같다) */
function jitter(i: number): number {
  const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453
  return v - Math.floor(v)
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const free = (box: Box, keep: Box[]) => keep.every((k) => !overlaps(box, k))

/**
 * 빈 하늘·빈 땅을 채우는 배경 그림의 자리. 그림만 정하고 성장·저장과는 상관없다.
 * 먼 언덕은 땅 위로 조금만 솟아 지평선을 둥글게 하고, 나무·풀은 캐릭터·소품 칸을 비켜 선다
 */
export function sceneryFill({ w, h, top, feet, keepOut }: FillInput): SceneryFill {
  const farHills: SceneryFill['farHills'] = []
  for (let i = 0, x = -24; x < w + 60; i++, x += 64) {
    const r = 44 + Math.round(jitter(i) * 18)
    const rise = 12 + Math.round(jitter(i + 50) * (FAR_RISE - 12))
    farHills.push({ x, y: top - rise + r, r })
  }

  const trees: SceneryFill['trees'] = []
  TREE_SPOTS.forEach((fx, i) => {
    const size = 12 + Math.round(jitter(i + 100) * 5)
    const x = Math.round(w * fx)
    const y = top + 4
    const box = { x0: x - size, x1: x + size, y0: y - size * 2.6, y1: y }
    if (box.x0 >= -size * 0.5 && box.x1 <= w + size * 0.5 && free(box, keepOut)) trees.push({ x, y, size, box })
  })

  const tufts: SceneryFill['tufts'] = []
  // 첫 줄은 땅 위끝(캐릭터 옆), 다음 줄부터는 발끝 아래로 엇갈려 놓는다
  const rows = [top + 12]
  for (let y = feet + 22; y <= h - 6; y += 30) rows.push(y)
  rows.forEach((y, r) => {
    for (let i = 0, x = (r % 2) * (TUFT_STEP / 2) + 14; x < w - 8; i++, x += TUFT_STEP) {
      const k = r * 31 + i
      if (jitter(k + 200) < 0.3) continue
      const s = 0.8 + jitter(k + 300) * 0.4
      const tx = Math.round(x + (jitter(k + 400) - 0.5) * 14)
      const box = { x0: tx - 8 * s, x1: tx + 8 * s, y0: y - 10 * s, y1: y }
      if (box.x0 >= 0 && box.x1 <= w && box.y0 >= top && box.y1 <= h && free(box, keepOut)) tufts.push({ x: tx, y, s, box })
    }
  })

  const puffs = [
    { x: w * 0.08, y: top * 0.5, s: 0.5 },
    { x: w * 0.93, y: top * 0.6, s: 0.42 },
  ]

  return { farHills, trees, tufts, puffs }
}
