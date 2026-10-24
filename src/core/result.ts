import { STAGES, isStageOpen } from './stages'
import { stageReward, type Cosmetic } from './cosmetics'
import type { SaveData } from './types'

export interface BattleOutcome {
  save: SaveData
  /** 이번에 처음 깼는지 */
  firstClear: boolean
  /** 이번에 새로 열린 스테이지 번호 */
  unlocked: number | null
  /** 이번에 마지막(보스)까지 모두 깼는지 */
  allCleared: boolean
  /** 처음 깨서 받은 꾸미기 */
  reward: Cosmetic | null
}

/**
 * 전투 결과를 저장에 반영한다. 바뀌는 건 깬 스테이지 수와 꾸미기뿐이다(전투로는 강해지지 않는다).
 * 지거나 이미 깬 곳을 다시 이기면 저장을 그대로 돌려준다.
 */
export function applyBattleResult(save: SaveData, no: number, win: boolean): BattleOutcome {
  const same = { save, firstClear: false, unlocked: null, allCleared: false, reward: null }
  if (!win || !Number.isInteger(no) || !isStageOpen(save.stageProgress, no) || no <= save.stageProgress) return same
  const reward = stageReward(no)
  const cosmetics = reward && !save.cosmetics.includes(reward.id) ? [...save.cosmetics, reward.id] : save.cosmetics
  return {
    save: { ...save, stageProgress: no, cosmetics },
    firstClear: true,
    unlocked: no < STAGES.length ? no + 1 : null,
    allCleared: no === STAGES.length,
    reward,
  }
}
