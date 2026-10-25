import type { Monster } from './monsters'

/**
 * 보스 전투를 시작할 때의 등장 연출 시간표(ms, 전투 시작부터). 그림만 정하고 전투 결과·성장 값은 바꾸지 않는다.
 * 순서: 화면이 어두워짐(dim) → 보스가 위에서 쿵 하고 내려옴(drop) → 땅에 닿으며 이름표가 뜸(hold 동안) → 밝아짐(fade).
 * 첫 걸음은 total이 지난 뒤에 온다
 */
export interface BossEntrance {
  dim: number
  /** 어둡게 덮는 막의 진하기. 캐릭터가 보일 만큼만 어둡다 */
  dimAlpha: number
  dropAt: number
  drop: number
  landAt: number
  /** 땅에 닿을 때 화면 흔들림 시간(ms)과 세기(px) */
  shake: number
  shakePx: number
  tagAt: number
  hold: number
  fadeAt: number
  fade: number
  total: number
}

/** 걸음 사이가 이만큼이면 연출을 줄이지 않는다 */
const FULL_SPEED_DELAY = 600
/** 빠른 자동 진행에서도 이 배율 아래로 빨라지지 않는다 */
const MIN_SPEED = 0.5

export function bossEntrance(m: Pick<Monster, 'boss'>, delay: number): BossEntrance | null {
  if (!m.boss) return null
  const f = Math.min(1, Math.max(MIN_SPEED, delay / FULL_SPEED_DELAY))
  const dim = Math.round(250 * f)
  const drop = Math.round(420 * f)
  const hold = Math.round(900 * f)
  const fade = Math.round(300 * f)
  const dropAt = dim
  const landAt = dropAt + drop
  const fadeAt = landAt + hold
  return {
    dim,
    dimAlpha: 0.32,
    dropAt,
    drop,
    landAt,
    shake: 220,
    shakePx: 6,
    tagAt: landAt,
    hold,
    fadeAt,
    fade,
    total: fadeAt + fade,
  }
}

/**
 * 떨어지기 전 몬스터 몸을 제자리에서 이만큼(위가 음수) 올려 둔다.
 * monsterY는 몬스터 발 자리 y(장면 위에서부터), top은 몸 기준 머리끝(음수). 머리끝까지 장면 위 밖에 숨는다
 */
export function bossDropOffset(monsterY: number, top: number): number {
  return -8 - monsterY - top
}

/** 보스가 내려오면 뜨는 이름표 */
export function bossNameTag(m: Pick<Monster, 'name'>): { title: string; name: string } {
  return { title: '보스 등장!', name: m.name }
}
