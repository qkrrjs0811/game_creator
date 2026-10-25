import Phaser from 'phaser'
import type { ReplayStep, Timeline } from '../core/replay'
import { MONSTERS, type Monster } from '../core/monsters'
import type { Cosmetic, HatLook, HatShape, Worn } from '../core/cosmetics'
import { chapterBackdrop, type Backdrop } from '../core/backdrop'
import type { ActivityId } from '../core/types'
import { keepChatIndex, nextChatIndex } from '../core/chatter'

const MASCOT = 0xffd7a8
const MASCOT_SHADE = 0xf7b97a
const INK = 0x5a4636
const MONSTER_INK = 0x3d2a63
const CROWN = 0xffd36b
const HP_PLAYER = 0x7fd8b0
/** 땅 높이에서 말랑이(반지름 38)·몬스터 아래 끝까지 */
const FEET = 38
/** 장면 아래 끝에서 운동 마침 요약 카드 위(버튼 줄 72 + 카드 약 76)까지와 조금의 틈 */
const BELOW_FEET = 156

/**
 * 말랑이·몬스터가 서는 땅 높이. 아래쪽 운동 마침 요약(버튼 위 카드)에 가리지 않게 발끝을 그 위에 둔다.
 * 낮은 화면에서는 위쪽 결과 카드·말풍선 자리를 위해 너무 올리지 않는다.
 * 저장 실패 경고로 장면이 낮아져도(약 385px) 요약 카드 위에 서도록 아래 한계를 장면의 0.52로 둔다
 */
function groundY(h: number): number {
  return Phaser.Math.Clamp(h - BELOW_FEET - FEET, h * 0.52, h * 0.68)
}
const HP_ENEMY = 0xff9fbf
const BAR_W = 78
/** 이긴 쪽이 폴짝 뛰는 높이. 자기 HP 막대와 같이 뛰며, 막대가 위쪽 결과 카드(질 때 더 길다)에 닿지 않을 만큼만 뛴다 */
const WIN_HOP = 18
/** 자리(가운데)에서 머리끝(모자 포함)까지. 이긴 쪽 머리가 HP 막대에 닿는지 e2e가 보게 쓴다 */
const HAT_TOP: Record<string, number> = {
  'hat-sprout': -58,
  'hat-mushroom': -58,
  'hat-ribbon': -48,
  'hat-crown': -58,
  'hat-stamp7': -54,
  'hat-stamp30': -45,
  'hat-stamp100': -51,
  'hat-mission5': -52,
  'hat-mission20': -58,
  'hat-mission50': -56,
}
/** 장 모자 모양마다 머리끝 */
const CHAPTER_HAT_TOP: Record<HatShape, number> = { cone: -58, beret: -52, flower: -53, star: -53 }

function hatTop(hat: Cosmetic | null): number {
  if (hat?.hat) return CHAPTER_HAT_TOP[hat.hat.shape]
  return HAT_TOP[hat?.id ?? ''] ?? -FEET
}

/** 말랑이 모습(성장 단계 몸 배율과 많이 한 활동 특징). 기록에서 계산한 그림일 뿐이다 */
export interface Growth {
  scale: number
  traits: ActivityId[]
}

/** 자란 말랑이 머리끝(모자 포함). 몸은 발끝을 땅에 둔 채 커지므로 위로만 자란다 */
function grownTop(hat: Cosmetic | null, scale: number): number {
  return FEET * (1 - scale) + hatTop(hat) * scale
}

/**
 * 많이 한 활동 특징. 모자보다 먼저 그려 모자 아래에 보인다.
 * 운동: 진한 볼 홍조·이마 머리띠·땀방울, 공부: 동그란 안경, 독서: 왼쪽 머리의 책갈피 잎, 휴식: 졸린 눈(눈 대신)과 작은 별
 */
function drawTraits(g: Phaser.GameObjects.Graphics, traits: ActivityId[]) {
  if (traits.includes('exercise')) {
    g.fillStyle(0xff8f8f, 0.75).fillEllipse(-22, 8, 13, 8).fillEllipse(22, 8, 13, 8)
    g.fillStyle(0xff9a7a).fillRoundedRect(-31, -27, 62, 7, 3.5)
    g.fillStyle(0xffffff, 0.8).fillCircle(-14, -23.5, 1.6).fillCircle(0, -23.5, 1.6).fillCircle(14, -23.5, 1.6)
    // 머리띠 매듭 꼬리
    g.fillStyle(0xff9a7a).fillEllipse(-36, -20, 10, 5).fillEllipse(-35, -14, 9, 4.5)
    // 땀방울
    g.fillStyle(0xa8d4ff).fillTriangle(29, -16, 35, -16, 32, -24).fillCircle(32, -14, 3.6)
  }
  if (traits.includes('relax')) {
    g.lineStyle(2.6, INK)
    for (const x of [-12, 12]) g.beginPath().arc(x, -7, 5, Math.PI * 0.15, Math.PI * 0.85, false).strokePath()
    g.fillStyle(0xfff0a0).fillPoints(starPoints(42, -18, 7), true)
    g.fillStyle(0xffe07a).fillPoints(starPoints(48, -31, 4), true)
  }
  if (traits.includes('study')) {
    g.fillStyle(0xffffff, 0.35).fillCircle(-12, -6, 8).fillCircle(12, -6, 8)
    g.lineStyle(2.4, 0x8a6a52)
    g.strokeCircle(-12, -6, 9).strokeCircle(12, -6, 9)
    g.lineBetween(-3, -7, 3, -7)
  }
  if (traits.includes('reading')) {
    g.fillStyle(0xc7a6ff).fillRect(-30, -36, 6, 12).fillTriangle(-30, -24, -24, -24, -30, -20).fillTriangle(-24, -24, -24, -20, -30, -24)
    g.fillStyle(0x7cc576).fillEllipse(-23, -38, 16, 9)
    g.fillStyle(0xa6dc8e).fillEllipse(-31, -41, 12, 7)
  }
}

/** 장 모자. 모양 하나에 파스텔 색과 무늬(물방울·줄무늬)를 입힌다. 모두 머리 위(y≈-38) 둘레에 붙는다 */
function drawChapterHat(g: Phaser.GameObjects.Graphics, look: HatLook) {
  const col = Phaser.Display.Color.HexStringToColor(look.color)
  const main = col.color
  const dark = col.clone().darken(12).color
  const light = col.clone().lighten(12).color
  const dots = look.pattern === 'dots'
  const stripes = look.pattern === 'stripes'
  switch (look.shape) {
    case 'cone':
      g.fillStyle(main).fillTriangle(-15, -34, 15, -34, 0, -54)
      if (stripes) for (const y of [-47, -41]) {
        const hw = (15 * (y + 54)) / 20
        g.fillStyle(0xffffff, 0.8).fillRect(-hw, y, hw * 2, 3)
      }
      if (dots) g.fillStyle(0xffffff, 0.9).fillCircle(-5, -40, 2.5).fillCircle(5, -42, 2.5).fillCircle(0, -48, 2)
      g.fillStyle(dark).fillRoundedRect(-17, -37, 34, 6, 3)
      g.fillStyle(0xffffff).fillCircle(0, -54, 4)
      break
    case 'beret':
      // 머리 둘레에 얹히게 낮고 넓게, 아래 띠가 이마에 닿는다
      g.fillStyle(main).fillEllipse(3, -38, 56, 22)
      if (stripes) g.fillStyle(0xffffff, 0.75).fillRect(-18, -43, 42, 2.5).fillRect(-20, -37, 46, 2.5)
      if (dots) g.fillStyle(0xffffff, 0.9).fillCircle(-12, -38, 2.5).fillCircle(4, -42, 2.5).fillCircle(18, -37, 2.5)
      g.fillStyle(dark).fillEllipse(2, -30, 50, 7).fillCircle(5, -49, 3)
      break
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        const x = 18 + Math.cos(a) * 8
        const y = -38 + Math.sin(a) * 8
        g.fillStyle(stripes && i % 2 === 1 ? light : main).fillCircle(x, y, 7)
        if (dots) g.fillStyle(0xffffff, 0.9).fillCircle(18 + Math.cos(a) * 10, -38 + Math.sin(a) * 10, 1.8)
      }
      g.fillStyle(0xffffff).fillCircle(18, -38, 4.5)
      g.fillStyle(dark).fillCircle(18, -38, 2)
      break
    case 'star': {
      const star = (r1: number, r2: number) =>
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const r = i % 2 === 0 ? r1 : r2
          return new Phaser.Math.Vector2(16 + Math.cos(a) * r, -40 + Math.sin(a) * r)
        })
      g.fillStyle(dark).fillPoints(star(14, 7), true)
      g.fillStyle(main).fillPoints(star(12, 6), true)
      if (stripes) g.fillStyle(0xffffff, 0.75).fillPoints(star(6, 3), true)
      if (dots) g.fillStyle(0xffffff, 0.9).fillCircle(16, -40, 3)
      break
    }
  }
}
/** 땅 띠 위끝: 발끝보다 조금 위라 말랑이·몬스터가 띠 위에 서 있다 */
function groundTop(h: number): number {
  return groundY(h) + FEET - 14
}

/** 소품 반 너비. 소품은 이 너비(가로 ±PROP_HALF) 안, 땅(y=0)에서 위로 46px 안에 그린다 */
const PROP_HALF = 22
const PROP_HEIGHT = 46

/** 장면 소품(활동 소품 12종). 아래끝 가운데(0, 0)가 땅에 닿는 둥근 도형이다 */
function drawProp(g: Phaser.GameObjects.Graphics, id: string) {
  const OUT = 0x8a6a52
  switch (id) {
    case 'prop-exercise-1': // 아령
      g.fillStyle(0x9a8cc9).fillRoundedRect(-12, -10, 24, 5, 2.5)
      g.fillStyle(0xb8a8ff).fillRoundedRect(-21, -18, 10, 18, 5).fillRoundedRect(11, -18, 10, 18, 5)
      g.fillStyle(0xffffff, 0.5).fillEllipse(-17, -13, 3, 7).fillEllipse(15, -13, 3, 7)
      break
    case 'prop-exercise-5': // 줄넘기: 손잡이 둘과 둥근 줄
      g.lineStyle(3, 0xff9fbf).beginPath().arc(0, -20, 15, Math.PI * 0.05, Math.PI * 0.95, false).strokePath()
      g.fillStyle(0x7fd8b0).fillRoundedRect(-20, -38, 8, 20, 4).fillRoundedRect(12, -38, 8, 20, 4)
      g.fillStyle(0xffffff, 0.6).fillCircle(-16, -34, 2).fillCircle(16, -34, 2)
      break
    case 'prop-exercise-20': // 트로피
      g.fillStyle(0xe8b85a).fillRoundedRect(-14, -8, 28, 8, 3)
      g.fillRect(-3, -18, 6, 10)
      g.lineStyle(3.5, 0xffd36b).strokeCircle(-14, -32, 6).strokeCircle(14, -32, 6)
      g.fillStyle(0xffd36b).fillRoundedRect(-13, -44, 26, 18, { tl: 3, tr: 3, bl: 13, br: 13 })
      g.fillStyle(0xffffff, 0.8).fillPoints(starPoints(0, -35, 5), true)
      break
    case 'prop-study-1': // 연필꽂이
      g.fillStyle(0xffd36b).fillRoundedRect(-9, -40, 5, 22, 2).fillTriangle(-9, -40, -4, -40, -6.5, -45)
      g.fillStyle(0xa8d4ff).fillRoundedRect(-2, -36, 5, 18, 2).fillTriangle(-2, -36, 3, -36, 0.5, -41)
      g.fillStyle(0xffa8c8).fillRoundedRect(5, -42, 5, 24, 2).fillTriangle(5, -42, 10, -42, 7.5, -46)
      g.fillStyle(0x9be3c4).fillRoundedRect(-14, -24, 28, 24, 6)
      g.fillStyle(0xffffff, 0.5).fillRoundedRect(-10, -18, 20, 4, 2)
      break
    case 'prop-study-5': // 공책 두 권
      g.fillStyle(0xa8d4ff).fillRoundedRect(-20, -10, 40, 10, 3)
      g.fillStyle(0xffa8c8).fillRoundedRect(-17, -19, 34, 9, 3)
      g.fillStyle(0xffffff, 0.8).fillRect(-16, -6, 32, 2).fillRect(-13, -15, 26, 2)
      break
    case 'prop-study-20': // 지구본
      g.fillStyle(0xe8b85a).fillRoundedRect(-11, -6, 22, 6, 3).fillRect(-2, -14, 4, 8)
      g.fillStyle(0xa8d4ff).fillCircle(0, -28, 15)
      g.fillStyle(0x9be3c4).fillEllipse(-5, -33, 12, 8).fillEllipse(6, -22, 10, 7)
      g.lineStyle(2.5, 0xe8b85a).beginPath().arc(0, -28, 17, Math.PI * 0.6, Math.PI * 1.9, false).strokePath()
      break
    case 'prop-reading-1': // 책 더미
      g.fillStyle(0xffa8c8).fillRoundedRect(-19, -9, 38, 9, 3)
      g.fillStyle(0xfff0a0).fillRoundedRect(-15, -18, 32, 9, 3)
      g.fillStyle(0xc9a7ff).fillRoundedRect(-17, -27, 30, 9, 3)
      g.fillStyle(0xffffff, 0.8).fillRect(14, -7, 3, 5).fillRect(12, -16, 3, 5).fillRect(-15, -25, 3, 5)
      break
    case 'prop-reading-5': // 펼친 책과 책갈피
      g.fillStyle(0xff8a5b).fillRect(3, -22, 5, 18).fillTriangle(3, -4, 8, -4, 5.5, 0)
      g.fillStyle(0xfff6ec).fillRoundedRect(-20, -14, 19, 12, 4).fillRoundedRect(1, -14, 19, 12, 4)
      g.fillStyle(0xc9a7ff).fillRoundedRect(-21, -4, 42, 4, 2)
      g.lineStyle(1.5, OUT, 0.4).lineBetween(-16, -10, -5, -10).lineBetween(5, -10, 16, -10)
      break
    case 'prop-reading-20': // 작은 책장
      g.fillStyle(0xe8c49a).fillRoundedRect(-20, -46, 40, 46, 6)
      g.fillStyle(0xfff1dc).fillRoundedRect(-16, -42, 32, 18, 3).fillRoundedRect(-16, -21, 32, 17, 3)
      for (const [x, y, c, hh] of [[-14, -24, 0xffa8c8, 14], [-9, -24, 0xa8d4ff, 16], [-4, -24, 0x9be3c4, 12], [-12, -4, 0xc9a7ff, 15], [-6, -4, 0xfff0a0, 13], [1, -4, 0xffa8c8, 16]] as const)
        g.fillStyle(c).fillRoundedRect(x, y - hh, 4.5, hh, 1.5)
      break
    case 'prop-relax-1': // 찻잔
      g.fillStyle(0xffffff, 0.8).fillEllipse(0, -2, 34, 6)
      g.lineStyle(3, 0x9be3c4).strokeCircle(13, -13, 5)
      g.fillStyle(0x9be3c4).fillRoundedRect(-12, -22, 24, 19, { tl: 2, tr: 2, bl: 10, br: 10 })
      g.fillStyle(0xffffff, 0.6).fillEllipse(-4, -15, 5, 8)
      g.lineStyle(2, 0xffffff, 0.8).beginPath().arc(-2, -30, 4, Math.PI * 0.5, Math.PI * 1.5, false).strokePath()
      break
    case 'prop-relax-5': // 쿠션
      g.fillStyle(0xffa8c8).fillRoundedRect(-21, -24, 42, 24, 11)
      g.fillStyle(0xf58fb2).fillCircle(-19, -22, 4).fillCircle(19, -22, 4).fillCircle(-19, -2, 4).fillCircle(19, -2, 4)
      g.fillStyle(0xffffff, 0.75).fillCircle(0, -12, 3.5)
      break
    case 'prop-relax-20': // 화분
      g.fillStyle(0x7cc576).fillEllipse(-8, -34, 13, 22).fillEllipse(8, -32, 13, 20).fillEllipse(0, -40, 11, 22)
      g.fillStyle(0xf5a35c).fillRoundedRect(-14, -20, 28, 20, { tl: 3, tr: 3, bl: 9, br: 9 })
      g.fillStyle(0xf08a6a).fillRoundedRect(-16, -22, 32, 6, 3)
      break
  }
}

/** 다섯 꼭짓점 별 */
function starPoints(cx: number, cy: number, r: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.5
    return new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  })
}

/**
 * 장 배경: 하늘의 둥근 장식과 땅 띠. 캐릭터·HP 막대보다 뒤에 그리고, 장식은 반투명이라 앞의 것을 가리지 않는다.
 * 자리는 장면 크기의 비율이라 장면 높이가 바뀌어도 같은 모습이다
 */
function drawScenery(g: Phaser.GameObjects.Graphics, b: Backdrop, w: number, h: number) {
  const col = (hex: string) => Phaser.Display.Color.HexStringToColor(hex)
  const ground = col(b.ground)
  const top = groundTop(h)
  /** 하늘 안의 자리(가로 비율, 땅 위끝까지 세로 비율) */
  const at = (fx: number, fy: number): [number, number] => [w * fx, top * fy]
  g.clear()

  // 땅 뒤에 서는 장식(언덕)은 땅보다 먼저 그린다
  if (b.decor === 'hills') {
    g.fillStyle(ground.clone().darken(6).color, 0.7)
    g.fillCircle(w * 0.1, top + 30, 90).fillCircle(w * 0.95, top + 40, 110)
    g.fillStyle(ground.clone().lighten(4).color, 0.8).fillCircle(w * 0.55, top + 50, 80)
  }

  // 땅 띠: 위끝을 둥근 언덕처럼 울퉁불퉁하게
  g.fillStyle(ground.color).fillRect(0, top + 8, w, h - top)
  for (let x = -20; x < w + 40; x += 56) g.fillCircle(x, top + 18, 22)
  g.fillStyle(0xffffff, 0.4)
  for (let x = -20; x < w + 40; x += 56) g.fillEllipse(x - 4, top + 3, 16, 5)

  switch (b.decor) {
    case 'clouds':
      g.fillStyle(0xffffff, 0.75)
      for (const [fx, fy, s] of [[0.14, 0.12, 1], [0.84, 0.22, 0.8], [0.52, 0.42, 0.6]]) {
        const [x, y] = at(fx, fy)
        g.fillEllipse(x, y + 6 * s, 64 * s, 22 * s).fillCircle(x - 10 * s, y, 13 * s).fillCircle(x + 9 * s, y - 3 * s, 16 * s)
      }
      break
    case 'hills':
      g.fillStyle(0xffffff, 0.6)
      for (const [fx, fy] of [[0.18, 0.16], [0.8, 0.3]]) {
        const [x, y] = at(fx, fy)
        g.fillEllipse(x, y, 50, 16).fillCircle(x + 6, y - 5, 10)
      }
      break
    case 'stars':
      g.fillStyle(0xfff6c8, 0.9)
      for (const [fx, fy, r] of [[0.1, 0.1, 9], [0.88, 0.14, 11], [0.32, 0.36, 6], [0.7, 0.44, 7], [0.95, 0.5, 5], [0.05, 0.5, 6]]) {
        const [x, y] = at(fx, fy)
        g.fillPoints(starPoints(x, y, r), true)
      }
      break
    case 'bubbles':
      for (const [fx, fy, r] of [[0.1, 0.2, 12], [0.86, 0.12, 15], [0.62, 0.4, 8], [0.22, 0.48, 7], [0.93, 0.46, 9]]) {
        const [x, y] = at(fx, fy)
        g.fillStyle(0xffffff, 0.3).fillCircle(x, y, r)
        g.lineStyle(2, 0xffffff, 0.75).strokeCircle(x, y, r)
        g.fillStyle(0xffffff, 0.9).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.22)
      }
      break
    case 'flowers':
      // 땅 띠 위의 작은 꽃들(캐릭터 사이와 양 끝)
      for (const [fx, c] of [[0.06, 0xffffff], [0.16, 0xfff3a8], [0.51, 0xfff3a8], [0.95, 0xffffff]]) {
        const x = w * fx
        const y = top + 30
        g.fillStyle(c, 0.9)
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2
          g.fillCircle(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4)
        }
        g.fillStyle(0xff9fbf).fillCircle(x, y, 3)
      }
      g.fillStyle(0xffffff, 0.55)
      for (const [fx, fy] of [[0.2, 0.18], [0.82, 0.28]]) {
        const [x, y] = at(fx, fy)
        g.fillEllipse(x, y, 46, 14)
      }
      break
    case 'sun': {
      const [x, y] = at(0.86, 0.16)
      g.fillStyle(0xffffff, 0.45).fillCircle(x, y, 34)
      g.fillStyle(0xffe58a, 0.95).fillCircle(x, y, 24)
      const [cx, cy] = at(0.16, 0.26)
      g.fillStyle(0xffffff, 0.6).fillEllipse(cx, cy, 54, 16).fillCircle(cx + 6, cy - 6, 11)
      break
    }
    case 'snow':
      g.fillStyle(0xffffff, 0.85)
      for (const [fx, fy, r] of [[0.06, 0.12, 4], [0.2, 0.3, 3], [0.36, 0.08, 3], [0.62, 0.22, 4], [0.8, 0.1, 3], [0.94, 0.32, 4], [0.48, 0.46, 3], [0.1, 0.52, 3], [0.88, 0.56, 3]]) {
        const [x, y] = at(fx, fy)
        g.fillCircle(x, y, r)
      }
      // 땅에 쌓인 눈
      g.fillStyle(0xffffff, 0.8).fillEllipse(w * 0.08, top + 14, 60, 14).fillEllipse(w * 0.93, top + 16, 50, 12)
      break
    case 'leaves': {
      const leaf = [0xf5a35c, 0xe8c25a, 0xf08a6a]
      for (const [fx, fy, a, i] of [[0.1, 0.16, 0.5, 0], [0.84, 0.12, -0.6, 1], [0.6, 0.38, 1.1, 2], [0.26, 0.44, -0.3, 1], [0.94, 0.48, 0.8, 0]]) {
        const [x, y] = at(fx, fy)
        g.save()
        g.translateCanvas(x, y)
        g.rotateCanvas(a)
        g.fillStyle(leaf[i], 0.85).fillEllipse(0, 0, 18, 9)
        g.fillStyle(0xffffff, 0.5).fillRect(-7, -0.5, 14, 1)
        g.restore()
      }
      break
    }
  }
}

const MONSTER_TOP: Record<Monster['shape'], number> = { slime: -38, mushroom: -36, drop: -42, cloud: -36, rock: -22, king: -50 }

/** 두 캐릭터 머리 위 HP 막대(높이 10, 흰 테두리 3)의 위쪽 y */
function barY(h: number): number {
  return groundY(h) - 72
}
const FONT = 'Segoe UI, Malgun Gothic, sans-serif'
/** 색 꾸미기의 [몸, 아래 그늘] 색 */
const BODY_COLORS: Record<string, [number, number]> = {
  'color-sky': [0xb5dcff, 0x8fc2f0],
  'color-cotton': [0xffc6de, 0xf5a3c6],
  'color-week1': [0xfff0a0, 0xf2d670],
  'color-week4': [0xb8ecd4, 0x8fd4b6],
  'color-week12': [0xd9c8f7, 0xbba4ea],
}
const CONFETTI =[0xff8a5b, 0xffd36b, 0x9be3c4, 0xa8d4ff, 0xffa8c8, 0xc9a7ff]
/** 말랑이 기분: 쉬는 중(타이머 꺼짐), 같이 운동·공부·독서·휴식 중, 오늘 상한을 채워 쉬어도 되는 중 */
export type Mood = 'rest' | 'exercise' | 'study' | 'reading' | 'relax' | 'full'
/** 장면이 다 준비됐을 때 game.events로 보내는 신호 */
export const HOME_READY = 'home-ready'
const BUBBLES: Record<Mood, string> = {
  rest: '💪 오늘도 같이 크는 중!',
  exercise: '🔥 말랑이도 같이 운동 중!',
  study: '📖 말랑이도 같이 공부 중!',
  reading: '📚 말랑이도 같이 책 읽는 중!',
  relax: '😌 말랑이도 같이 푹 쉬는 중…',
  full: '😊 오늘은 충분해요! 쉬어도 돼요',
}

/** 홈 장면: 둥근 마스코트와 몬스터가 마주 보고, 마스코트가 숨 쉬듯 움직인다 */
export class HomeScene extends Phaser.Scene {
  /** 자리(땅 높이)는 바깥 상자가, 폴짝·둥실 움직임은 안쪽 몸이 맡는다. 장면 높이가 바뀌어도 움직임이 자리를 옛 땅으로 되돌리지 않는다 */
  private mascot!: Phaser.GameObjects.Container
  private mascotBody!: Phaser.GameObjects.Container
  /** 성장 단계만큼 커지는 몸. 발끝이 땅에 닿게 위로 옮겨 키운다 */
  private mascotGrow!: Phaser.GameObjects.Container
  private growth: Growth = { scale: 1, traits: [] }
  private monster!: Phaser.GameObjects.Container
  private monsterBody!: Phaser.GameObjects.Container
  private bubble!: Phaser.GameObjects.Container
  private bubbleText!: Phaser.GameObjects.Text
  private bubbleBg!: Phaser.GameObjects.Graphics
  private bubbleAway = false
  /** 장 배경(하늘 장식·땅 띠). 캐릭터보다 먼저 만들어 뒤에 그린다 */
  private scenery!: Phaser.GameObjects.Graphics
  /** 고른 소품. 말랑이 왼쪽 땅 위, 말랑이보다 뒤에 그린다 */
  private prop!: Phaser.GameObjects.Graphics
  private shownProp?: string
  private backdrop: Backdrop = chapterBackdrop(1)
  private jump?: Phaser.Tweens.Tween
  /** 말풍선을 눌렀을 때 살짝 통 튀기 */
  private hop?: Phaser.Tweens.Tween
  /** 숨쉬기(쉬는 중) 또는 꾹꾹 누르기(운동 중) 움직임 */
  private breathe?: Phaser.Tweens.Tween
  /** 타이머가 켜져 있으면 말랑이도 같이 운동한다. 오늘 상한을 채웠으면 쉬자고 한다 */
  private mood: Mood = 'rest'
  /** 쉬는 중 말풍선에 띄울 말랑이 한마디 후보(기록을 읽고 화면이 골라 준다)와 지금 보여 주는 자리 */
  private restLines: string[] = [BUBBLES.rest]
  private chatIndex = 0
  /** 말풍선·말랑이를 눌렀을 때 다음 한마디로 넘기는 칸(장면 안 px) */
  private bubbleTap = new Phaser.Geom.Rectangle()
  private mascotTap = new Phaser.Geom.Rectangle()
  /** 홈에서 보여 줄 몬스터(다음에 도전할 스테이지)와 지금 그려진 몬스터 */
  private homeLook?: Monster
  private shownMonster = ''
  private monsterShape: Monster['shape'] = 'slime'
  /** 입은 꾸미기와 지금 그려진 모습 */
  private look: Worn = { hat: null, color: null, prop: null }
  private shownLook?: string
  private battle?: {
    steps: ReplayStep[]
    win: boolean
    next: number
    timer?: Phaser.Time.TimerEvent
    /** [말랑이, 몬스터] 머리 위 HP 막대. 이긴 쪽 막대는 주인과 같이 뛴다 */
    bars: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics]
    /** 이긴 쪽이 뛰는 동안 머리끝이 가장 높이 간 곳, 막대와 가장 가까웠던 틈, 막대가 가장 높이 간 곳(e2e용) */
    peak?: number
    gap?: number
    barPeak?: number
    /** 지금 보이는 HP 비율 [말랑이, 몬스터] */
    hp: [number, number]
    onEnd: (win: boolean) => void
    ended: boolean
  }

  constructor() {
    super('home')
  }

  create() {
    this.scenery = this.add.graphics()
    this.prop = this.add.graphics()
    this.shownProp = undefined
    this.mascotGrow = this.add.container(0, 0)
    this.mascotBody = this.add.container(0, 0, [this.mascotGrow])
    this.mascot = this.add.container(0, 0, [this.mascotBody])
    this.shownLook = undefined
    this.dress(this.look)

    this.monsterBody = this.add.container(0, 0)
    this.monster = this.add.container(0, 0, [this.monsterBody])
    this.setMonster(this.homeLook ?? MONSTERS[0])

    this.bubbleText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#5a4636', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.bubbleBg = this.add.graphics()
    this.bubble = this.add.container(0, 0, [this.bubbleBg, this.bubbleText])
    this.drawBubble()

    this.layout(this.scale.width, this.scale.height)
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.layout(size.width, size.height))
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y))

    this.idle()
    // 장면이 다 준비되면(RUNNING) 알린다. 그 전에 밀린 축하 등을 화면이 다시 그려 맞춘다
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.game.events.emit(HOME_READY))
  }

  /** 타이머를 켜면 말랑이가 꾹꾹 같이 운동하고, 상한을 채우면 쉬자고 한다. 모습만 바뀐다 */
  setMood(mood: Mood) {
    if (this.mood === mood) return
    this.mood = mood
    if (!this.mascot) return
    this.drawBubble()
    // 전투 중에는 끝난 뒤 idle()에서 맞춰진다
    if (!this.battle) this.moveMascot()
  }

  /**
   * 타이머가 꺼져 있을 때 말풍선에 띄울 한마디 후보(중요한 순서). 후보가 그대로면 눌러 넘긴 자리를 지키고,
   * 바뀌면 첫 후보부터 다시 보여 준다. 켜 둔 동안·상한 말풍선은 그대로다
   */
  setRestLines(lines: string[]) {
    if (lines.length === 0) lines = [BUBBLES.rest]
    if (lines.length === this.restLines.length && lines.every((t, i) => t === this.restLines[i])) return
    this.chatIndex = keepChatIndex(this.restLines, lines, this.chatIndex)
    this.restLines = lines
    if (this.bubbleText && this.mood === 'rest') this.drawBubble()
  }

  /** 말풍선이나 말랑이를 누르면 다음 한마디로 넘어가며 말랑이가 살짝 통 튄다. 쉬는 중 말풍선이 보일 때만 */
  private onTap(x: number, y: number) {
    if (this.battle || this.mood !== 'rest' || this.bubble.alpha < 0.5) return
    if (!this.bubbleTap.contains(x, y) && !this.mascotTap.contains(x, y)) return
    this.chatIndex = nextChatIndex(this.chatIndex, this.restLines.length)
    this.drawBubble()
    // 레벨업 폴짝 중에는 그대로 둔다
    if (this.jump?.isPlaying()) return
    this.hop?.stop()
    this.mascotBody.setY(0)
    this.hop = this.tweens.add({ targets: this.mascotBody, y: -14, duration: 130, yoyo: true, ease: 'Quad.easeOut' })
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-chat-hops', String(Number(host.getAttribute('data-chat-hops') ?? 0) + 1))
  }

  private drawBubble() {
    this.bubbleText.setText(this.mood === 'rest' ? this.restLines[this.chatIndex] : BUBBLES[this.mood])
    const w = this.bubbleText.width
    this.bubbleBg.clear().fillStyle(0xffffff).fillRoundedRect(-w / 2 - 12, -15, w + 24, 30, 15)
    // e2e가 말랑이 기분을 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-mood', this.mood)
    this.game.canvas.parentElement?.setAttribute('data-bubble', this.bubbleText.text)
    this.placeTaps()
  }

  /**
   * 누르는 칸: 말풍선은 그린 모양보다 위아래로 넓혀 손가락 크기(48px)로, 말랑이는 머리(모자)끝부터 발끝까지.
   * e2e가 누를 자리와 크기를 볼 수 있게 남긴다
   */
  private placeTaps() {
    if (!this.mascot) return
    const bw = Math.max(48, this.bubbleText.width + 24)
    this.bubbleTap.setTo(this.bubble.x - bw / 2, this.bubble.y - 24, bw, 48)
    const s = this.growth.scale
    const top = this.mascot.y + grownTop(this.look.hat, s)
    const bottom = this.mascot.y + FEET * s
    this.mascotTap.setTo(this.mascot.x - 44 * s, top, 88 * s, bottom - top)
    const box = this.game.canvas.parentElement
    const rect = (r: Phaser.Geom.Rectangle) => [r.x, r.y, r.width, r.height].map(Math.round).join(',')
    box?.setAttribute('data-bubble-tap', rect(this.bubbleTap))
    box?.setAttribute('data-mascot-tap', rect(this.mascotTap))
  }

  /** 업적 알림이 장면 위쪽에 떠 있는 동안 말풍선이 자리를 비켜 준다. 모습만 바뀐다 */
  setBubbleAway(away: boolean) {
    if (this.bubbleAway === away) return
    this.bubbleAway = away
    // 전투 중에는 말풍선이 이미 숨어 있고, 끝날 때 맞춰진다
    if (!this.bubble || this.battle) return
    this.tweens.killTweensOf(this.bubble)
    this.tweens.add({ targets: this.bubble, alpha: away ? 0 : 1, duration: 200 })
  }

  /** 레벨업: 마스코트가 폴짝 뛰고 파스텔 색종이가 터진다. 말풍선은 축하 배지에 자리를 비켜 준다 */
  celebrate() {
    // 전투 중에는 자리를 흔들지 않는다(축하 배지는 화면에 그대로 뜬다)
    if (this.battle) return
    // 뛰는 중에 또 오르면 땅으로 돌려놓고 다시 뛴다
    this.jump?.stop()
    this.hop?.stop()
    this.mascotBody.setY(0)
    this.layout(this.scale.width, this.scale.height)
    const { x, y } = this.mascot
    // e2e가 장면이 축하했는지 볼 수 있게 센다
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-celebrations', String(Number(host.getAttribute('data-celebrations') ?? 0) + 1))
    this.jump = this.tweens.add({ targets: this.mascotBody, y: -46, duration: 260, yoyo: true, repeat: 1, ease: 'Quad.easeOut' })

    this.tweens.killTweensOf(this.bubble)
    this.bubble.setAlpha(0)
    this.tweens.add({ targets: this.bubble, alpha: 1, delay: 3300, duration: 300 })

    for (let i = 0; i < 26; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05)
      const dist = Phaser.Math.Between(70, 150)
      const bit =
        i % 3 === 0
          ? this.add.star(x, y - 20, 5, 4, 9, Phaser.Utils.Array.GetRandom(CONFETTI))
          : this.add.circle(x, y - 20, Phaser.Math.Between(4, 7), Phaser.Utils.Array.GetRandom(CONFETTI))
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * dist,
        y: y - 20 + Math.sin(angle) * dist,
        angle: Phaser.Math.Between(-180, 180),
        duration: 650,
        ease: 'Cubic.easeOut',
        onComplete: () =>
          this.tweens.add({ targets: bit, y: '+=60', alpha: 0, duration: 900, ease: 'Sine.easeIn', onComplete: () => bit.destroy() }),
      })
    }
  }

  /**
   * 장 보스를 처음 깼을 때: 장면 양옆과 가운데에서 파스텔 색종이·별이 차례로 터지고 위에서 별이 떨어진다.
   * 전투 결과 카드와 같이 뜨며, 이긴 말랑이의 폴짝은 그대로 둔다. 모습만 바뀐다
   */
  celebrateChapter() {
    // e2e가 장면이 새 장을 축하했는지 볼 수 있게 센다
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-chapter-celebrations', String(Number(host.getAttribute('data-chapter-celebrations') ?? 0) + 1))
    const { width: w, height: h } = this.scale
    const bursts: [number, number, number][] = [
      [w * 0.14, h * 0.5, 0],
      [w * 0.86, h * 0.5, 260],
      [w * 0.5, h * 0.62, 520],
    ]
    for (const [x, y, delay] of bursts) this.time.delayedCall(delay, () => this.burst(x, y, 18))
    for (let i = 0; i < 16; i++) {
      const star = this.add.star(Phaser.Math.Between(16, Math.max(17, w - 16)), -12, 5, 4, 9, Phaser.Utils.Array.GetRandom(CONFETTI))
      star.setAlpha(0)
      this.tweens.add({
        targets: star,
        y: h * Phaser.Math.FloatBetween(0.5, 0.75),
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-240, 240),
        delay: 300 + i * 90,
        duration: 1700,
        ease: 'Sine.easeIn',
        onComplete: () => star.destroy(),
      })
    }
  }

  /** 한 점에서 파스텔 색종이·별이 둥글게 터진다 */
  private burst(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.15, 0.15)
      const dist = Phaser.Math.Between(40, 80)
      const color = Phaser.Utils.Array.GetRandom(CONFETTI)
      const bit = i % 2 === 0 ? this.add.star(x, y, 5, 3, 7, color) : this.add.circle(x, y, Phaser.Math.Between(3, 5), color)
      bit.setScale(0.4)
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scale: 1,
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () =>
          this.tweens.add({ targets: bit, y: '+=40', alpha: 0, duration: 800, ease: 'Sine.easeIn', onComplete: () => bit.destroy() }),
      })
    }
  }

  /** 전투 기록을 한 걸음씩 재생한다. 끝나면 onEnd(이겼는지)를 부른다 */
  playBattle(timeline: Timeline, delay: number, foe: Monster, onEnd: (win: boolean) => void) {
    this.endBattle()
    this.setMonster(foe)
    this.jump?.stop()
    // 공부 중 갸웃·운동 중 꾹꾹을 멈추고 똑바로 선다
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who.setScale(1).setAngle(0))
    // 전투 중에는 둥실·폴짝 없이 땅에 선다
    for (const body of [this.mascotBody, this.monsterBody]) this.tweens.killTweensOf(body.setY(0))
    this.tweens.killTweensOf(this.bubble)
    this.bubble.setAlpha(0)
    this.battle = { steps: timeline.steps, win: timeline.win, next: 0, bars: [this.add.graphics(), this.add.graphics()], hp: [1, 1], onEnd, ended: false }
    this.layout(this.scale.width, this.scale.height)
    this.battle.timer = this.time.addEvent({ delay, loop: true, startAt: delay * 0.4, callback: () => this.playStep() })
  }

  /** 남은 걸음을 건너뛰고 결과로 간다 */
  skipBattle() {
    const b = this.battle
    if (!b || b.ended) return
    const last = b.steps[b.steps.length - 1]
    if (last) this.drawBars(last.playerHp, last.enemyHp)
    b.next = b.steps.length
    this.finish()
  }

  /** 전투를 정리하고 홈 장면으로 돌아간다 */
  endBattle() {
    const b = this.battle
    if (!b) return
    b.timer?.remove()
    for (const bar of b.bars) {
      this.tweens.killTweensOf(bar)
      bar.destroy()
    }
    this.battle = undefined
    for (const who of [this.mascot, this.monster]) {
      this.tweens.killTweensOf(who)
      who.setAlpha(1).setScale(1).setAngle(0)
    }
    if (this.homeLook) this.setMonster(this.homeLook)
    this.layout(this.scale.width, this.scale.height)
    this.idle()
    this.tweens.add({ targets: this.bubble, alpha: this.bubbleAway ? 0 : 1, duration: 300 })
  }

  /** 장 배경(하늘 장식·땅 띠)을 바꾼다. 그림만 바뀐다 */
  setBackdrop(b: Backdrop) {
    if (this.backdrop.decor === b.decor && this.backdrop.ground === b.ground) return
    this.backdrop = b
    if (this.scenery) this.layout(this.scale.width, this.scale.height)
  }

  /** 말랑이에게 입은 꾸미기(모자·색)를 입히고 고른 소품을 놓는다. 모습만 바뀐다 */
  dress(worn: Worn) {
    this.look = worn
    this.redraw()
  }

  /** 말랑이 모습(성장 단계 몸 크기·많이 한 활동 특징)을 바꾼다. 그림만 바뀐다 */
  grow(growth: Growth) {
    const grew = growth.scale !== this.growth.scale
    this.growth = growth
    this.redraw()
    // 자란 말랑이에 닿지 않게 소품 자리를 옮긴다
    if (grew && this.mascot) this.layout(this.scale.width, this.scale.height)
  }

  private redraw() {
    if (!this.mascot) return
    this.redrawProp()
    const worn = this.look
    const { scale, traits } = this.growth
    const key = [worn.hat?.id, worn.color?.id].filter(Boolean).join(' ')
    const shown = `${key}|${scale}|${traits.join(' ')}`
    if (this.shownLook === shown) return
    this.shownLook = shown
    this.mascotGrow.removeAll(true)
    this.mascotGrow.add(this.mascotParts(worn, traits))
    this.mascotGrow.setScale(scale).setY(FEET * (1 - scale))
    if (this.battle) this.drawBars(...this.battle.hp)
    if (this.bubbleText) this.placeTaps()
    // e2e가 지금 입은 꾸미기와 모습을 볼 수 있게 남긴다
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-look', key)
    host?.setAttribute('data-grow-scale', String(scale))
    host?.setAttribute('data-traits', traits.join(' '))
  }

  private redrawProp() {
    const id = this.look.prop?.id ?? ''
    if (this.shownProp === id) return
    this.shownProp = id
    drawProp(this.prop.clear(), id)
    // e2e가 지금 놓인 소품을 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-prop', id)
  }

  /**
   * 소품 자리(아래끝 가운데). 말랑이 왼쪽에, 자란 말랑이 몸·특징 그림(반 너비 약 50)과 닿지 않게 둔다.
   * 좁은 화면에서 자리가 모자라면 소품을 조금 줄인다
   */
  private placeProp(w: number, ground: number) {
    const room = w * 0.3 - 50 * this.growth.scale - 6
    const scale = Phaser.Math.Clamp(room / (PROP_HALF * 2), 0.6, 1)
    const half = PROP_HALF * scale
    const x = Math.max(half + 2, w * 0.3 - 50 * this.growth.scale - half - 4)
    const y = ground + FEET - 2
    this.prop.setPosition(x, y).setScale(scale)
    // e2e가 소품이 차지하는 칸을 볼 수 있게 남긴다
    const box = [x - half, y - PROP_HEIGHT * scale, half * 2, PROP_HEIGHT * scale].map(Math.round).join(',')
    this.game.canvas.parentElement?.setAttribute('data-prop-box', box)
  }

  /** 둥근 말랑이. 색 꾸미기는 몸 색을, 모자 꾸미기는 머리 위(y≈-38)를 꾸민다 */
  private mascotParts(worn: Worn, traits: ActivityId[]): Phaser.GameObjects.GameObject[] {
    const [body, shade] = BODY_COLORS[worn.color?.id ?? ''] ?? [MASCOT, MASCOT_SHADE]
    // 휴식을 많이 했으면 눈 대신 졸린 눈(특징 그림)을 그린다
    const eyes = traits.includes('relax') ? [] : [this.add.ellipse(-12, -6, 8, 11, INK), this.add.ellipse(12, -6, 8, 11, INK)]
    const marks = this.add.graphics()
    drawTraits(marks, traits)
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.circle(0, 0, 38, body),
      this.add.ellipse(0, 22, 60, 20, shade).setAlpha(0.6),
      ...eyes,
      this.add.ellipse(-22, 8, 10, 6, 0xffa8a8).setAlpha(0.7),
      this.add.ellipse(22, 8, 10, 6, 0xffa8a8).setAlpha(0.7),
      marks,
    ]
    const g = this.add.graphics()
    switch (worn.hat?.id) {
      case 'hat-sprout':
        g.fillStyle(0x7cc576).fillRoundedRect(-2, -50, 4, 14, 2)
        g.fillEllipse(-9, -50, 16, 9).fillEllipse(9, -53, 16, 9)
        break
      case 'hat-mushroom':
        g.fillStyle(0xff9f9f).fillRoundedRect(-30, -58, 60, 30, { tl: 30, tr: 30, bl: 8, br: 8 })
        g.fillStyle(0xf28888).fillRoundedRect(-30, -34, 60, 6, { tl: 0, tr: 0, bl: 8, br: 8 })
        g.fillStyle(0xffffff).fillCircle(-14, -46, 5).fillCircle(6, -52, 4).fillCircle(17, -41, 4)
        break
      case 'hat-ribbon':
        g.fillStyle(0xffa8c8).fillTriangle(14, -34, 34, -48, 34, -24).fillTriangle(14, -34, -6, -48, -6, -24)
        g.fillStyle(0xff8fb4).fillCircle(14, -36, 6)
        break
      case 'hat-crown':
        g.fillStyle(CROWN).fillRoundedRect(-16, -44, 32, 9, 3)
        g.fillTriangle(-16, -42, -8, -42, -14, -54).fillTriangle(-5, -42, 5, -42, 0, -58).fillTriangle(8, -42, 16, -42, 14, -54)
        g.fillStyle(0xff8fa8).fillCircle(0, -39, 3)
        break
      // 도장 모자: 도장 7개 별 도장 핀, 30개 무지개 머리띠, 100개 꽃왕관
      case 'hat-stamp7': {
        const star = Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const r = i % 2 === 0 ? 8 : 3.6
          return new Phaser.Math.Vector2(17 + Math.cos(a) * r, -40 + Math.sin(a) * r)
        })
        g.fillStyle(0xf2a93b).fillCircle(17, -40, 14)
        g.fillStyle(0xffe07a).fillCircle(17, -40, 12)
        g.fillStyle(0xffffff).fillPoints(star, true)
        g.fillStyle(0xffa8c8).fillEllipse(3, -44, 12, 7).fillEllipse(31, -44, 12, 7)
        break
      }
      case 'hat-stamp30':
        for (const [w, r, col] of [
          [5, 40, 0xffa3b8],
          [5, 35.5, 0xffe07a],
          [5, 31, 0x93dcc0],
        ] as const) {
          g.lineStyle(w, col).beginPath().arc(0, -2, r, Math.PI * 1.2, Math.PI * 1.8, false).strokePath()
        }
        // 띠 끝의 구름 방울
        for (const side of [-1, 1]) {
          const x = side * Math.cos(Math.PI * 0.2) * 35.5
          const y = -2 - Math.sin(Math.PI * 0.2) * 35.5
          g.fillStyle(0xffffff).fillCircle(x, y, 6).fillCircle(x + side * 5, y + 3, 5)
        }
        break
      case 'hat-stamp100': {
        const colors = [0xffa3b8, 0xffe07a, 0xc7b1f2, 0xffe07a, 0xffa3b8]
        colors.forEach((col, i) => {
          const a = Math.PI * (1.2 + (0.6 * i) / (colors.length - 1))
          const x = Math.cos(a) * 36
          const y = Math.sin(a) * 36
          g.fillStyle(0x7cc576).fillEllipse(x + 6, y + 2, 9, 5)
          g.fillStyle(col).fillCircle(x, y, 6.5)
          g.fillStyle(0xffffff).fillCircle(x, y, 2.5)
        })
        // 가운데 큰 꽃
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2
          g.fillStyle(0xff8fb4).fillCircle(Math.cos(a) * 5.5, -40 + Math.sin(a) * 5.5, 5)
        }
        g.fillStyle(0xffe07a).fillCircle(0, -40, 4)
        break
      }
      // 미션 모자: 미션 별 5개 네잎클로버 핀, 20개 네 활동 빛깔 방울모자, 50개 별똥별 머리띠
      case 'hat-mission5':
        g.fillStyle(0x6fbf73).fillRoundedRect(17, -38, 3, 12, 1.5)
        for (const [dx, dy] of [
          [-5, -5],
          [5, -5],
          [-5, 5],
          [5, 5],
        ] as const) {
          g.fillStyle(0x93dcc0).fillCircle(17 + dx, -40 + dy, 6.5)
        }
        g.fillStyle(0xffffff, 0.8).fillCircle(12, -45, 2).fillCircle(22, -45, 2)
        g.fillStyle(0x6fbf73).fillCircle(17, -40, 2.5)
        break
      case 'hat-mission20':
        g.fillStyle(0xffa3b8).fillRoundedRect(-30, -52, 60, 24, { tl: 26, tr: 26, bl: 4, br: 4 })
        g.fillStyle(0x9fd0f7).fillRect(-27, -44, 54, 4)
        g.fillStyle(0x93dcc0).fillRect(-29, -38, 58, 4)
        g.fillStyle(0xc7b1f2).fillRoundedRect(-32, -32, 64, 7, 3.5)
        g.fillStyle(0xffffff).fillCircle(0, -52, 6)
        g.fillStyle(0xffe07a).fillCircle(0, -52, 3)
        break
      case 'hat-mission50': {
        g.lineStyle(6, 0xc7b1f2).beginPath().arc(0, -2, 37, Math.PI * 1.2, Math.PI * 1.8, false).strokePath()
        // 별 뒤로 꼬리 세 줄
        for (const [dy, col] of [
          [-4, 0xffa3b8],
          [0, 0x9fd0f7],
          [4, 0x93dcc0],
        ] as const) {
          g.lineStyle(3, col).lineBetween(-2, -40 + dy * 1.5, 12, -44 + dy)
        }
        const star = Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const r = i % 2 === 0 ? 10 : 4.5
          return new Phaser.Math.Vector2(18 + Math.cos(a) * r, -45 + Math.sin(a) * r)
        })
        g.fillStyle(0xffe07a).fillPoints(star, true)
        g.fillStyle(0xffffff).fillCircle(16, -46, 2)
        break
      }
      default:
        if (worn.hat?.hat) drawChapterHat(g, worn.hat.hat)
    }
    return [...parts, g]
  }

  /** 홈에서 기다리는 몬스터를 정한다. 전투 중이면 끝난 뒤에 바뀐다 */
  showHomeMonster(m: Monster) {
    this.homeLook = m
    if (!this.battle && this.monster) this.setMonster(m)
  }

  private setMonster(m: Monster) {
    if (this.shownMonster === m.id) return
    this.shownMonster = m.id
    this.monsterShape = m.shape
    this.monsterBody.removeAll(true)
    this.monsterBody.add(this.monsterParts(m))
    // e2e가 지금 어떤 몬스터가 나와 있는지 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-monster', m.id)
  }

  /** 몬스터 모양. 모두 아래쪽(y≈26)이 땅에 닿는 둥근 도형이다 */
  private monsterParts(m: Monster): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics()
    const eyes = (y: number, gap = 11) => [this.add.circle(-gap, y, 4, MONSTER_INK), this.add.circle(gap, y, 4, MONSTER_INK)]
    const cheeks = (y: number, gap = 20) =>
      [-gap, gap].map((x) => this.add.ellipse(x, y, 9, 5, 0xff8fa8).setAlpha(0.55))
    switch (m.shape) {
      case 'slime':
        g.fillStyle(m.color).fillRoundedRect(-34, -28, 68, 54, { tl: 32, tr: 32, bl: 16, br: 16 })
        g.fillStyle(m.shade).fillRoundedRect(-34, 16, 68, 10, { tl: 0, tr: 0, bl: 16, br: 16 })
        // 머리 위 새싹 두 장
        g.fillStyle(0x7cc576).fillEllipse(-7, -32, 14, 8).fillEllipse(7, -34, 14, 8)
        return [g, ...eyes(-6), ...cheeks(6)]
      case 'mushroom':
        g.fillStyle(0xfff1dc).fillRoundedRect(-20, -6, 40, 32, 14)
        g.fillStyle(m.color).fillRoundedRect(-38, -36, 76, 36, { tl: 36, tr: 36, bl: 12, br: 12 })
        g.fillStyle(m.shade).fillRoundedRect(-38, -8, 76, 8, { tl: 0, tr: 0, bl: 12, br: 12 })
        g.fillStyle(0xffffff).fillCircle(-18, -22, 6).fillCircle(8, -28, 5).fillCircle(22, -16, 4)
        return [g, ...eyes(10, 8), ...cheeks(18, 14)]
      case 'drop':
        g.fillStyle(m.color).fillTriangle(-20, -8, 20, -8, 0, -42).fillCircle(0, 2, 26)
        g.fillStyle(m.shade).fillEllipse(0, 22, 40, 8)
        g.fillStyle(0xffffff, 0.8).fillEllipse(-12, -10, 7, 12)
        return [g, ...eyes(2, 9), ...cheeks(12, 17)]
      case 'cloud':
        g.fillStyle(m.color).fillCircle(-20, -2, 17).fillCircle(2, -14, 22).fillCircle(22, -2, 16)
        g.fillRoundedRect(-38, -4, 76, 30, 15)
        g.fillStyle(m.shade).fillRoundedRect(-34, 18, 68, 8, 4)
        return [g, ...eyes(4), ...cheeks(14, 22)]
      case 'rock':
        g.fillStyle(m.color).fillRoundedRect(-36, -22, 72, 48, { tl: 24, tr: 16, bl: 14, br: 14 })
        g.fillStyle(m.shade).fillRoundedRect(-36, 16, 72, 10, { tl: 0, tr: 0, bl: 14, br: 14 })
        g.fillCircle(18, -10, 5).fillCircle(-20, 4, 3)
        // 졸린 듯 가는 눈
        return [g, this.add.ellipse(-11, -2, 10, 4, MONSTER_INK), this.add.ellipse(11, -2, 10, 4, MONSTER_INK), ...cheeks(8)]
      case 'king':
        g.fillStyle(m.color).fillRoundedRect(-42, -30, 84, 56, { tl: 38, tr: 38, bl: 18, br: 18 })
        g.fillStyle(m.shade).fillRoundedRect(-42, 15, 84, 11, { tl: 0, tr: 0, bl: 18, br: 18 })
        // 왕관
        g.fillStyle(CROWN).fillRoundedRect(-18, -36, 36, 10, 3)
        g.fillTriangle(-18, -34, -10, -34, -16, -46).fillTriangle(-6, -34, 6, -34, 0, -50).fillTriangle(10, -34, 18, -34, 16, -46)
        g.fillStyle(0xff8fa8).fillCircle(0, -31, 3)
        return [g, ...eyes(-6, 13), ...cheeks(8, 25)]
    }
  }

  private idle() {
    this.moveMascot()
    this.tweens.killTweensOf(this.monsterBody.setY(0))
    this.tweens.add({ targets: this.monsterBody, y: -6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  /**
   * 쉬는 중(상한을 채운 뒤도)에는 느리게 숨 쉬고, 운동 중에는 빠르게 꾹꾹, 공부 중에는 갸웃갸웃 고개를 기울이고,
   * 독서 중에는 책장을 넘기듯 한쪽으로 천천히 숙였다 돌아오고, 휴식 중에는 아주 느리고 깊게 숨 쉰다
   */
  private moveMascot() {
    this.breathe?.stop()
    this.mascot.setScale(1).setAngle(0)
    if (this.mood === 'study') {
      this.mascot.setAngle(-6)
      this.breathe = this.tweens.add({ targets: this.mascot, angle: 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      return
    }
    if (this.mood === 'reading') {
      this.breathe = this.tweens.add({ targets: this.mascot, angle: 5, scaleY: 0.96, duration: 1600, yoyo: true, hold: 500, repeat: -1, ease: 'Sine.easeInOut' })
      return
    }
    if (this.mood === 'relax') {
      this.breathe = this.tweens.add({ targets: this.mascot, scaleY: 0.9, scaleX: 1.07, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      return
    }
    this.breathe = this.mood === 'exercise'
      ? this.tweens.add({ targets: this.mascot, scaleY: 0.86, scaleX: 1.1, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      : this.tweens.add({ targets: this.mascot, scaleY: 0.94, scaleX: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  private playStep() {
    const b = this.battle
    if (!b || b.ended) return
    const s = b.steps[b.next++]
    if (!s) return this.finish()
    const attacker = s.actor === 'player' ? this.mascot : this.monster
    const target = s.actor === 'player' ? this.monster : this.mascot
    const dir = s.actor === 'player' ? 1 : -1
    this.layout(this.scale.width, this.scale.height)
    this.tweens.add({ targets: attacker, x: attacker.x + 34 * dir, duration: 120, yoyo: true, ease: 'Quad.easeOut' })
    // 맞은 쪽 HP 막대 위쪽 y
    const bar = s.actor === 'player' ? barY(this.scale.height) : this.mascotBarY(this.scale.height)
    this.time.delayedCall(120, () => {
      if (this.battle !== b || b.ended) return
      if (s.kind === 'miss') {
        this.tweens.add({ targets: target, x: target.x + 22 * dir, duration: 110, yoyo: true, ease: 'Sine.easeOut' })
        this.floatText(target.x, '휙! 피했다', '#6f93c4', bar)
      } else {
        this.tweens.add({ targets: target, alpha: 0.35, duration: 70, yoyo: true, repeat: 1 })
        this.tweens.add({ targets: target, angle: 8 * dir, duration: 80, yoyo: true, ease: 'Sine.easeOut' })
        // 치명타(지능)는 노란 글자로 크게 알린다
        if (s.crit) this.floatText(target.x, `치명타! -${s.damage}`, '#f0a020', bar)
        else this.floatText(target.x, `-${s.damage}`, s.actor === 'player' ? '#ff8a5b' : '#e0607e', bar)
      }
      this.drawBars(s.playerHp, s.enemyHp)
    })
    if (b.next >= b.steps.length) {
      b.timer?.remove()
      this.time.delayedCall(700, () => this.battle === b && this.finish())
    }
  }

  private finish() {
    const b = this.battle
    if (!b || b.ended) return
    b.ended = true
    b.timer?.remove()
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who)
    this.layout(this.scale.width, this.scale.height)
    const winner = b.win ? this.mascot : this.monster
    const loser = b.win ? this.monster : this.mascot
    this.tweens.add({ targets: loser, scaleY: 0.6, scaleX: 1.2, alpha: 0.55, duration: 380, ease: 'Back.easeIn' })
    // 머리 위 막대도 같이 뛰어 머리(모자)가 막대를 뚫고 올라가지 않는다
    const winnerBar = b.bars[b.win ? 0 : 1]
    // 숨쉬기가 멈춘 자리에서 찌그러진 채로 뛰지 않게 모양을 되돌린다
    winner.setScale(1)
    this.tweens.add({ targets: [winner, winnerBar], y: `-=${WIN_HOP}`, duration: 240, yoyo: true, repeat: 2, ease: 'Quad.easeOut' })
    this.game.canvas.parentElement?.setAttribute('data-winner', b.win ? 'mascot' : 'monster')
    b.onEnd(b.win)
  }

  /** 맞은 쪽 HP 막대 바로 위에서 숫자·글자가 떠오르며 사라진다(막대를 가리지 않게) */
  private floatText(x: number, text: string, color: string, barTop: number) {
    const t = this.add
      .text(x, 0, text, { fontFamily: FONT, fontSize: '20px', color, fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 })
      .setOrigin(0.5)
    const y = barTop - 5 - t.height / 2
    t.setY(y)
    // e2e가 숫자가 HP 막대를 가리는지 볼 수 있게 숫자 아래끝과 막대 위끝을 남긴다
    const box = this.game.canvas.parentElement
    box?.setAttribute('data-hit-bottom', String(Math.round(y + t.height / 2)))
    box?.setAttribute('data-bar-top', String(Math.round(barTop - 3)))
    // 톡 커지며 나타나 또렷하게 떠오르다가 끝에서만 흐려진다(뜨자마자 흐려져 읽기 어렵지 않게)
    t.setScale(0.6)
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, y: y - 26, duration: 760, ease: 'Quad.easeOut' })
    this.tweens.add({ targets: t, alpha: 0, delay: 460, duration: 300, ease: 'Quad.easeIn', onComplete: () => t.destroy() })
    // e2e가 숫자가 읽을 만큼 오래 또렷한지 볼 수 있게 0.3초 뒤 투명도를 남긴다
    // 느린 실행에선 한 프레임이 길어 늦게 불릴 수 있으니 실제로 지난 시간도 함께 남긴다
    const born = this.time.now
    this.time.delayedCall(300, () => {
      box?.setAttribute('data-hit-age-300', String(Math.round(this.time.now - born)))
      box?.setAttribute('data-hit-alpha-300', t.alpha.toFixed(2))
    })
  }

  /** 두 캐릭터 머리 위의 둥근 HP 바 */
  private drawBars(playerHp: number, enemyHp: number) {
    const b = this.battle
    if (!b) return
    const bar = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, ratio: number, color: number) => {
      g.clear()
      g.fillStyle(0xffffff).fillRoundedRect(cx - BAR_W / 2 - 3, cy - 3, BAR_W + 6, 16, 8)
      g.fillStyle(0xf3e3d3).fillRoundedRect(cx - BAR_W / 2, cy, BAR_W, 10, 5)
      if (ratio > 0) g.fillStyle(color).fillRoundedRect(cx - BAR_W / 2, cy, Math.max(10, BAR_W * ratio), 10, 5)
    }
    const { width: w, height: h } = this.scale
    bar(b.bars[0], w * 0.3, this.mascotBarY(h), playerHp, HP_PLAYER)
    bar(b.bars[1], w * 0.72, barY(h), enemyHp, HP_ENEMY)
    b.hp = [playerHp, enemyHp]
  }

  /**
   * 말랑이 HP 막대 위쪽 y. 자란 말랑이 머리(모자)끝보다 위로 올린다.
   * 아기 말랑이는 어떤 모자를 써도 몬스터 막대와 같은 높이다(머리끝 -58, 막대 아래끝 -59)
   */
  private mascotBarY(h: number): number {
    return Math.min(barY(h), groundY(h) + Math.floor(grownTop(this.look.hat, this.growth.scale)) - 14)
  }

  private layout(w: number, h: number) {
    const ground = groundY(h)
    drawScenery(this.scenery, this.backdrop, w, h)
    // e2e가 지금 그린 장식을 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-decor', this.backdrop.decor)
    this.mascot.setPosition(w * 0.3, ground)
    this.monster.setPosition(w * 0.72, ground + 6)
    this.placeProp(w, ground)
    this.bubble.setPosition(w / 2, Math.max(28, h * 0.16))
    this.placeTaps()
    // e2e가 말랑이·몬스터 발끝(장면 위에서부터 px)을 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-feet', String(Math.round(ground + FEET)))
    if (this.battle) this.drawBars(...this.battle.hp)
  }

  /** e2e가 말랑이·몬스터가 실제로 그려진 아래끝(장면 위에서부터 px)을 볼 수 있게 남긴다 */
  update() {
    const box = this.game.canvas.parentElement
    if (!box) return
    const mascot = String(Math.round(this.mascot.y + this.mascotBody.y + this.mascotGrow.y + FEET * this.growth.scale))
    const monster = String(Math.round(this.monster.y + this.monsterBody.y + 26))
    if (box.getAttribute('data-mascot-bottom') !== mascot) box.setAttribute('data-mascot-bottom', mascot)
    if (box.getAttribute('data-monster-bottom') !== monster) box.setAttribute('data-monster-bottom', monster)
    this.trackWinnerHop(box)
  }

  /** e2e가 이긴 쪽이 뛰는 동안 머리끝·HP 막대 자리(장면 위에서부터 px)를 볼 수 있게 남긴다 */
  private trackWinnerHop(box: HTMLElement) {
    const b = this.battle
    if (!b?.ended) return
    const winner = b.win ? this.mascot : this.monster
    const bar = b.bars[b.win ? 0 : 1]
    const headTop = b.win ? grownTop(this.look.hat, this.growth.scale) : MONSTER_TOP[this.monsterShape]
    const rest = groundY(this.scale.height) + (b.win ? 0 : 6) + headTop
    const top = winner.y + winner.scaleY * headTop
    // 막대 바깥 흰 테두리 위끝과 아래끝
    const barTop = (b.win ? this.mascotBarY(this.scale.height) : barY(this.scale.height)) - 3 + bar.y
    b.peak = Math.min(b.peak ?? top, top)
    b.gap = Math.min(b.gap ?? Infinity, top - (barTop + 16))
    b.barPeak = Math.min(b.barPeak ?? barTop, barTop)
    box.setAttribute('data-winner-rest', String(Math.round(rest)))
    box.setAttribute('data-winner-peak', String(Math.round(b.peak)))
    box.setAttribute('data-hop-gap', String(Math.round(b.gap)))
    box.setAttribute('data-bar-peak-top', String(Math.round(b.barPeak)))
  }
}
