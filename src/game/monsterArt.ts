import Phaser from 'phaser'
import type { Monster, MonsterShape } from '../core/monsters'
import { MONSTER_FEATURES, MONSTER_TOP, type MonsterFace } from '../core/monsterLook'

const MONSTER_INK = 0x3d2a63
const CROWN = 0xffd36b
const MOUTH = 0xc9576b

export { MONSTER_TOP }

/** 두 색을 t(0~1)만큼 섞는다 */
function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s
  return m(16) | m(8) | m(0)
}

/**
 * 몸 한 덩어리. grow만큼 부풀리고 dy만큼 옮겨 그린다.
 * 테두리는 모든 덩어리를 부풀려 먼저 칠하고, 그늘은 덩어리를 그늘색으로 칠한 위에 조금 줄여 위로 올린 몸색을 덮어 만든다
 */
interface Part {
  color: number
  shade: number
  draw: (g: Phaser.GameObjects.Graphics, grow: number, dy: number) => void
  /** 위쪽 빛(x, y, 너비, 높이) */
  light?: [number, number, number, number]
}

const rr = (
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  r: { tl: number; tr: number; bl: number; br: number },
  grow: number, dy: number,
) => {
  const k = (v: number) => Math.max(1, v + grow)
  g.fillRoundedRect(x - grow, y - grow + dy, w + grow * 2, h + grow * 2, { tl: k(r.tl), tr: k(r.tr), bl: k(r.bl), br: k(r.br) })
}
const circle = (g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, grow: number, dy: number) =>
  g.fillCircle(x, y + dy, Math.max(1, r + grow))

function parts(m: Monster): Part[] {
  const body = m.color
  const shade = m.shade
  switch (m.shape) {
    case 'slime': {
      const leaf = 0x8fd17f
      return [
        // 새싹 두 장(몸 뒤)
        {
          color: leaf,
          shade: 0x6fb862,
          draw: (g, gr, dy) => {
            g.fillEllipse(-7, -33 + dy, 14 + gr * 2, 8 + gr * 2).fillEllipse(7, -35 + dy, 14 + gr * 2, 8 + gr * 2)
            g.fillRect(-1.5 - gr, -31 + dy, 3 + gr * 2, 5)
          },
        },
        {
          color: body,
          shade,
          light: [-14, -16, 18, 10],
          draw: (g, gr, dy) => {
            rr(g, -34, -28, 68, 54, { tl: 32, tr: 32, bl: 16, br: 16 }, gr, dy)
            // 옆으로 흘러내린 말랑 방울
            circle(g, -34, 17, 7, gr, dy)
            circle(g, 34, 19, 5.5, gr, dy)
          },
        },
      ]
    }
    case 'mushroom':
      return [
        {
          color: 0xfff1dc,
          shade: 0xf2d9b8,
          draw: (g, gr, dy) => {
            rr(g, -19, -8, 38, 34, { tl: 12, tr: 12, bl: 14, br: 14 }, gr, dy)
            // 짧은 기둥 다리
            g.fillEllipse(-11, 23 + dy, 15 + gr * 2, 7 + gr * 2).fillEllipse(11, 23 + dy, 15 + gr * 2, 7 + gr * 2)
          },
        },
        {
          color: body,
          shade,
          light: [-20, -28, 16, 8],
          draw: (g, gr, dy) => rr(g, -40, -36, 80, 32, { tl: 30, tr: 30, bl: 10, br: 10 }, gr, dy),
        },
      ]
    case 'drop':
      return [
        {
          color: body,
          shade,
          light: [-12, -10, 7, 13],
          draw: (g, gr, dy) => {
            g.fillTriangle(-21 - gr, -6 + dy, 21 + gr, -6 + dy, 0, -42 - gr * 1.4 + dy)
            circle(g, 0, 2, 26, gr, dy)
          },
        },
        // 옆으로 튀는 물방울
        {
          color: body,
          shade,
          draw: (g, gr, dy) => {
            circle(g, 33, -16, 4, gr, dy)
            circle(g, 39, -5, 3, gr, dy)
            circle(g, -33, -20, 3.5, gr, dy)
          },
        },
      ]
    case 'cloud':
      return [
        {
          color: body,
          shade,
          light: [-6, -24, 18, 8],
          draw: (g, gr, dy) => {
            circle(g, -20, -2, 17, gr, dy)
            circle(g, 2, -14, 22, gr, dy)
            circle(g, 22, -2, 16, gr, dy)
            rr(g, -38, -4, 76, 30, { tl: 15, tr: 15, bl: 15, br: 15 }, gr, dy)
            // 살랑이는 꼬리
            circle(g, 41, 13, 7, gr, dy)
            circle(g, 49, 5, 4.5, gr, dy)
          },
        },
      ]
    case 'rock':
      return [
        // 작은 돌뿔(몸 뒤)
        {
          color: mix(shade, 0xffffff, 0.15),
          shade,
          draw: (g, gr, dy) => {
            g.fillTriangle(-26 - gr, -14 + dy, -10 + gr, -16 + dy, -20, -30 - gr + dy)
            g.fillTriangle(10 - gr, -16 + dy, 26 + gr, -14 + dy, 18, -29 - gr + dy)
          },
        },
        {
          color: body,
          shade,
          light: [-14, -12, 20, 8],
          draw: (g, gr, dy) => rr(g, -36, -22, 72, 48, { tl: 24, tr: 16, bl: 14, br: 14 }, gr, dy),
        },
      ]
    case 'king':
      return [
        // 동그란 귀(몸 뒤)
        {
          color: body,
          shade,
          draw: (g, gr, dy) => {
            circle(g, -30, -24, 10, gr, dy)
            circle(g, 30, -24, 10, gr, dy)
          },
        },
        {
          color: body,
          shade,
          light: [-18, -16, 22, 11],
          draw: (g, gr, dy) => rr(g, -42, -30, 84, 56, { tl: 38, tr: 38, bl: 18, br: 18 }, gr, dy),
        },
      ]
  }
}

/** 볼터치 자리(x 간격, y) */
const CHEEKS: Record<MonsterShape, [number, number]> = {
  slime: [20, 6], mushroom: [13, 17], drop: [17, 12], cloud: [22, 14], rock: [21, 8], king: [25, 8],
}

/**
 * 몬스터 몸. 실루엣 특징(새싹·갓·뾰족 머리·꼬리·돌뿔·귀 등)과 테두리·위쪽 빛·아래쪽 그늘·볼터치를 그린다.
 * 얼굴은 표정마다 따로 그린다(drawMonsterFace)
 */
export function drawMonsterBody(g: Phaser.GameObjects.Graphics, m: Monster) {
  const ps = parts(m)
  // 테두리: 모든 덩어리를 조금 부풀려 진한 색으로 먼저 칠한다(겹친 곳 안쪽엔 선이 안 생긴다)
  for (const p of ps) {
    g.fillStyle(mix(p.shade, MONSTER_INK, 0.45))
    p.draw(g, 2.4, 0)
  }
  for (const p of ps) {
    g.fillStyle(p.shade)
    p.draw(g, 0, 0)
    g.fillStyle(p.color)
    p.draw(g, -2.5, -3)
    if (p.light) {
      const [x, y, w, h] = p.light
      g.fillStyle(0xffffff, 0.55).fillEllipse(x, y, w, h)
      g.fillStyle(0xffffff, 0.8).fillCircle(x + w * 0.62, y - h * 0.15, 2)
    }
  }
  const f = MONSTER_FEATURES[m.shape]
  const darker = mix(m.shade, MONSTER_INK, 0.3)
  if (f.includes('cap')) {
    g.fillStyle(0xffffff, 0.92).fillCircle(-22, -20, 6).fillCircle(4, -27, 5).fillCircle(24, -16, 4.5).fillCircle(-6, -15, 3)
  }
  if (f.includes('crack')) {
    g.lineStyle(2.2, darker, 0.8)
    g.strokePoints([new Phaser.Math.Vector2(22, -18), new Phaser.Math.Vector2(17, -10), new Phaser.Math.Vector2(23, -4), new Phaser.Math.Vector2(18, 4)], false)
    g.fillStyle(darker, 0.35).fillCircle(-24, 14, 3).fillCircle(26, 15, 2.2)
  }
  if (f.includes('ears')) {
    g.fillStyle(0xffb3c8, 0.85).fillCircle(-30, -25, 5).fillCircle(30, -25, 5)
  }
  if (f.includes('crown')) {
    g.lineStyle(2, mix(CROWN, MONSTER_INK, 0.35))
    const crown = (fill: boolean) => {
      if (fill) g.fillStyle(CROWN)
      const pts = [[-18, -27], [-18, -36], [-16, -46], [-10, -36], [0, -50], [10, -36], [16, -46], [18, -36], [18, -27]]
        .map(([x, y]) => new Phaser.Math.Vector2(x, y))
      if (fill) g.fillPoints(pts, true)
      else g.strokePoints(pts, true)
    }
    crown(true)
    crown(false)
    g.fillStyle(0xff8fa8).fillCircle(0, -31, 3.2)
    g.fillStyle(0xffffff, 0.8).fillCircle(-1, -32, 1)
  }
  const [cx, cy] = CHEEKS[m.shape]
  g.fillStyle(0xff8fa8, 0.55).fillEllipse(-cx, cy, 9, 5).fillEllipse(cx, cy, 9, 5)
}

/** 눈 자리(y, 간격) */
const EYES: Record<MonsterShape, [number, number]> = {
  slime: [-6, 11], mushroom: [8, 8], drop: [2, 9], cloud: [4, 11], rock: [-2, 11], king: [-6, 13],
}

/** 몬스터 표정. 기본(바위는 졸린 듯 가는 눈)·맞음(> <)·승리(∩ 눈과 벌린 입) */
export function drawMonsterFace(g: Phaser.GameObjects.Graphics, shape: MonsterShape, face: MonsterFace) {
  const [y, gap] = EYES[shape]
  const mouthY = y + 7
  const v = (x: number, yy: number) => new Phaser.Math.Vector2(x, yy)
  switch (face) {
    case 'idle':
      if (shape === 'rock') {
        g.fillStyle(MONSTER_INK).fillEllipse(-gap, y, 10, 4.5).fillEllipse(gap, y, 10, 4.5)
      } else {
        for (const x of [-gap, gap]) {
          g.fillStyle(MONSTER_INK).fillEllipse(x, y, 7.5, 9.5)
          g.fillStyle(0xffffff).fillCircle(x - 1.4, y - 2.2, 1.6)
        }
      }
      g.lineStyle(2, MONSTER_INK).beginPath().arc(0, mouthY - 3, 3.5, Math.PI * 0.2, Math.PI * 0.8, false).strokePath()
      return
    case 'hurt':
      g.lineStyle(2.5, MONSTER_INK)
      g.strokePoints([v(-gap - 4, y - 4), v(-gap + 3, y), v(-gap - 4, y + 4)], false)
      g.strokePoints([v(gap + 4, y - 4), v(gap - 3, y), v(gap + 4, y + 4)], false)
      // 삐죽 물결 입
      g.lineStyle(2, MONSTER_INK)
      g.strokePoints([v(-5, mouthY), v(-2.5, mouthY - 2), v(0, mouthY), v(2.5, mouthY - 2), v(5, mouthY)], false)
      return
    case 'win':
      g.lineStyle(2.6, MONSTER_INK)
      for (const x of [-gap, gap]) {
        g.beginPath().arc(x, y + 3, 4.5, Math.PI * 1.15, Math.PI * 1.85, false).strokePath()
      }
      g.fillStyle(MOUTH).beginPath().arc(0, mouthY - 3, 6, 0, Math.PI, false).closePath().fillPath()
      // 작은 송곳니 하나
      g.fillStyle(0xffffff).fillTriangle(-3.5, mouthY - 3, -0.5, mouthY - 3, -2, mouthY)
      return
  }
}
