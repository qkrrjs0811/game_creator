import type { SaveData } from './types'

export type CosmeticKind = 'hat' | 'color'

export interface Cosmetic {
  id: string
  name: string
  icon: string
  kind: CosmeticKind
  /** 처음 깨면 이 꾸미기를 주는 스테이지 */
  stage: number
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

export function stageReward(no: number): Cosmetic | null {
  return COSMETICS.find((c) => c.stage === no) ?? null
}

/**
 * 가진 꾸미기. 저장된 이름에 더해, 보상이 생기기 전에 깬 스테이지의 꾸미기도 가진 것으로 본다.
 * 모르는 이름은 건너뛰고(지우지는 않음) 목록 순서로 돌려준다.
 */
export function ownedCosmetics(save: SaveData): Cosmetic[] {
  return COSMETICS.filter((c) => save.cosmetics.includes(c.id) || c.stage <= save.stageProgress)
}
