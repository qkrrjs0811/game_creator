import type { BattleEvent } from './battle'
import type { MonsterShape } from './monsters'

/**
 * 몬스터 공격 연출. 몬스터가 말랑이를 맞히면 그 종의 조각(잎사귀·물방울·돌 조각 등)이 몬스터 색으로 튀고,
 * 보스는 큰 공격에 화면이 흔들린다. 그림만 정하고 전투 결과·성장 값은 바꾸지 않는다
 */
export type MonsterBit = 'leaf' | 'spore' | 'droplet' | 'puff' | 'pebble' | 'gem'

export const MONSTER_BIT: Record<MonsterShape, MonsterBit> = {
  slime: 'leaf',
  mushroom: 'spore',
  drop: 'droplet',
  cloud: 'puff',
  rock: 'pebble',
  king: 'gem',
}

/** 보스 큰 공격 때 뜨는 글자 */
export const BOSS_SLAM_TEXT = '쿵!'

/** 보스는 맞힌 공격 중 이만큼마다(첫 번째부터) 큰 공격을 한다 */
const SLAM_EVERY = 3

export interface MonsterHit {
  bit: MonsterBit
  /** 튀는 조각 수 */
  count: number
  /** 보스 큰 공격인지 */
  big: boolean
  /** 화면 흔들림 시간(ms)과 세기(px). 보스 큰 공격만 */
  shake: number
  shakePx: number
  text: string | null
}

/** 전투 기록 걸음마다 몬스터가 맞힐 때의 연출(맞히지 않으면 null) */
export function monsterHits(steps: Pick<BattleEvent, 'actor' | 'kind' | 'crit'>[], shape: MonsterShape, boss: boolean): (MonsterHit | null)[] {
  const bit = MONSTER_BIT[shape]
  let hits = 0
  return steps.map((s) => {
    if (s.actor !== 'enemy' || s.kind !== 'hit') return null
    const big = boss && (hits % SLAM_EVERY === 0 || !!s.crit)
    hits++
    if (big) return { bit, count: 12, big, shake: 240, shakePx: 7, text: BOSS_SLAM_TEXT }
    return { bit, count: s.crit ? 9 : 6, big, shake: 0, shakePx: 0, text: null }
  })
}
