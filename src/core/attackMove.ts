import type { BattleEvent } from './battle'

/**
 * 말랑이 기본 공격 동작. 그림만 정하고 전투 결과·성장 값은 바꾸지 않는다.
 * tackle: 몸통으로 들이받기, hop: 높이 뛰어 내려찍기, spin: 빙글 돌며 돌진
 */
export type PlayerMove = 'tackle' | 'hop' | 'spin'

/** 동작 이름(e2e·기록용) */
export const PLAYER_MOVE: Record<PlayerMove, string> = {
  tackle: '몸통 박치기',
  hop: '점프 찍기',
  spin: '회전 돌진',
}

/** 말랑이가 돌아가며 쓰는 순서 */
const ROTATION: PlayerMove[] = ['tackle', 'hop', 'spin']

/** 이만큼 연속으로 맞히면 콤보 글자를 띄운다 */
export const COMBO_FROM = 3

export interface StepMove {
  /** 이 걸음에 말랑이가 쓰는 동작. 몬스터 차례면 null */
  move: PlayerMove | null
  /** 말랑이가 이 걸음까지 연속으로 맞힌 수. 몬스터 차례나 빗나가면 0 */
  combo: number
}

/**
 * 전투 기록 걸음마다 말랑이의 공격 동작과 연속 명중 수. 공격할 때마다 박치기 → 점프 찍기 → 회전 돌진을 돌아가고,
 * 치명타는 늘 점프 찍기로 크게 내려찍는다. 몬스터 차례는 연속을 끊지 않고, 말랑이가 빗나가면 끊긴다
 */
export function playerMoves(steps: Pick<BattleEvent, 'actor' | 'kind' | 'crit'>[]): StepMove[] {
  let attacks = 0
  let streak = 0
  return steps.map((s) => {
    if (s.actor !== 'player') return { move: null, combo: 0 }
    const move = s.kind === 'hit' && s.crit ? 'hop' : ROTATION[attacks % ROTATION.length]
    attacks++
    streak = s.kind === 'hit' ? streak + 1 : 0
    return { move, combo: streak }
  })
}

/** 연속 명중 글자. COMBO_FROM 번째부터만 보인다 */
export function comboText(combo: number): string | null {
  return combo >= COMBO_FROM ? `${combo} 콤보!` : null
}
