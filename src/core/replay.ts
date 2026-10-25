import type { BattleEvent, BattleResult, Fighter } from './battle'

/** 장면 한 걸음. HP는 처음 HP에 대한 비율(0~1) */
export interface ReplayStep extends BattleEvent {
  playerHp: number
  enemyHp: number
}

export interface Timeline {
  win: boolean
  steps: ReplayStep[]
}

/** 전투 기록을 장면이 그대로 재생할 수 있게 걸음마다 양쪽 HP 비율을 붙인다 */
export function battleTimeline(player: Fighter, enemy: Fighter, result: BattleResult): Timeline {
  const max = { player: Math.max(1, player.hp), enemy: Math.max(1, enemy.hp) }
  const ratio = { player: 1, enemy: 1 }
  const steps = result.log.map((e) => {
    const target = e.actor === 'player' ? 'enemy' : 'player'
    ratio[target] = Math.min(1, Math.max(0, e.targetHp / max[target]))
    return { ...e, playerHp: ratio.player, enemyHp: ratio.enemy }
  })
  return { win: result.win, steps }
}

/** 걸음 사이 시간(ms). 짧은 전투는 천천히 보여 주고, 긴 전투도 10초 안쪽으로 줄인다 */
export function stepDelay(stepCount: number): number {
  return Math.round(Math.min(800, Math.max(350, 9000 / Math.max(1, stepCount))))
}

/** 자동 진행의 걸음 사이 시간(ms). 여러 판을 이어 보여 주므로 한 판보다 빠르게 한다 */
export function autoStepDelay(stepCount: number): number {
  return Math.round(Math.min(400, Math.max(250, 1600 / Math.max(1, stepCount))))
}

/** 자동 진행에서 한 판이 끝난 뒤 다음 판을 시작하기까지 쉬는 시간(ms). 이긴 폴짝을 잠깐 보여 준다 */
export const AUTO_RUN_GAP = 700
