import { stampCount } from './goal'
import type { SaveData } from './types'
import { doneWeeks } from './week'

export type CosmeticKind = 'hat' | 'color'

export type HatShape = 'cone' | 'beret' | 'flower' | 'star'
export type HatPattern = 'plain' | 'dots' | 'stripes'

/** 장 모자의 모습. 장면이 이대로 그린다 */
export interface HatLook {
  shape: HatShape
  /** 파스텔 색(#rrggbb) */
  color: string
  pattern: HatPattern
}

export interface Cosmetic {
  id: string
  name: string
  icon: string
  kind: CosmeticKind
  /** 처음 깨면 이 꾸미기를 주는 스테이지(도장 모자는 없음) */
  stage?: number
  /** 도장(하루 목표를 채운 날)을 이만큼 모으면 얻는 꾸미기 */
  stamps?: number
  /** 주간 목표(한 주에 도장 5일)를 이만큼 채우면 얻는 꾸미기 */
  weeks?: number
  /** 장 보스가 주는 모자면 그 장 번호와 모습 */
  chapter?: number
  hat?: HatLook
}

/** 스테이지마다 하나씩 주는 꾸미기. 모양만 바뀌고 능력치에는 영향이 없다 */
export const COSMETICS: Cosmetic[] = [
  { id: 'hat-sprout', name: '새싹 머리핀', icon: '🌱', kind: 'hat', stage: 1 },
  { id: 'hat-mushroom', name: '버섯 모자', icon: '🍄', kind: 'hat', stage: 2 },
  { id: 'color-sky', name: '하늘색 말랑', icon: '💧', kind: 'color', stage: 3 },
  { id: 'color-cotton', name: '솜사탕 분홍', icon: '🩷', kind: 'color', stage: 4 },
  { id: 'hat-ribbon', name: '노을 리본', icon: '🎀', kind: 'hat', stage: 5 },
  { id: 'hat-crown', name: '꼬마 왕관', icon: '👑', kind: 'hat', stage: 6 },
]

/** 도장을 모으면 주는 모자. 활동 기록에서 센 도장 수로 정해져 저장에는 남기지 않는다 */
export const STAMP_COSMETICS: Cosmetic[] = [
  { id: 'hat-stamp7', name: '반짝 도장 별핀', icon: '🌟', kind: 'hat', stamps: 7 },
  { id: 'hat-stamp30', name: '무지개 머리띠', icon: '🌈', kind: 'hat', stamps: 30 },
  { id: 'hat-stamp100', name: '도장왕 꽃왕관', icon: '💮', kind: 'hat', stamps: 100 },
]

/** 주간 목표를 채운 주가 모이면 주는 몸 색. 활동 기록에서 센 주 수로 정해져 저장에는 남기지 않는다 */
export const WEEK_COSMETICS: Cosmetic[] = [
  { id: 'color-week1', name: '레몬 말랑', icon: '🍋', kind: 'color', weeks: 1 },
  { id: 'color-week4', name: '민트 말랑', icon: '🌿', kind: 'color', weeks: 4 },
  { id: 'color-week12', name: '라벤더 말랑', icon: '🔮', kind: 'color', weeks: 12 },
]

const HAT_SHAPES: { shape: HatShape; name: string; icon: string }[] = [
  { shape: 'cone', name: '고깔모자', icon: '🥳' },
  { shape: 'beret', name: '베레모', icon: '🎨' },
  { shape: 'flower', name: '꽃핀', icon: '🌼' },
  { shape: 'star', name: '별핀', icon: '⭐' },
]
const HAT_COLORS = [
  { color: '#ffa3b8', name: '딸기' },
  { color: '#ffe07a', name: '레몬' },
  { color: '#93dcc0', name: '민트' },
  { color: '#c7b1f2', name: '라벤더' },
  { color: '#9fd0f7', name: '하늘' },
]
const HAT_PATTERNS: { pattern: HatPattern; name: string }[] = [
  { pattern: 'plain', name: '' },
  { pattern: 'dots', name: '물방울 ' },
  { pattern: 'stripes', name: '줄무늬 ' },
]
const STAGES_PER_CHAPTER = 10

/**
 * 장 보스를 처음 깨면 받는 그 장의 모자. 모양 4 · 색 5 · 무늬 3을 장마다 하나씩 돌려
 * 앞쪽 60장은 모두 다른 모습이고, 그 뒤로도 끝없이 만든다.
 */
export function chapterCosmetic(chapter: number): Cosmetic | null {
  if (!Number.isInteger(chapter) || chapter < 1) return null
  const i = chapter - 1
  const s = HAT_SHAPES[i % HAT_SHAPES.length]
  const c = HAT_COLORS[i % HAT_COLORS.length]
  const p = HAT_PATTERNS[i % HAT_PATTERNS.length]
  return {
    id: `hat-ch${chapter}`,
    name: `${p.name}${c.name} ${s.name}`,
    icon: s.icon,
    kind: 'hat',
    stage: chapter * STAGES_PER_CHAPTER,
    chapter,
    hat: { shape: s.shape, color: c.color, pattern: p.pattern },
  }
}

export function stageReward(no: number): Cosmetic | null {
  const first = COSMETICS.find((c) => c.stage === no)
  if (first) return first
  return Number.isInteger(no) && no % STAGES_PER_CHAPTER === 0 ? chapterCosmetic(no / STAGES_PER_CHAPTER) : null
}

/** 이름으로 꾸미기를 찾는다. 장 모자는 "hat-ch<장>"이다 */
export function cosmeticById(id: string): Cosmetic | null {
  const first = [...COSMETICS, ...STAMP_COSMETICS, ...WEEK_COSMETICS].find((c) => c.id === id)
  if (first) return first
  const m = /^hat-ch([1-9]\d*)$/.exec(id)
  return m ? chapterCosmetic(Number(m[1])) : null
}

/**
 * 가진 꾸미기. 저장된 이름에 더해, 보상이 생기기 전에 깬 스테이지의 꾸미기도 가진 것으로 본다.
 * 도장 모자·주간 색은 기록에서 센 도장 수·채운 주 수로만 정한다. 모르는 이름은 건너뛰고(지우지는 않음) 목록 순서로 돌려준다.
 */
export function ownedCosmetics(save: SaveData): Cosmetic[] {
  const stamps = stampCount(save.records)
  const weeks = doneWeeks(save.records)
  const owns = (c: Cosmetic) =>
    c.stamps !== undefined
      ? stamps >= c.stamps
      : c.weeks !== undefined
        ? weeks >= c.weeks
        : save.cosmetics.includes(c.id) || (c.stage ?? Infinity) <= save.stageProgress
  return cosmeticCatalog(save).filter(owns)
}

/**
 * 꾸미기 창에 보여 줄 목록: 처음 꾸미기, 도장 모자, 주간 색, 깬 장 보스의 모자와 다음 장 모자 하나,
 * 그리고 저장에만 있는 더 뒤 장 모자(백업에서 왔을 때)를 장 순서로.
 */
export function cosmeticCatalog(save: SaveData): Cosmetic[] {
  const cleared = Math.max(0, Math.floor(save.stageProgress / STAGES_PER_CHAPTER))
  const chapters = new Set(Array.from({ length: cleared + 1 }, (_, i) => i + 1))
  for (const id of save.cosmetics) {
    const ch = cosmeticById(id)?.chapter
    if (ch) chapters.add(ch)
  }
  return [...COSMETICS, ...STAMP_COSMETICS, ...WEEK_COSMETICS, ...[...chapters].sort((a, b) => a - b).map((ch) => chapterCosmetic(ch)!)]
}

export type Worn = Record<CosmeticKind, Cosmetic | null>

/** 지금 입은 모자와 색. 가지지 않았거나 모르는 이름은 입지 않은 것으로 본다 */
export function wornCosmetics(save: SaveData): Worn {
  const owned = ownedCosmetics(save)
  const pick = (kind: CosmeticKind) =>
    save.worn.map((id) => owned.find((c) => c.id === id && c.kind === kind)).find((c) => c !== undefined) ?? null
  return { hat: pick('hat'), color: pick('color') }
}

/** 가진 꾸미기를 입는다. 같은 종류는 하나만 입고, 입은 것을 다시 고르면 벗는다. 입는 것 말고는 바꾸지 않는다 */
export function toggleWear(save: SaveData, id: string): SaveData {
  const c = ownedCosmetics(save).find((x) => x.id === id)
  if (!c) return save
  if (save.worn.includes(id)) return { ...save, worn: save.worn.filter((x) => x !== id) }
  return { ...save, worn: [...save.worn.filter((x) => cosmeticById(x)?.kind !== c.kind), id] }
}
