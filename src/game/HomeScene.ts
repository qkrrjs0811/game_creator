import Phaser from 'phaser'
import type { ReplayStep, Timeline } from '../core/replay'
import { MONSTERS, type Monster } from '../core/monsters'
import type { Cosmetic, HatLook, HatShape, Worn } from '../core/cosmetics'
import { chapterBackdrop, type Backdrop } from '../core/backdrop'
import { FILL_ALPHA, sceneryFill, type Box } from '../core/sceneryFill'
import type { ActivityId } from '../core/types'
import { keepChatIndex, nextChatIndex } from '../core/chatter'
import { stepSound } from '../core/sound'
import { playSound } from '../ui/sound'
import { contactAt, finishDelay, hitImpact, hpTrail, isFinalBlow, type Impact } from '../core/impact'
import { comboText, playerMoves, type PlayerMove, type StepMove } from '../core/attackMove'
import { SKILL_CUTIN_NAME, skillCutinTiming, skillDebuts } from '../core/skillCutin'
import type { SkillId } from '../core/skills'
import { skillFxSize, skillFxTiming, stepSkillFx, type SkillFxKind, type SkillStyle } from '../core/skillfx'
import { weakHitText } from '../core/traits'
import { drawMonsterBody, drawMonsterFace } from './monsterArt'
import { BOSS_BAR_RAISE, bossLook, monsterScale, monsterTop } from '../core/bossLook'
import { bossDropOffset, bossEntrance, bossNameTag, type BossEntrance } from '../core/bossEntrance'
import { monsterChapter, monsterDecor } from '../core/monsterDecor'
import { monsterEndFace, monsterStepFace, type MonsterFace } from '../core/monsterLook'
import { monsterHits, type MonsterBit, type MonsterHit } from '../core/monsterHitFx'
import { MONSTER_ATTACK, MONSTER_BOTTOM, MONSTER_IDLE, REST_POSE, attackPlan, poseY, type Pose } from '../core/monsterMotion'
import { BLINK_MS, HAPPY_MS, blinkGap, endFace, moodFace, pickFace, stepFace, type Face, type Mood } from '../core/face'

export type { Mood } from '../core/face'

const MASCOT = 0xffd7a8
const MASCOT_SHADE = 0xf7b97a
const INK = 0x5a4636
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
/** 스킬 발동 띠 색: 펀치 주황·몸 하늘·발 민트(스킬 연출과 같은 색 계열) */
const SKILL_CUTIN_COLOR: Record<SkillId, number> = { punch: 0xff9a6b, tough: 0x8cc4f5, quick: 0x7fd6b4 }
/** 깎인 뒤 천천히 따라 줄어드는 옅은 막대. 빈 칸(베이지)과 구별되게 연노랑으로 한다 */
const HP_PLAYER_TRAIL = 0xffe28f
const HP_ENEMY_TRAIL = 0xffe28f
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
    // 졸린 눈은 표정(sleepy)이 그린다
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

/** 말랑이 표정. 눈(±12, -6)과 입(0, 5) 둘레에 그린다 */
function drawFace(g: Phaser.GameObjects.Graphics, face: Face) {
  const MOUTH = 0xd9665e
  // 동그란 눈과 반짝임
  const openEyes = () => {
    for (const x of [-12, 12]) {
      g.fillStyle(INK).fillEllipse(x, -6, 8.5, 11.5)
      g.fillStyle(0xffffff).fillCircle(x - 1.6, -8.6, 1.9).fillCircle(x + 1.5, -3.6, 0.9)
    }
  }
  // 웃는 눈(∩)과 감은 눈(∪)
  const arcEyes = (up: boolean, y: number) => {
    g.lineStyle(2.8, INK)
    for (const x of [-12, 12]) {
      g.beginPath()
      if (up) g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85, false)
      else g.arc(x, y - 1, 5, Math.PI * 0.15, Math.PI * 0.85, false)
      g.strokePath()
    }
  }
  // 아래로 둥근 열린 입(D)
  const openMouth = (w: number, h: number) => {
    g.fillStyle(MOUTH).beginPath().arc(0, 3, w / 2, 0, Math.PI, false).closePath().fillPath()
    g.fillStyle(0xff9fa8).fillEllipse(0, 3 + h * 0.55, w * 0.45, h * 0.35)
  }
  switch (face) {
    case 'idle':
      openEyes()
      g.lineStyle(2.4, INK).beginPath().arc(0, 2, 5, Math.PI * 0.2, Math.PI * 0.8, false).strokePath()
      return
    case 'blink':
      g.lineStyle(2.8, INK)
      for (const x of [-12, 12]) g.lineBetween(x - 5, -5, x + 5, -5)
      g.lineStyle(2.4, INK).beginPath().arc(0, 2, 5, Math.PI * 0.2, Math.PI * 0.8, false).strokePath()
      return
    case 'happy':
      arcEyes(true, -6)
      openMouth(12, 7)
      return
    case 'win':
      arcEyes(true, -7)
      openMouth(18, 10)
      // 눈가의 작은 반짝임
      g.fillStyle(0xffe07a).fillPoints(starPoints(-25, -16, 4), true).fillPoints(starPoints(25, -16, 4), true)
      return
    case 'hurt':
      // > < 눈과 오므린 입
      g.lineStyle(2.8, INK)
      g.strokePoints([new Phaser.Math.Vector2(-17, -10), new Phaser.Math.Vector2(-9, -6), new Phaser.Math.Vector2(-17, -2)], false)
      g.strokePoints([new Phaser.Math.Vector2(17, -10), new Phaser.Math.Vector2(9, -6), new Phaser.Math.Vector2(17, -2)], false)
      g.fillStyle(MOUTH).fillEllipse(0, 7, 7, 8)
      return
    case 'focus':
      openEyes()
      // 올라간 눈썹과 꾹 다문 입
      g.lineStyle(2.6, INK)
      g.lineBetween(-17, -20, -7, -16).lineBetween(17, -20, 7, -16)
      g.lineBetween(-4, 5, 4, 5)
      return
    case 'sleepy':
      arcEyes(false, -6)
      g.fillStyle(MOUTH).fillEllipse(0, 6, 5, 4)
      return
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
function drawScenery(g: Phaser.GameObjects.Graphics, b: Backdrop, w: number, h: number, keepOut: Box[]): string {
  const col = (hex: string) => Phaser.Display.Color.HexStringToColor(hex)
  const ground = col(b.ground)
  const top = groundTop(h)
  /** 하늘 안의 자리(가로 비율, 땅 위끝까지 세로 비율) */
  const at = (fx: number, fy: number): [number, number] => [w * fx, top * fy]
  g.clear()

  // 빈 하늘·땅 채우기(연하게): 하늘 가장자리 작은 구름, 땅 뒤 먼 언덕과 둥근 나무
  const fill = sceneryFill({ w, h, top, feet: groundY(h) + FEET, keepOut })
  g.fillStyle(0xffffff, FILL_ALPHA.puffs)
  for (const p of fill.puffs) g.fillEllipse(p.x, p.y, 56 * p.s, 18 * p.s).fillCircle(p.x + 6 * p.s, p.y - 6 * p.s, 12 * p.s)
  const far = Phaser.Display.Color.Interpolate.ColorWithColor(col(b.skyLow), ground, 100, 55)
  g.fillStyle(Phaser.Display.Color.GetColor(far.r, far.g, far.b), FILL_ALPHA.farHills)
  for (const c of fill.farHills) g.fillCircle(c.x, c.y, c.r)
  for (const t of fill.trees) {
    g.fillStyle(0xc9a27e, FILL_ALPHA.trees).fillRoundedRect(t.x - 2.5, t.y - t.size * 1.2, 5, t.size * 1.2, 2)
    g.fillStyle(ground.clone().darken(8).color, FILL_ALPHA.trees)
    g.fillCircle(t.x, t.y - t.size * 1.6, t.size).fillCircle(t.x - t.size * 0.55, t.y - t.size * 1.25, t.size * 0.62)
    g.fillCircle(t.x + t.size * 0.55, t.y - t.size * 1.25, t.size * 0.62)
    g.fillStyle(0xffffff, 0.35).fillCircle(t.x - t.size * 0.35, t.y - t.size * 1.95, t.size * 0.28)
  }

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

  // 땅 위 풀 포기: 잎 세 개
  g.fillStyle(ground.clone().darken(14).color, FILL_ALPHA.tufts)
  for (const t of fill.tufts) {
    const s = t.s
    g.fillEllipse(t.x - 4 * s, t.y - 4 * s, 4 * s, 9 * s).fillEllipse(t.x + 4 * s, t.y - 4 * s, 4 * s, 9 * s)
    g.fillEllipse(t.x, t.y - 5.5 * s, 4.5 * s, 11 * s)
  }

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
  return `hills:${fill.farHills.length} trees:${fill.trees.length} tufts:${fill.tufts.length} puffs:${fill.puffs.length}`
}

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
  /** 말랑이 얼굴(표정)만 다시 그리는 그림. 전투 중에는 battleFace를 따른다 */
  private face?: Phaser.GameObjects.Graphics
  private shownFace?: Face
  private battleFace?: Face
  private happyUntil = -Infinity
  private blinkUntil = -Infinity
  private nextBlinkAt = 0
  private blinks = 0
  /** 쉬는 중 말풍선에 띄울 말랑이 한마디 후보(기록을 읽고 화면이 골라 준다)와 지금 보여 주는 자리 */
  private restLines: string[] = [BUBBLES.rest]
  private chatIndex = 0
  /** 말풍선·말랑이를 눌렀을 때 다음 한마디로 넘기는 칸(장면 안 px) */
  private bubbleTap = new Phaser.Geom.Rectangle()
  private mascotTap = new Phaser.Geom.Rectangle()
  /** 홈에서 보여 줄 몬스터(다음에 도전할 스테이지)와 지금 그려진 몬스터 */
  private homeLook?: Monster
  private shownMonster = ''
  /** 몬스터 얼굴 그림과 표정. 전투 중에는 monsterFace를 따르고, 아니면 기본 표정이다 */
  private monsterFaceG?: Phaser.GameObjects.Graphics
  private shownMonsterFace?: MonsterFace
  private monsterFace: MonsterFace = 'idle'
  private monsterShape: Monster['shape'] = 'slime'
  /** 지금 나온 몬스터가 보스인지. 보스는 크게 그리고 HP 막대를 올린다 */
  private monsterBoss = false
  /** 입은 꾸미기와 지금 그려진 모습 */
  private look: Worn = { hat: null, color: null, prop: null }
  private shownLook?: string
  private battle?: {
    steps: ReplayStep[]
    win: boolean
    next: number
    /** 걸음 사이 시간(ms). 한 번의 타격 연출을 이 안에 맞춘다 */
    delay: number
    /** 말랑이가 배운 스킬과 회피가 오는 곳. 걸음마다 스킬 연출을 고른다 */
    style: SkillStyle
    /** 걸음마다 말랑이 공격 동작(박치기·점프 찍기·회전 돌진)과 연속 명중 수 */
    moves: StepMove[]
    /** 걸음마다 그 전투에서 처음 나가는 스킬(발동 장면) */
    debuts: (SkillId | null)[]
    /** 걸음마다 몬스터가 맞힐 때 튀는 그 종의 조각과 보스 큰 공격 */
    foeHits: (MonsterHit | null)[]
    /** 몬스터 몸 색과 그늘 색(조각 색) */
    foeColor: [number, number]
    /** 지금 보이는 발동 장면(어두운 막·띠·빛줄기). 전투가 끝나면 치운다 */
    cutin?: Phaser.GameObjects.GameObject[]
    timer?: Phaser.Time.TimerEvent
    /** [말랑이, 몬스터] 머리 위 HP 막대. 이긴 쪽 막대는 주인과 같이 뛴다 */
    bars: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics]
    /**
     * 이긴 쪽이 뛰는 동안 머리끝이 제자리보다 가장 높이 간 만큼(위가 음수), 막대와 가장 가까웠던 틈, 막대가 가장 높이 간 곳(e2e용).
     * 높이는 제자리 기준으로 재서, 뛰고 난 뒤 장면 크기가 바뀌어도 어긋나지 않는다
     */
    lift?: number
    gap?: number
    barPeak?: number
    /** 지금 보이는 HP 비율 [말랑이, 몬스터] */
    hp: [number, number]
    /** HP 막대 뒤 옅은 막대 비율 [말랑이, 몬스터]. 깎이면 천천히 따라 줄어든다 */
    trail: [number, number]
    trailTween: [Phaser.Tweens.Tween?, Phaser.Tweens.Tween?]
    /** 마지막 걸음이 쓰러뜨린 한 방이었는지. 진 쪽을 밀린 자리에서 납작하게 만든다 */
    knockout?: boolean
    onEnd: (win: boolean) => void
    ended: boolean
    /** 보스 등장 연출(어두운 막·이름표)과 끝나면 첫 걸음을 시작할 예약 */
    intro?: { dim: Phaser.GameObjects.Rectangle; tag: Phaser.GameObjects.Container; start: Phaser.Time.TimerEvent }
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
    this.nextBlinkAt = this.time.now + 1500
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
    this.happyUntil = this.time.now + HAPPY_MS
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
  playBattle(timeline: Timeline, delay: number, foe: Monster, style: SkillStyle, onEnd: (win: boolean) => void) {
    this.endBattle()
    this.setMonster(foe)
    this.jump?.stop()
    // 공부 중 갸웃·운동 중 꾹꾹을 멈추고 똑바로 선다
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who.setScale(1).setAngle(0))
    // 전투 중에는 둥실·폴짝 없이 땅에 선다
    this.tweens.killTweensOf(this.mascotBody.setY(0))
    this.restMonsterBody()
    this.tweens.killTweensOf(this.bubble)
    this.bubble.setAlpha(0)
    this.battle = {
      steps: timeline.steps,
      win: timeline.win,
      next: 0,
      delay,
      style,
      moves: playerMoves(timeline.steps),
      debuts: skillDebuts(timeline.steps, style),
      foeHits: monsterHits(timeline.steps, foe.shape, foe.boss),
      foeColor: [foe.color, foe.shade],
      bars: [this.add.graphics(), this.add.graphics()],
      hp: [1, 1],
      trail: [1, 1],
      trailTween: [undefined, undefined],
      onEnd,
      ended: false,
    }
    this.battleFace = 'focus'
    this.monsterFace = 'idle'
    this.game.canvas.parentElement?.setAttribute('data-final', '0')
    this.game.canvas.parentElement?.setAttribute('data-fainted', '')
    this.game.canvas.parentElement?.setAttribute('data-skill-fx', '')
    this.game.canvas.parentElement?.setAttribute('data-weak-hits', '')
    this.game.canvas.parentElement?.setAttribute('data-weak-hit', '')
    this.game.canvas.parentElement?.setAttribute('data-player-moves', '')
    this.game.canvas.parentElement?.setAttribute('data-combo', '0')
    this.game.canvas.parentElement?.setAttribute('data-skill-cutins', '')
    this.game.canvas.parentElement?.setAttribute('data-skill-cutin', '')
    this.game.canvas.parentElement?.setAttribute('data-monster-hits', '')
    this.game.canvas.parentElement?.setAttribute('data-boss-slams', '0')
    this.layout(this.scale.width, this.scale.height)
    const entrance = bossEntrance(foe, delay)
    if (entrance) this.bossIntro(this.battle, entrance, foe)
    else this.battle.timer = this.time.addEvent({ delay, loop: true, startAt: delay * 0.4, callback: () => this.playStep() })
  }

  /**
   * 보스 등장: 화면이 어두워짐 → 보스가 위에서 쿵 내려와 땅이 흔들림 → 이름표가 뜸 → 밝아지고 첫 걸음.
   * 보스와 이름표만 어두운 막 위에 둔다. HP 막대는 밝아질 때 나타난다. 모습만 바뀐다
   */
  private bossIntro(b: NonNullable<HomeScene['battle']>, e: BossEntrance, foe: Monster) {
    const { width: w, height: h } = this.scale
    const host = this.game.canvas.parentElement
    const mark = (phase: string) => host?.setAttribute('data-boss-intro', phase)
    host?.setAttribute('data-boss-intros', String(Number(host.getAttribute('data-boss-intros') ?? 0) + 1))
    mark('dim')
    const dim = this.add.rectangle(0, 0, w, h, 0x3b2a4a).setOrigin(0).setAlpha(0).setDepth(1)
    this.tweens.add({ targets: dim, alpha: e.dimAlpha, duration: e.dim })
    this.monster.setDepth(2)
    for (const bar of b.bars) bar.setAlpha(0)
    this.monsterBody.setY(bossDropOffset(this.monster.y, this.monsterTop()))
    this.monsterBody.setVisible(false)

    const tag = this.bossTag(foe, w / 2, Math.max(44, h * 0.2))
    tag.setDepth(3).setAlpha(0)

    const live = () => this.battle === b && b.intro !== undefined
    this.time.delayedCall(e.dropAt, () => {
      if (!live()) return
      mark('drop')
      this.monsterBody.setVisible(true)
      this.tweens.add({
        targets: this.monsterBody,
        y: 0,
        duration: e.drop,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (!live()) return
          mark('tag')
          // 쿵: 화면이 흔들리고 보스가 납작해졌다 펴지며 발밑에 먼지가 퐁 인다
          this.cameras.main.shake(e.shake, e.shakePx / Math.max(1, w))
          this.tweens.add({ targets: this.monsterBody, scaleY: 0.82, scaleX: 1.14, duration: 90, yoyo: true, ease: 'Quad.easeOut' })
          this.puff(this.monster.x - 26, this.monster.y + 14)
          this.puff(this.monster.x + 26, this.monster.y + 14)
          playSound('crit')
          tag.setScale(0.5).setAlpha(1)
          this.tweens.add({ targets: tag, scale: 1, duration: 260, ease: 'Back.easeOut' })
        },
      })
    })
    this.time.delayedCall(e.fadeAt, () => {
      if (!live()) return
      mark('fade')
      this.tweens.add({ targets: [dim, tag], alpha: 0, duration: e.fade })
      this.tweens.add({ targets: b.bars, alpha: 1, duration: e.fade })
    })
    const start = this.time.delayedCall(e.total, () => {
      if (!live()) return
      this.endIntro(b)
      b.timer = this.time.addEvent({ delay: b.delay, loop: true, startAt: b.delay * 0.4, callback: () => this.playStep() })
    })
    b.intro = { dim, tag, start }
  }

  /** 이름표: 둥근 흰 판에 작은 "보스 등장!"과 큰 이름 */
  private bossTag(foe: Monster, x: number, y: number): Phaser.GameObjects.Container {
    const t = bossNameTag(foe)
    const title = this.add
      .text(0, -13, t.title, { fontFamily: FONT, fontSize: '13px', color: '#ff8a5b', fontStyle: 'bold' })
      .setOrigin(0.5)
    const name = this.add
      .text(0, 9, t.name, { fontFamily: FONT, fontSize: '20px', color: '#5a4636', fontStyle: 'bold' })
      .setOrigin(0.5)
    const bw = Math.max(title.width, name.width) + 44
    const bg = this.add.graphics()
    bg.fillStyle(0xffffff).fillRoundedRect(-bw / 2, -30, bw, 60, 30)
    bg.lineStyle(3, CROWN).strokeRoundedRect(-bw / 2, -30, bw, 60, 30)
    this.game.canvas.parentElement?.setAttribute('data-boss-tag', `${t.title} ${t.name}`)
    return this.add.container(x, y, [bg, title, name])
  }

  /** 보스 등장 연출을 치우고 보스를 제자리·보통 겹침으로 돌린다 */
  private endIntro(b: NonNullable<HomeScene['battle']>) {
    const intro = b.intro
    if (!intro) return
    b.intro = undefined
    intro.start.remove()
    for (const o of [intro.dim, intro.tag]) {
      this.tweens.killTweensOf(o)
      o.destroy()
    }
    for (const bar of b.bars) {
      this.tweens.killTweensOf(bar)
      bar.setAlpha(1)
    }
    this.restMonsterBody()
    this.monsterBody.setVisible(true)
    this.monster.setDepth(0)
    this.game.canvas.parentElement?.setAttribute('data-boss-intro', '')
  }

  /** 남은 걸음을 건너뛰고 결과로 간다 */
  skipBattle() {
    const b = this.battle
    if (!b || b.ended) return
    const last = b.steps[b.steps.length - 1]
    if (last) this.drawBars(last.playerHp, last.enemyHp)
    b.knockout = false
    b.next = b.steps.length
    this.finish()
  }

  /** 전투를 정리하고 홈 장면으로 돌아간다 */
  endBattle() {
    const b = this.battle
    if (!b) return
    b.timer?.remove()
    this.endIntro(b)
    this.clearCutin(b)
    for (const t of b.trailTween) t?.stop()
    for (const bar of b.bars) {
      this.tweens.killTweensOf(bar)
      bar.destroy()
    }
    this.battle = undefined
    this.battleFace = undefined
    for (const who of [this.mascot, this.monster]) {
      this.tweens.killTweensOf(who)
      who.setAlpha(1).setScale(1).setAngle(0)
    }
    // 건너뛰어 공격 동작(점프 찍기·회전 돌진) 중에 끝나도 몸이 기울거나 뒤집힌 채 남지 않게 한다
    this.tweens.killTweensOf(this.mascotBody.setPosition(0, 0).setScale(1).setAngle(0))
    this.game.canvas.parentElement?.setAttribute('data-final', '0')
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
  private placeProp(w: number, ground: number): Box {
    const room = w * 0.3 - 50 * this.growth.scale - 6
    const scale = Phaser.Math.Clamp(room / (PROP_HALF * 2), 0.6, 1)
    const half = PROP_HALF * scale
    const x = Math.max(half + 2, w * 0.3 - 50 * this.growth.scale - half - 4)
    const y = ground + FEET - 2
    this.prop.setPosition(x, y).setScale(scale)
    // e2e가 소품이 차지하는 칸을 볼 수 있게 남긴다
    const box = [x - half, y - PROP_HEIGHT * scale, half * 2, PROP_HEIGHT * scale].map(Math.round).join(',')
    this.game.canvas.parentElement?.setAttribute('data-prop-box', box)
    return { x0: x - half, x1: x + half, y0: y - PROP_HEIGHT * scale, y1: y + 4 }
  }

  /**
   * 둥근 말랑이. 몸 뒤로 작은 손발이 빼꼼 나오고, 테두리 선·위쪽 빛·아래쪽 그늘·볼터치가 있다.
   * 색 꾸미기는 몸 색을, 모자 꾸미기는 머리 위(y≈-38)를 꾸민다. 얼굴은 표정마다 따로 그린다
   */
  private mascotParts(worn: Worn, traits: ActivityId[]): Phaser.GameObjects.GameObject[] {
    const [body, shade] = BODY_COLORS[worn.color?.id ?? ''] ?? [MASCOT, MASCOT_SHADE]
    const line = (g: Phaser.GameObjects.Graphics) => g.lineStyle(2.6, INK, 0.5)
    // 몸 뒤의 손발(발 아래끝이 몸 아래끝과 같은 땅에 닿는다)
    const limbs = this.add.graphics()
    for (const [x, y, w, h] of [
      [-36, 10, 14, 11],
      [36, 10, 14, 11],
      [-15, 32.5, 20, 11],
      [15, 32.5, 20, 11],
    ]) {
      limbs.fillStyle(shade).fillEllipse(x, y, w, h)
      line(limbs).strokeEllipse(x, y, w, h)
    }
    const skin = this.add.graphics()
    skin.fillStyle(body).fillCircle(0, 0, 38)
    skin.fillStyle(shade, 0.6).fillEllipse(0, 22, 60, 20)
    // 위쪽 빛
    skin.fillStyle(0xffffff, 0.55).fillEllipse(-13, -24, 22, 11).fillCircle(4, -29, 3)
    line(skin).strokeCircle(0, 0, 38)
    skin.fillStyle(0xffa8a8, 0.7).fillEllipse(-22, 8, 11, 6.5).fillEllipse(22, 8, 11, 6.5)
    const marks = this.add.graphics()
    drawTraits(marks, traits)
    this.face = this.add.graphics()
    this.shownFace = undefined
    const parts: Phaser.GameObjects.GameObject[] = [limbs, skin, this.face, marks]
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
    this.monsterBoss = m.boss
    this.monsterBody.removeAll(true)
    this.monsterBody.add(this.monsterParts(m))
    // 홈에서 몬스터가 바뀌면 그 종의 움직임으로 바꾼다
    if (!this.battle) this.idleMonster()
    // e2e가 지금 어떤 몬스터가 나와 있는지 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-monster', m.id)
    this.game.canvas.parentElement?.setAttribute('data-monster-decor', monsterDecor(monsterChapter(m)).join(' '))
    this.game.canvas.parentElement?.setAttribute('data-monster-boss', bossLook(m).join(' '))
  }

  /** 몬스터 모양. 모두 아래쪽(y≈26)이 땅에 닿는 둥근 도형이다. 얼굴은 표정이 바뀔 때만 다시 그린다 */
  private monsterParts(m: Monster): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics()
    drawMonsterBody(g, m)
    this.monsterFaceG = this.add.graphics()
    // 보스는 발끝을 땅에 둔 채 크게 그린다
    const s = monsterScale(m)
    for (const part of [g, this.monsterFaceG]) part.setScale(s).setY(MONSTER_BOTTOM * (1 - s))
    this.shownMonsterFace = undefined
    // 다음 프레임에 새 몬스터의 표정을 그린다
    return [g, this.monsterFaceG]
  }

  private idle() {
    this.moveMascot()
    this.idleMonster()
  }

  private idleMonster() {
    this.restMonsterBody()
    // 종마다 다르게 가만히 움직인다(말랑 납작·살랑·통통·둥실·부르르·으쓱). 기울기는 양쪽으로 똑같이 흔든다
    const m = MONSTER_IDLE[this.monsterShape]
    this.monsterBody.setAngle(-m.pose.angle)
    this.tweens.add({
      targets: this.monsterBody,
      y: poseY(m.pose),
      angle: m.pose.angle,
      scaleX: m.pose.sx,
      scaleY: m.pose.sy,
      duration: m.duration,
      repeatDelay: m.rest,
      yoyo: true,
      repeat: -1,
      ease: m.kind === 'bounce' ? 'Quad.easeOut' : 'Sine.easeInOut',
    })
    this.game.canvas.parentElement?.setAttribute('data-monster-idle', m.kind)
  }

  /** 몬스터 몸을 제자리·제모양으로 돌린다 */
  private restMonsterBody() {
    this.tweens.killTweensOf(this.monsterBody)
    this.monsterBody.setPosition(0, 0).setAngle(0).setScale(1)
    this.game.canvas.parentElement?.setAttribute('data-monster-idle', '')
  }

  /** 몬스터 몸을 한 자세로 옮긴다 */
  private poseMonster(p: Pose, duration: number, ease: string) {
    this.tweens.add({ targets: this.monsterBody, y: poseY(p), angle: p.angle, scaleX: p.sx, scaleY: p.sy, duration, ease })
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
    // 지난 걸음의 밀림·찌그러짐이 남지 않게 제자리·제모양으로 돌린다
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who.setScale(1).setAngle(0).setAlpha(1))
    this.tweens.killTweensOf(this.mascotBody.setPosition(0, 0).setScale(1).setAngle(0))
    this.tweens.killTweensOf(b.bars[0].setY(0))
    this.layout(this.scale.width, this.scale.height)
    // 쓰러뜨리는 마지막 한 방은 느린 동작으로 크게 보여 준다
    const final = isFinalBlow(s, b.next >= b.steps.length)
    b.knockout = final
    if (final) this.game.canvas.parentElement?.setAttribute('data-final', '1')
    const fx = hitImpact(s.kind, !!s.crit, b.delay, final)
    const home = { attacker: attacker.x, target: target.x }
    const live = () => this.battle === b && !b.ended
    // 배운 스킬이 보이는 연출(주먹 궤적·방패·잔상·번개). 모두 이 걸음의 타격 연출 안에 끝난다
    const skills = stepSkillFx(s, b.style, b.next - 1)
    for (const k of skills) {
      const t = skillFxTiming(k, fx)
      this.time.delayedCall(t.start, () => live() && this.skillFx(k, t.duration, fx, dir))
    }
    // 배운 스킬이 이 전투에서 처음 나가면 화면이 잠깐 어두워지고 이름 띠와 빛줄기가 지나간다
    const debut = b.debuts[b.next - 1]
    if (debut) this.skillCutin(b, debut)
    this.battleFace = 'focus'
    this.monsterFace = 'idle'
    this.markImpact('windup')
    // 몬스터는 종마다 자기만의 공격 동작(박치기·튀어 오르기·찌르기·내려오기·굴리기·내려찍기)을 몸에 더한다
    this.restMonsterBody()
    const monsterPlan = s.actor === 'enemy' ? attackPlan(this.monsterShape, fx) : []
    this.game.canvas.parentElement?.setAttribute('data-monster-attack', monsterPlan.length ? MONSTER_ATTACK[this.monsterShape].kind : '')
    let planAt = 0
    monsterPlan.forEach((p, i) => {
      const start = planAt
      planAt += p.duration
      const ease = i === 0 ? 'Sine.easeOut' : i === monsterPlan.length - 1 ? 'Quad.easeIn' : 'Quad.easeOut'
      this.time.delayedCall(start, () => live() && this.poseMonster(p.pose, p.duration, ease))
    })
    // 예비 동작: 살짝 뒤로 움츠렸다가 앞으로 튀어 나간다
    this.tweens.add({ targets: attacker, x: home.attacker - fx.pull * dir, scaleX: 0.92, scaleY: 1.06, duration: fx.windup, ease: 'Sine.easeOut' })
    // 말랑이는 공격마다 박치기·점프 찍기·회전 돌진을 돌아가며 몸에 더한다
    const move = b.moves[b.next - 1]
    if (move?.move) this.playerMove(move.move, fx, dir)
    this.time.delayedCall(fx.windup, () => {
      if (!live()) return
      this.markImpact('lunge')
      this.tweens.add({ targets: attacker, x: home.attacker + fx.reach * dir, scaleX: 1.06, scaleY: 0.95, duration: fx.lunge, ease: 'Quad.easeIn' })
    })
    // 맞은 쪽 HP 막대 위쪽 y
    const bar = s.actor === 'player' ? this.monsterBarY(this.scale.height) : this.mascotBarY(this.scale.height)
    const recover = () => {
      this.tweens.add({ targets: attacker, x: home.attacker, scaleX: 1, scaleY: 1, duration: fx.back, ease: 'Quad.easeOut' })
      if (move?.move) this.tweens.add({ targets: this.mascotBody, y: 0, angle: 0, scaleX: 1, scaleY: 1, duration: fx.back, ease: 'Quad.easeOut' })
      if (monsterPlan.length) this.poseMonster(REST_POSE, fx.back, 'Quad.easeOut')
    }
    this.time.delayedCall(contactAt(fx), () => {
      if (!live()) return
      // 부딪힌 순간 공격 동작의 마지막 자세로 멈춘다. 한 바퀴 구른 몸은 0도로 돌려 되감기지 않게 한다
      const end = monsterPlan.at(-1)?.pose
      if (end) {
        this.tweens.killTweensOf(this.monsterBody)
        this.monsterBody.setY(poseY(end)).setAngle(end.angle % 360).setScale(end.sx, end.sy)
      }
      playSound(stepSound(s.kind, !!s.crit))
      this.battleFace = stepFace(s)
      this.monsterFace = monsterStepFace(s)
      if (s.kind === 'miss') {
        this.markImpact('back')
        recover()
        this.tweens.add({ targets: target, x: home.target + 22 * dir, duration: fx.back / 2, yoyo: true, ease: 'Sine.easeOut' })
        const dodge = skills.includes('blur') ? '휙! 날쌘 발' : skills.includes('calm') ? '스윽~ 집중 회피' : '휙! 피했다'
        this.floatText(target.x, dodge, skills.includes('calm') ? '#9a7fd6' : '#6f93c4', bar)
        this.drawBars(s.playerHp, s.enemyHp)
        return
      }
      this.contact(fx, s.actor === 'player', dir)
      const foeHit = b.foeHits[b.next - 1]
      if (foeHit) this.monsterHitFx(b, foeHit, fx, dir, bar)
      // 약점이 통하면(방어를 뚫은 치명타·집중으로 맞힘) 그 글자와 연출을, 치명타(지능)는 노란 글자로 더 크게 알린다
      const weak = weakHitText(s)
      if (weak) {
        this.floatText(target.x, weak, s.pierce ? '#e0602e' : '#8a6ad8', bar, 28)
        this.weakHitFx(s.pierce ? 'pierce' : 'aimed', fx)
      } else if (s.crit) this.floatText(target.x, `치명타! -${s.damage}`, '#f0a020', bar, 28)
      else this.floatText(target.x, `-${s.damage}`, s.actor === 'player' ? '#ff8a5b' : '#e0607e', bar)
      this.drawBars(s.playerHp, s.enemyHp)
      const combo = move && comboText(move.combo)
      if (move && combo) this.comboText(combo, move.combo)
      // 히트스톱: 부딪힌 채로 아주 잠깐 멈췄다가, 맞은 쪽이 찌그러지며 밀리고 때린 쪽은 돌아온다
      this.time.delayedCall(fx.hitstop, () => {
        if (!live()) return
        this.markImpact('back')
        recover()
        this.tweens.add({
          targets: target,
          x: home.target + fx.knock * dir,
          scaleX: 1 + fx.squash,
          scaleY: 1 - fx.squash,
          angle: 8 * dir,
          duration: final ? fx.back : fx.back / 2,
          // 쓰러진 쪽은 밀려난 자리에 남아 그대로 납작해진다
          yoyo: !final,
          ease: 'Quad.easeOut',
        })
      })
    })
    this.time.delayedCall(contactAt(fx) + fx.hitstop + fx.back, () => live() && this.markImpact('rest'))
    if (b.next >= b.steps.length) {
      b.timer?.remove()
      this.time.delayedCall(finishDelay(fx), () => this.battle === b && this.finish())
    }
  }

  /**
   * 말랑이 공격 동작을 몸(mascotBody)에 더한다. 박치기는 앞으로 숙이고, 점프 찍기는 움츠릴 때 높이 떴다가
   * 튀어 나가며 내려찍고, 회전 돌진은 빙글 뒤집히며 나간다. 부딪히는 순간(움츠림 + 튀어 나감)에 끝난다
   */
  private playerMove(move: PlayerMove, fx: Impact, dir: number) {
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-player-move', move)
    host?.setAttribute('data-player-moves', `${host.getAttribute('data-player-moves') ?? ''} ${move}`.trim())
    const body = this.mascotBody
    const b = this.battle
    const live = () => this.battle === b && !b?.ended
    if (move === 'tackle') {
      this.tweens.add({ targets: body, angle: 14 * dir, duration: fx.windup + fx.lunge, ease: 'Quad.easeIn' })
      return
    }
    if (move === 'hop') {
      // 머리 위 HP 막대도 같이 떠서 머리가 막대를 뚫고 올라가지 않는다
      const bar = b?.bars[0]
      this.tweens.add({ targets: body, y: -38, angle: -10 * dir, scaleX: 0.92, scaleY: 1.1, duration: fx.windup, ease: 'Sine.easeOut' })
      if (bar) this.tweens.add({ targets: bar, y: -38, duration: fx.windup, ease: 'Sine.easeOut' })
      this.time.delayedCall(fx.windup, () => {
        if (!live()) return
        this.tweens.add({ targets: body, y: 0, angle: 18 * dir, scaleX: 1.12, scaleY: 0.88, duration: fx.lunge, ease: 'Quad.easeIn' })
        if (bar) this.tweens.add({ targets: bar, y: 0, duration: fx.lunge, ease: 'Quad.easeIn' })
      })
      return
    }
    // 가로로 뒤집혔다 돌아와 빙글 도는 것처럼 보이고, 뒤로 민트 고리가 남는다
    this.tweens.add({ targets: body, scaleX: -1, duration: fx.windup, ease: 'Sine.easeInOut' })
    this.time.delayedCall(fx.windup, () => {
      if (!live()) return
      this.tweens.add({ targets: body, scaleX: 1, duration: fx.lunge, ease: 'Sine.easeInOut' })
      const at = this.bodyOf(false)
      for (let i = 0; i < 2; i++) {
        const ring = this.add.ellipse(at.x - dir * (10 + i * 14), at.y, at.rx * 1.6, at.ry * 0.5).setStrokeStyle(3, 0x8fd6c4).setFillStyle(0xffffff, 0)
        this.tweens.add({ targets: ring, alpha: { from: 0.9, to: 0 }, scaleX: 1.3, delay: i * 40, duration: fx.lunge + fx.back / 2, ease: 'Quad.easeOut', onComplete: () => ring.destroy() })
      }
    })
  }

  /**
   * 스킬 발동 장면: 뒤 배경이 살짝 어두워지고(말랑이·몬스터·타격 연출은 밝은 채), 스킬 색 띠가 옆에서 쓱 들어와
   * 이름을 보여 주고, 하얀 빛줄기가 띠를 따라 지나간다. 다음 걸음 전에 모두 사라진다
   */
  private skillCutin(b: NonNullable<HomeScene['battle']>, id: SkillId) {
    this.clearCutin(b)
    const { width: w, height: h } = this.scale
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-skill-cutin', id)
    host?.setAttribute('data-skill-cutins', `${host.getAttribute('data-skill-cutins') ?? ''} ${id}`.trim())
    const t = skillCutinTiming(b.delay)
    const color = SKILL_CUTIN_COLOR[id]
    // 어두운 막은 두 캐릭터 뒤에 깐다
    const dim = this.add.rectangle(0, 0, w, h, 0x3b2a4a).setOrigin(0).setAlpha(0)
    const lowest = this.children.getIndex(this.mascot) < this.children.getIndex(this.monster) ? this.mascot : this.monster
    this.children.moveBelow(dim as Phaser.GameObjects.GameObject, lowest as Phaser.GameObjects.GameObject)
    // 띠: 둥근 스킬 색 판에 흰 테두리, 가운데 큰 이름
    const y = Math.max(48, h * 0.2)
    const label = this.add
      .text(0, 0, SKILL_CUTIN_NAME[id], { fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold', stroke: '#5a4636', strokeThickness: 5 })
      .setOrigin(0.5)
    const bw = Math.min(w - 24, label.width + 64)
    const bg = this.add.graphics()
    bg.fillStyle(color, 0.95).fillRoundedRect(-bw / 2, -26, bw, 52, 26)
    bg.lineStyle(4, 0xffffff).strokeRoundedRect(-bw / 2, -26, bw, 52, 26)
    // 띠 위를 비스듬히 훑고 지나가는 하얀 빛 두 줄(띠 밖으로는 안 보이게 띠 안에서만 움직인다)
    const shine = this.add.graphics()
    shine.fillStyle(0xffffff, 0.6).fillRoundedRect(-8, -20, 16, 40, 8)
    shine.fillStyle(0xffffff, 0.4).fillRoundedRect(14, -18, 7, 36, 3.5)
    shine.setAngle(18).setX(-bw / 2 + 30).setAlpha(0)
    const band = this.add.container(-w, y, [bg, shine, label]).setDepth(3)
    // 스킬 색 빛살: 띠 아래로 화면을 가로지르는 긴 빛줄기
    const streak = this.add.graphics().setDepth(2)
    streak.fillStyle(color, 0.55).fillRoundedRect(-w * 0.6, -6, w * 1.2, 12, 6)
    streak.fillStyle(0xffffff, 0.7).fillRoundedRect(-w * 0.45, -2, w * 0.9, 4, 2)
    streak.setPosition(w / 2, y + 36).setAngle(-6).setScale(0, 1)
    b.cutin = [dim, band, streak]
    const live = () => this.battle === b && !b.ended && b.cutin?.[0] === dim
    this.tweens.add({ targets: dim, alpha: t.dimAlpha, duration: t.dim })
    this.tweens.add({ targets: band, x: w / 2, duration: t.dim + 60, ease: 'Back.easeOut' })
    this.tweens.add({ targets: streak, scaleX: 1, duration: t.dim + 80, ease: 'Quad.easeOut' })
    // 빛은 지나가는 동안만 보이고 양 끝에서는 사라져 이름을 가리지 않는다
    this.tweens.add({ targets: shine, x: bw / 2 - 40, delay: t.dim, duration: Math.round(t.hold * 0.7), ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: shine, alpha: 1, delay: t.dim, duration: Math.round(t.hold * 0.35), yoyo: true, ease: 'Sine.easeInOut' })
    this.time.delayedCall(t.dim + t.hold, () => {
      if (!live()) return
      this.tweens.add({ targets: [dim, streak], alpha: 0, duration: t.fade })
      this.tweens.add({ targets: band, x: w * 1.5, alpha: 0, duration: t.fade, ease: 'Quad.easeIn', onComplete: () => live() && this.clearCutin(b) })
    })
  }

  /**
   * 몬스터가 말랑이를 맞힌 순간: 맞은 자리에서 그 종의 조각(잎사귀·포자·물방울·솜뭉치·돌 조각·보석)이
   * 몬스터 색으로 말랑이 뒤쪽으로 튀었다 떨어진다. 보스 큰 공격은 땅에 충격파가 퍼지고 화면이 흔들리며 "쿵!"이 뜬다
   */
  private monsterHitFx(b: NonNullable<HomeScene['battle']>, hit: MonsterHit, fx: Impact, dir: number, barTop: number) {
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-monster-hit', hit.bit)
    host?.setAttribute('data-monster-hits', `${host.getAttribute('data-monster-hits') ?? ''} ${hit.bit}`.trim())
    const body = this.bodyOf(false)
    const [color, shade] = b.foeColor
    const hx = body.x - dir * body.rx * 0.6
    for (let i = 0; i < hit.count; i++) {
      const spread = (Math.PI * 0.7 * i) / Math.max(1, hit.count - 1)
      const a = -Math.PI / 2 + dir * (Math.PI * 0.1 + spread) + Phaser.Math.FloatBetween(-0.15, 0.15)
      const dist = Phaser.Math.Between(hit.big ? 56 : 44, hit.big ? 100 : 72)
      const bit = this.monsterBit(hit.bit, hx, body.y, i % 3 === 2 ? shade : color, shade)
      const tx = hx + Math.cos(a) * dist
      const ty = body.y + Math.sin(a) * dist
      this.tweens.add({ targets: bit, x: tx, angle: Phaser.Math.Between(-200, 200), delay: fx.hitstop * 0.4, duration: 480, ease: 'Cubic.easeOut' })
      // 튀어 오른 뒤 아래로 톡 떨어지며 사라진다
      this.tweens.add({
        targets: bit,
        y: ty,
        delay: fx.hitstop * 0.4,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () =>
          this.tweens.add({ targets: bit, y: ty + 22, alpha: 0, scale: 0.6, duration: 260, ease: 'Quad.easeIn', onComplete: () => bit.destroy() }),
      })
    }
    if (!hit.big) return
    host?.setAttribute('data-boss-slams', String(Number(host.getAttribute('data-boss-slams') ?? 0) + 1))
    this.cameras.main.shake(hit.shake, hit.shakePx / Math.max(1, this.scale.width))
    navigator.vibrate?.(40)
    // 말랑이 발밑에서 몬스터 색 충격파 고리 두 겹이 퍼진다
    const feet = body.y + body.ry
    for (let i = 0; i < 2; i++) {
      const ring = this.add.ellipse(body.x, feet, 60, 14).setStrokeStyle(4, i ? 0xffffff : shade).setFillStyle(color, i ? 0 : 0.25)
      this.tweens.add({ targets: ring, scaleX: 2.6, scaleY: 1.8, alpha: { from: 0.9, to: 0 }, delay: i * 70, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() })
    }
    // 큰 "쿵!"은 데미지 숫자 위에 비스듬히 톡 커졌다 사라진다
    const t = this.add
      .text(body.x + 34, barTop - 30, hit.text ?? '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', fontStyle: 'bold', stroke: '#8a5ad0', strokeThickness: 7 })
      .setOrigin(0.5, 1)
      .setAngle(10)
      .setScale(0.3)
    this.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 14, delay: 380, duration: 300, ease: 'Quad.easeIn', onComplete: () => t.destroy() })
  }

  /** 몬스터 종의 조각 하나. 모두 둥근 도형이다 */
  private monsterBit(kind: MonsterBit, x: number, y: number, color: number, shade: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y)
    g.fillStyle(color, 1).lineStyle(1.5, shade, 1)
    if (kind === 'leaf') {
      g.fillEllipse(0, 0, 13, 6).strokeEllipse(0, 0, 13, 6)
      g.lineBetween(-5, 0, 5, 0)
    } else if (kind === 'spore') {
      g.fillCircle(0, 0, 4).strokeCircle(0, 0, 4)
      g.fillStyle(0xffffff, 1).fillCircle(-1, -1, 1.4)
    } else if (kind === 'droplet') {
      g.fillTriangle(-4, 0, 4, 0, 0, -8).fillCircle(0, 1, 4.2)
      g.fillStyle(0xffffff, 0.9).fillCircle(-1.4, 0, 1.3)
    } else if (kind === 'puff') {
      g.fillCircle(-4, 0, 4.5).fillCircle(3, -1, 5).fillCircle(0, 3, 4)
    } else if (kind === 'pebble') {
      g.fillRoundedRect(-5, -4, 10, 8, 3).strokeRoundedRect(-5, -4, 10, 8, 3)
    } else {
      g.fillPoints([new Phaser.Math.Vector2(0, -7), new Phaser.Math.Vector2(5, 0), new Phaser.Math.Vector2(0, 7), new Phaser.Math.Vector2(-5, 0)], true)
      g.fillStyle(0xffffff, 0.9).fillCircle(-1, -2, 1.4)
    }
    return g
  }

  /** 발동 장면을 바로 치운다 */
  private clearCutin(b: NonNullable<HomeScene['battle']>) {
    for (const o of b.cutin ?? []) {
      this.tweens.killTweensOf(o)
      o.destroy()
    }
    if (b.cutin) this.game.canvas.parentElement?.setAttribute('data-skill-cutin', '')
    b.cutin = undefined
  }

  /** 연속으로 맞히면 두 캐릭터 사이 위에 "N 콤보!"가 톡 튀어 오른다. 맞은 숫자와 겹치지 않는 가운데 자리다 */
  private comboText(text: string, combo: number) {
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-combo', String(combo))
    const y = Math.min(this.mascotBarY(this.scale.height), this.monsterBarY(this.scale.height)) - 6
    const t = this.add
      .text(this.scale.width * 0.5, y, text, { fontFamily: FONT, fontSize: `${Math.min(30, 20 + combo)}px`, color: '#ff8a5b', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6 })
      .setOrigin(0.5, 1)
      .setAngle(-6)
      .setScale(0.4)
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, delay: 420, duration: 320, ease: 'Quad.easeIn', onComplete: () => t.destroy() })
  }

  /** 부딪힌 순간: 맞은 쪽이 하얗게 번쩍이고 별·조각이 튄다. 치명타면 화면이 흔들리고 진동한다 */
  private contact(fx: Impact, enemyHit: boolean, dir: number) {
    // 맞은 쪽 몸 가운데와 반지름(장면 좌표)
    const body = this.bodyOf(enemyHit)
    const host = this.game.canvas.parentElement
    if (fx.flash) {
      const flash = this.add.ellipse(body.x, body.y, body.rx * 2, body.ry * 2, 0xffffff).setAlpha(0.85)
      host?.setAttribute('data-flash', '1')
      this.tweens.add({
        targets: flash,
        alpha: 0,
        delay: fx.hitstop * 0.6,
        duration: fx.hitstop * 0.4 + 80,
        onComplete: () => {
          flash.destroy()
          host?.setAttribute('data-flash', '0')
        },
      })
    }
    // 부딪힌 자리(때린 쪽을 바라보는 몸 가장자리)에서 맞은 쪽 뒤로 부채꼴로 퍼진다
    const hx = body.x - dir * body.rx * 0.7
    for (let i = 0; i < fx.sparks; i++) {
      const spread = (Math.PI * 0.6 * i) / Math.max(1, fx.sparks - 1)
      const a = -Math.PI / 2 + dir * (Math.PI * 0.15 + spread) + Phaser.Math.FloatBetween(-0.12, 0.12)
      const dist = Phaser.Math.Between(26, fx.shake ? 64 : 46)
      const color = fx.shake && i % 2 === 0 ? CROWN : Phaser.Utils.Array.GetRandom(CONFETTI)
      const bit = i % 2 === 0 ? this.add.star(hx, body.y, 5, 2.5, 6, color) : this.add.circle(hx, body.y, Phaser.Math.Between(2, 4), color)
      this.tweens.add({
        targets: bit,
        x: hx + Math.cos(a) * dist,
        y: body.y + Math.sin(a) * dist,
        angle: Phaser.Math.Between(-160, 160),
        alpha: { from: 1, to: 0 },
        scale: { from: 1.1, to: 0.4 },
        delay: fx.hitstop * 0.5,
        duration: 340,
        ease: 'Cubic.easeOut',
        onComplete: () => bit.destroy(),
      })
    }
    if (fx.shake) {
      this.cameras.main.shake(fx.shake, fx.shakePx / Math.max(1, this.scale.width))
      navigator.vibrate?.(fx.vibrate)
      host?.setAttribute('data-shakes', String(Number(host.getAttribute('data-shakes') ?? 0) + 1))
    }
    host?.setAttribute('data-sparks', String(fx.sparks))
    this.markImpact('stop')
  }

  /**
   * 약점이 통한 순간의 연출. pierce: 단단한 몸에 금이 가고 조각이 톡톡 떨어진다,
   * aimed: 날쌘 몸에 보라 과녁이 조여 들며 꽂힌다. 그림만이라 전투 값은 그대로다
   */
  private weakHitFx(kind: 'pierce' | 'aimed', fx: Impact) {
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-weak-hit', kind)
    host?.setAttribute('data-weak-hits', `${host.getAttribute('data-weak-hits') ?? ''} ${kind}`.trim())
    const body = this.bodyOf(true)
    const hold = fx.hitstop + fx.back
    if (kind === 'pierce') {
      // 몸 가운데에서 뻗는 지그재그 금(하얀 테두리 위 진한 갈색)
      const crack = this.add.graphics()
      const paths: [number, number][][] = [
        [[0, -0.1], [-0.18, -0.38], [-0.08, -0.55], [-0.26, -0.8]],
        [[0, -0.1], [0.22, -0.2], [0.34, -0.48], [0.56, -0.5]],
        [[0, -0.1], [0.06, 0.2], [-0.16, 0.4], [-0.1, 0.62]],
      ]
      for (const [w, c] of [[7, 0xffffff], [3.5, 0x8a5a3c]] as const) {
        crack.lineStyle(w, c, 1)
        for (const p of paths) {
          crack.beginPath()
          crack.moveTo(body.x + p[0][0] * body.rx, body.y + p[0][1] * body.ry)
          for (const [px, py] of p.slice(1)) crack.lineTo(body.x + px * body.rx, body.y + py * body.ry)
          crack.strokePath()
        }
      }
      this.tweens.add({ targets: crack, alpha: 0, delay: hold, duration: 260, ease: 'Quad.easeIn', onComplete: () => crack.destroy() })
      // 깨진 조각이 둥글게 튀었다가 아래로 떨어진다
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * (0.15 + 0.7 * (i / 5))
        const sx = body.x + Math.cos(a) * body.rx * 0.6
        const sy = body.y + Math.sin(a) * body.ry * 0.6
        const bit = this.add.triangle(sx, sy, 0, 0, 9, 2, 4, 9, i % 2 ? 0xd9c2a8 : 0xfff1e0).setStrokeStyle(1.5, 0x8a5a3c)
        this.tweens.add({ targets: bit, x: sx + Math.cos(a) * 34, angle: Phaser.Math.Between(-200, 200), duration: 520, ease: 'Quad.easeOut' })
        this.tweens.add({ targets: bit, y: { from: sy, to: sy + 40 }, duration: 520, ease: 'Back.easeIn' })
        this.tweens.add({ targets: bit, alpha: 0, delay: 320, duration: 200, onComplete: () => bit.destroy() })
      }
      return
    }
    // 큰 보라 고리 두 개가 몸 가운데로 조여 들고, 가운데 별이 톡 빛난다
    const r = Math.max(body.rx, body.ry)
    for (const [k, delay] of [[1.6, 0], [1.1, 60]] as const) {
      const ring = this.add.circle(body.x, body.y, r * k).setStrokeStyle(4, 0x9a7fd6).setFillStyle(0xffffff, 0)
      this.tweens.add({ targets: ring, scale: 0.35, delay, duration: 220, ease: 'Quad.easeIn' })
      this.tweens.add({ targets: ring, alpha: 0, delay: delay + 200, duration: 140, onComplete: () => ring.destroy() })
    }
    const star = this.add.star(body.x, body.y, 5, 6, 14, 0xfff3a6).setStrokeStyle(2, 0x9a7fd6).setScale(0)
    this.tweens.add({ targets: star, scale: 1.2, delay: 200, duration: 140, ease: 'Back.easeOut' })
    this.tweens.add({ targets: star, alpha: 0, delay: 200 + hold, duration: 200, onComplete: () => star.destroy() })
  }

  /** 말랑이(enemy=false) 또는 몬스터(true)의 몸 가운데와 반지름(장면 좌표) */
  private bodyOf(enemy: boolean) {
    const s = this.growth.scale
    const top = this.monsterTop()
    return enemy
      ? { x: this.monster.x, y: this.monster.y + (top + 26) / 2, rx: 42 * monsterScale({ boss: this.monsterBoss }), ry: (26 - top) / 2 + 3 }
      : { x: this.mascot.x, y: this.mascot.y + FEET * (1 - s), rx: 41 * s, ry: 41 * s }
  }

  /**
   * 배운 스킬이 보이는 연출. 말랑 펀치는 큰 주먹 궤적, 날쌘 발은 튀어 나갈 때 잔상, 지능 치명타는 번개,
   * 단단한 몸은 맞을 때 방패 반짝임, 피하면 날쌘 발(민트)·집중(보라) 잔상. duration(ms) 안에 사라진다
   */
  private skillFx(kind: SkillFxKind, duration: number, fx: Impact, dir: number) {
    const b = this.battle
    if (!b) return
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-skill-fx', `${host.getAttribute('data-skill-fx') ?? ''} ${kind}`.trim())
    host?.setAttribute('data-skill-now', kind)
    const fade = (target: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[], delay: number, time: number) =>
      this.tweens.add({ targets: target, alpha: 0, delay, duration: Math.max(40, time), ease: 'Quad.easeIn', onComplete: () => [target].flat().forEach((t) => t.destroy()) })
    // 말랑이 뒤에 깔리는 잔상(말랑이 몸 모양 그대로 옅게)
    const ghost = (x: number, y: number, r: number, color: number, alpha: number) => {
      const g = this.add.ellipse(x, y, r * 2, r * 2, color).setAlpha(alpha)
      this.children.moveBelow(g as Phaser.GameObjects.GameObject, this.mascot as Phaser.GameObjects.GameObject)
      return g
    }
    // 움직인 쪽 반대로 흐르는 둥근 속도 줄
    const lines = (x: number, y: number, r: number, side: number) => {
      const g = this.add.graphics()
      g.lineStyle(4, 0xffffff, 0.9)
      for (const [dy, len] of [[-r * 0.5, 26], [0, 34], [r * 0.5, 22]]) g.lineBetween(x + side * (r + 6), y + dy, x + side * (r + 6 + len), y + dy)
      return g
    }

    switch (kind) {
      case 'fist': {
        // 말랑이 앞 위쪽에서 몬스터까지 둥근 호를 그리며 날아가고, 지나간 자리에 노란 궤적이 남는다
        const z = skillFxSize(b.style.punch)
        const from = this.bodyOf(false)
        const to = this.bodyOf(true)
        const knuckles = [-1, 0, 1].map((k) => this.add.circle(10 * z, k * 7 * z, 5 * z, 0xffe9dc).setStrokeStyle(2, 0xff8a5b))
        const fist = this.add.container(0, 0, [this.add.circle(0, 0, 14 * z, 0xffe1cf).setStrokeStyle(3, 0xff8a5b), ...knuckles])
        const start = { x: from.x + from.rx * 0.6, y: from.y - 26 }
        const end = { x: to.x - to.rx * 0.55, y: to.y }
        const travel = Math.max(40, fx.lunge)
        fist.setPosition(start.x, start.y).setScale(0.6)
        let lastTrail = -1
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: travel,
          ease: 'Quad.easeIn',
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0
            fist.setPosition(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * 34).setScale(0.6 + 0.4 * t)
            if (t - lastTrail < 0.12) return
            lastTrail = t
            const dot = this.add.circle(fist.x, fist.y, 10 * z, CROWN).setAlpha(0.6)
            this.tweens.add({ targets: dot, alpha: 0, scale: 0.3, duration: 160, onComplete: () => dot.destroy() })
          },
        })
        // 부딪히면 주먹이 톡 커지며 사라진다
        this.tweens.add({ targets: fist, scale: 1.35, delay: travel, duration: 90, ease: 'Back.easeOut' })
        fade(fist, travel + 60, duration - travel - 60)
        return
      }
      case 'dash': {
        // 튀어 나가는 동안 지나온 자리에 민트 잔상이 세 번 남는다
        const z = skillFxSize(b.style.quick)
        for (let i = 0; i < 3; i++) {
          this.time.delayedCall((fx.lunge * i) / 3, () => {
            if (this.battle !== b) return
            const at = this.bodyOf(false)
            const g = ghost(at.x - dir * 6 * i, at.y, at.rx * (0.9 + 0.05 * z), 0x9be3c4, 0.5 - i * 0.08)
            fade(g, 0, duration * 0.55)
          })
        }
        const at = this.bodyOf(false)
        fade(lines(at.x, at.y, at.rx, -dir), fx.lunge * 0.3, duration * 0.5)
        return
      }
      case 'bolt': {
        // 노란 번개가 몬스터에게 내리꽂힌다. HP 막대·치명타 글자를 가리지 않게 막대 바로 아래에서 시작한다
        const t = this.bodyOf(true)
        const top = this.monsterBarY(this.scale.height) + 18
        const k = Math.min(1, Math.max(0.4, (t.y - t.ry + 18 - top) / 96))
        const g = this.add.graphics({ x: t.x + 6, y: top })
        const pts = [[-8, 0], [12, 0], [4, 36], [18, 36], [-10, 96], [-2, 52], [-16, 52]].map(([x, y]) => new Phaser.Math.Vector2(x, y))
        g.fillStyle(CROWN, 1).fillPoints(pts, true)
        g.lineStyle(3, 0xffffff, 1).strokePoints(pts, true)
        // 짧아져도 가늘어 안 보이지 않게 가로는 덜 줄인다
        g.setScale(Math.max(0.8, k), 0)
        this.tweens.add({ targets: g, scaleY: k, duration: Math.min(60, fx.lunge), ease: 'Quad.easeIn' })
        const ring = this.add.circle(t.x, t.y - t.ry * 0.3, 10).setStrokeStyle(4, CROWN).setAlpha(0)
        this.tweens.add({ targets: ring, alpha: { from: 1, to: 0 }, scale: 4, delay: Math.min(60, fx.lunge), duration: duration * 0.6, onComplete: () => ring.destroy() })
        fade(g, duration * 0.45, duration * 0.55)
        return
      }
      case 'shield': {
        // 몬스터 쪽 몸 앞에 하늘색 방패가 반짝 서서 막는다
        const z = skillFxSize(b.style.tough)
        const me = this.bodyOf(false)
        const g = this.add.graphics({ x: me.x + me.rx * 0.85, y: me.y })
        const h = me.ry * 1.9
        g.fillStyle(0xa8d4ff, 0.65).fillEllipse(0, 0, 24 * z, h)
        g.lineStyle(3, 0xffffff, 1).strokeEllipse(0, 0, 24 * z, h)
        g.fillStyle(0xffffff, 0.8).fillEllipse(-3, -h * 0.22, 6, h * 0.3)
        g.setScale(0.5)
        this.tweens.add({ targets: g, scale: 1, duration: 110, ease: 'Back.easeOut' })
        const stars = [-0.45, 0, 0.45].map((k, i) =>
          this.add.star(me.x + me.rx * 0.85 + (i - 1) * 12, me.y + k * h, 4, 2, 7, i === 1 ? CROWN : 0xffffff).setAngle(i * 20),
        )
        this.tweens.add({ targets: stars, scale: { from: 0.4, to: 1.3 }, angle: '+=90', duration: duration * 0.5, yoyo: true })
        fade([g, ...stars], duration * 0.5, duration * 0.5)
        return
      }
      case 'blur':
      case 'calm': {
        // 피한 자리에 옅은 잔상이 남는다. 집중은 보라 잔상과 고요한 물결
        const me = this.bodyOf(false)
        const color = kind === 'blur' ? 0x9be3c4 : 0xc9a7ff
        const ghosts = [0, 1].map((i) => ghost(me.x + 8 * i, me.y, me.rx, color, 0.5 - i * 0.18))
        fade(ghosts, duration * 0.2, duration * 0.8)
        if (kind === 'blur') {
          fade(lines(me.x, me.y, me.rx, -dir), 0, duration * 0.7)
          return
        }
        const ring = this.add.circle(me.x, me.y, me.rx).setStrokeStyle(3, color).setAlpha(0.9)
        this.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration, ease: 'Sine.easeOut', onComplete: () => ring.destroy() })
        return
      }
    }
  }

  /** e2e가 한 번의 타격이 어느 단계인지(움츠림·튀어 나감·멈춤·밀림·제자리), 몇 번 부딪혔는지 볼 수 있게 남긴다 */
  private markImpact(phase: 'windup' | 'lunge' | 'stop' | 'back' | 'rest') {
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-impact', phase)
    if (phase === 'stop') host?.setAttribute('data-impacts', String(Number(host.getAttribute('data-impacts') ?? 0) + 1))
  }

  private finish() {
    const b = this.battle
    if (!b || b.ended) return
    b.ended = true
    b.timer?.remove()
    this.endIntro(b)
    this.clearCutin(b)
    this.battleFace = endFace(b.win)
    this.monsterFace = monsterEndFace(b.win)
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who)
    this.restMonsterBody()
    this.tweens.killTweensOf(this.mascotBody.setPosition(0, 0).setScale(1).setAngle(0))
    this.tweens.killTweensOf(b.bars[0].setY(0))
    const winner = b.win ? this.mascot : this.monster
    const loser = b.win ? this.monster : this.mascot
    // 마지막 한 방에 밀려난 쪽은 그 자리에서 쓰러진다
    const fallenX = loser.x
    this.layout(this.scale.width, this.scale.height)
    if (b.knockout) loser.setX(fallenX)
    const host = this.game.canvas.parentElement
    // 진 쪽은 납작해지며 사라진다. 진 말랑이는 다음에 다시 서야 하니 사라지지 않고 납작하게 엎드린다
    const gone = loser === this.monster
    this.tweens.add({
      targets: loser,
      scaleY: gone ? 0.12 : 0.5,
      scaleX: gone ? 1.5 : 1.3,
      alpha: gone ? 0 : 0.45,
      duration: gone ? 420 : 380,
      ease: 'Back.easeIn',
      onComplete: () => {
        host?.setAttribute('data-fainted', b.win ? 'monster' : 'mascot')
        // 사라진 자리에 작은 연기 방울이 퐁 남는다
        if (gone && this.battle === b) this.puff(loser.x, loser.y)
      },
    })
    // 사라지는 몬스터의 빈 HP 막대도 같이 사라진다
    if (gone) this.tweens.add({ targets: b.bars[1], alpha: 0, delay: 200, duration: 300 })
    // 머리 위 막대도 같이 뛰어 머리(모자)가 막대를 뚫고 올라가지 않는다
    const winnerBar = b.bars[b.win ? 0 : 1]
    // 숨쉬기가 멈춘 자리에서 찌그러진 채로 뛰지 않게 모양을 되돌린다
    winner.setScale(1)
    this.tweens.add({ targets: [winner, winnerBar], y: `-=${WIN_HOP}`, duration: 240, yoyo: true, repeat: 2, ease: 'Quad.easeOut' })
    // 승리 포즈: 뛰면서 좌우로 살랑 흔들고, 머리 위에서 별이 터진다
    this.tweens.add({ targets: winner, angle: { from: -7, to: 7 }, duration: 240, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => winner.setAngle(0) })
    if (b.win) this.burst(winner.x, winner.y - 70, 12)
    host?.setAttribute('data-winner', b.win ? 'mascot' : 'monster')
    playSound(b.win ? 'win' : 'lose')
    b.onEnd(b.win)
  }

  /** 쓰러진 몬스터가 사라진 자리에 남는 하얀 연기 방울 */
  private puff(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (Math.PI * i) / 5
      const ball = this.add.circle(x + Math.cos(a) * 14, y + 10, Phaser.Math.Between(7, 11), 0xffffff).setAlpha(0.9)
      this.tweens.add({
        targets: ball,
        x: x + Math.cos(a) * 34,
        y: y + 10 + Math.sin(a) * 22,
        scale: { from: 0.6, to: 1.3 },
        alpha: 0,
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () => ball.destroy(),
      })
    }
  }

  /** 맞은 쪽 HP 막대 바로 위에서 숫자·글자가 떠오르며 사라진다(막대를 가리지 않게) */
  private floatText(x: number, text: string, color: string, barTop: number, size = 20) {
    const t = this.add
      .text(x, 0, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 })
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

  /**
   * 두 캐릭터 머리 위의 둥근 HP 바. 깎이면 앞 막대는 바로 줄고,
   * 뒤의 옅은 막대가 잠깐 남았다가 천천히 따라 줄어 얼마나 깎였는지 보인다
   */
  private drawBars(playerHp: number, enemyHp: number) {
    const b = this.battle
    if (!b) return
    const next: [number, number] = [playerHp, enemyHp]
    for (const i of [0, 1] as const) {
      if (next[i] >= b.hp[i]) {
        if (next[i] > b.trail[i]) b.trail[i] = next[i]
        continue
      }
      // 앞 막대가 줄어든 만큼 옅은 막대가 따라간다(따라가는 중에 또 깎이면 지금 자리에서 다시 따라간다)
      b.trailTween[i]?.stop()
      const { wait, duration } = hpTrail(b.trail[i] - next[i])
      b.trailTween[i] = this.tweens.addCounter({
        from: b.trail[i],
        to: next[i],
        delay: wait,
        duration,
        ease: 'Quad.easeIn',
        onUpdate: (tw) => {
          if (this.battle !== b) return
          b.trail[i] = tw.getValue() ?? next[i]
          this.paintBars()
        },
      })
    }
    b.hp = next
    this.paintBars()
  }

  private paintBars() {
    const b = this.battle
    if (!b) return
    const bar = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, ratio: number, trail: number, color: number, pale: number) => {
      g.clear()
      g.fillStyle(0xffffff).fillRoundedRect(cx - BAR_W / 2 - 3, cy - 3, BAR_W + 6, 16, 8)
      g.fillStyle(0xf3e3d3).fillRoundedRect(cx - BAR_W / 2, cy, BAR_W, 10, 5)
      if (trail > ratio) g.fillStyle(pale).fillRoundedRect(cx - BAR_W / 2, cy, Math.max(10, BAR_W * trail), 10, 5)
      if (ratio > 0) g.fillStyle(color).fillRoundedRect(cx - BAR_W / 2, cy, Math.max(10, BAR_W * ratio), 10, 5)
    }
    const { width: w, height: h } = this.scale
    bar(b.bars[0], w * 0.3, this.mascotBarY(h), b.hp[0], b.trail[0], HP_PLAYER, HP_PLAYER_TRAIL)
    bar(b.bars[1], w * 0.72, this.monsterBarY(h), b.hp[1], b.trail[1], HP_ENEMY, HP_ENEMY_TRAIL)
    // e2e가 앞 막대와 옅은 막대가 어디까지 왔는지 볼 수 있게 남긴다
    const host = this.game.canvas.parentElement
    host?.setAttribute('data-hp', b.hp.map((v) => v.toFixed(2)).join(' '))
    host?.setAttribute('data-hp-trail', b.trail.map((v) => v.toFixed(2)).join(' '))
  }

  /**
   * 말랑이 HP 막대 위쪽 y. 자란 말랑이 머리(모자)끝보다 위로 올린다.
   * 아기 말랑이는 어떤 모자를 써도 몬스터 막대와 같은 높이다(머리끝 -58, 막대 아래끝 -59)
   */
  private mascotBarY(h: number): number {
    return Math.min(barY(h), groundY(h) + Math.floor(grownTop(this.look.hat, this.growth.scale)) - 14)
  }

  /** 몬스터 HP 막대 위쪽 y. 커진 보스는 머리가 닿지 않게 올린다 */
  private monsterBarY(h: number): number {
    return barY(h) - (this.monsterBoss ? BOSS_BAR_RAISE : 0)
  }

  /** 지금 몬스터의 머리끝(보스는 커진 만큼) */
  private monsterTop(): number {
    return monsterTop({ shape: this.monsterShape, boss: this.monsterBoss })
  }

  private layout(w: number, h: number) {
    const ground = groundY(h)
    this.mascot.setPosition(w * 0.3, ground)
    this.monster.setPosition(w * 0.72, ground + 6)
    const prop = this.placeProp(w, ground)
    // 나무·풀은 말랑이(자란 몸 포함)·몬스터(커진 보스 포함)·소품 칸을 비켜 선다
    const feet = ground + FEET + 4
    const body = 50 * this.growth.scale + 6
    const keepOut: Box[] = [
      { x0: w * 0.3 - body, x1: w * 0.3 + body, y0: 0, y1: feet },
      { x0: w * 0.72 - 64, x1: w * 0.72 + 64, y0: 0, y1: feet },
      prop,
    ]
    const fill = drawScenery(this.scenery, this.backdrop, w, h, keepOut)
    // e2e가 지금 그린 장식과 채우기 수를 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-decor', this.backdrop.decor)
    this.game.canvas.parentElement?.setAttribute('data-fill', fill)
    this.bubble.setPosition(w / 2, Math.max(28, h * 0.16))
    this.placeTaps()
    // e2e가 말랑이·몬스터 발끝(장면 위에서부터 px)을 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-feet', String(Math.round(ground + FEET)))
    if (this.battle) this.drawBars(...this.battle.hp)
    this.battle?.intro?.dim.setSize(w, h)
  }

  /** e2e가 말랑이·몬스터가 실제로 그려진 아래끝(장면 위에서부터 px)을 볼 수 있게 남긴다 */
  update() {
    const box = this.game.canvas.parentElement
    if (!box) return
    const mascot = String(Math.round(this.mascot.y + this.mascotBody.y + this.mascotGrow.y + FEET * this.growth.scale))
    const monster = String(Math.round(this.monster.y + this.monsterBody.y + MONSTER_BOTTOM * this.monsterBody.scaleY))
    if (box.getAttribute('data-mascot-bottom') !== mascot) box.setAttribute('data-mascot-bottom', mascot)
    if (box.getAttribute('data-monster-bottom') !== monster) box.setAttribute('data-monster-bottom', monster)
    this.trackWinnerHop(box)
    this.updateFace(box)
  }

  /** 상황에 맞는 표정을 고르고, 몇 초마다 눈을 깜빡인다. 표정이 바뀔 때만 얼굴을 다시 그린다 */
  private updateFace(box: HTMLElement) {
    this.updateMonsterFace(box)
    if (!this.face) return
    const now = this.time.now
    if (now >= this.nextBlinkAt) {
      this.blinkUntil = now + BLINK_MS
      this.nextBlinkAt = now + blinkGap(this.blinks++)
    }
    const base = this.battle ? (this.battleFace ?? 'focus') : moodFace(this.mood, this.growth.traits)
    const face = pickFace(base, { now, happyUntil: this.happyUntil, blinkUntil: this.blinkUntil })
    if (face === this.shownFace) return
    this.shownFace = face
    drawFace(this.face.clear(), face)
    // e2e가 지금 표정과 깜빡인 횟수를 볼 수 있게 남긴다
    box.setAttribute('data-face', face)
    if (face === 'blink') box.setAttribute('data-blinks', String(Number(box.getAttribute('data-blinks') ?? 0) + 1))
  }

  /** 몬스터 표정을 고른다. 전투가 아니면 기본 표정이다 */
  private updateMonsterFace(box: HTMLElement) {
    if (!this.monsterFaceG) return
    const face = this.battle ? this.monsterFace : 'idle'
    if (face === this.shownMonsterFace) return
    this.shownMonsterFace = face
    drawMonsterFace(this.monsterFaceG.clear(), this.monsterShape, face)
    // e2e가 지금 몬스터 표정을 볼 수 있게 남긴다
    box.setAttribute('data-monster-face', face)
  }

  /** e2e가 이긴 쪽이 뛰는 동안 머리끝·HP 막대 자리(장면 위에서부터 px)를 볼 수 있게 남긴다 */
  private trackWinnerHop(box: HTMLElement) {
    const b = this.battle
    if (!b?.ended) return
    const winner = b.win ? this.mascot : this.monster
    const bar = b.bars[b.win ? 0 : 1]
    const headTop = b.win ? grownTop(this.look.hat, this.growth.scale) : this.monsterTop()
    const rest = groundY(this.scale.height) + (b.win ? 0 : 6) + headTop
    const top = winner.y + winner.scaleY * headTop
    // 막대 바깥 흰 테두리 위끝과 아래끝
    const barTop = (b.win ? this.mascotBarY(this.scale.height) : this.monsterBarY(this.scale.height)) - 3 + bar.y
    b.lift = Math.min(b.lift ?? top - rest, top - rest)
    b.gap = Math.min(b.gap ?? Infinity, top - (barTop + 16))
    b.barPeak = Math.min(b.barPeak ?? barTop, barTop)
    box.setAttribute('data-winner-rest', String(Math.round(rest)))
    box.setAttribute('data-winner-peak', String(Math.round(rest + b.lift)))
    box.setAttribute('data-hop-gap', String(Math.round(b.gap)))
    box.setAttribute('data-bar-peak-top', String(Math.round(b.barPeak)))
  }
}
