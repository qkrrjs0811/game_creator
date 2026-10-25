import type { Monster } from './monsters'
import { MONSTER_TOP } from './monsterLook'
import { ATTACK_CEILING, MONSTER_BOTTOM } from './monsterMotion'

/** 보스가 두르는 것: 왕관(원래 모양)·망토·후광 */
export type BossDecor = 'crown' | 'cape' | 'halo'

/** 보스는 이만큼 크게 그린다(발끝을 땅에 둔 채 키운다) */
export const BOSS_SCALE = 1.15
/** 커진 보스 머리가 막대에 닿지 않게 보스 HP 막대를 올리는 높이(px) */
export const BOSS_BAR_RAISE = 12

/** 몸 뒤의 후광(몸 그림 기준 가운데 y, 가로·세로 반지름). 머리끝보다 위로 나가지 않는다 */
export const BOSS_HALO = { y: -12, rx: 56, ry: 38 }
/** 몸 뒤의 망토(어깨 y, 땅 쪽 끝 y, 아래쪽 반너비). 몸보다 넓게 퍼져 양옆으로 보인다 */
export const BOSS_CAPE = { top: -16, bottom: 24, halfWidth: 60 }

export function bossLook(m: Pick<Monster, 'boss'>): BossDecor[] {
  return m.boss ? ['crown', 'cape', 'halo'] : []
}

export function monsterScale(m: Pick<Monster, 'boss'>): number {
  return m.boss ? BOSS_SCALE : 1
}

/** 커진 만큼을 친 머리끝 y. 발끝(MONSTER_BOTTOM)을 기준으로 키운다 */
export function monsterTop(m: Pick<Monster, 'boss' | 'shape'>): number {
  const s = monsterScale(m)
  return s === 1 ? MONSTER_TOP[m.shape] : MONSTER_BOTTOM - (MONSTER_BOTTOM - MONSTER_TOP[m.shape]) * s
}

/** 몬스터 HP 막대 아래끝 바로 밑(몸 그림 기준). 보스는 막대를 올린 만큼 높다 */
export function monsterCeiling(m: Pick<Monster, 'boss'>): number {
  return ATTACK_CEILING - (m.boss ? BOSS_BAR_RAISE : 0)
}
