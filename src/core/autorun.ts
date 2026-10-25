import { playerFighter, simulateBattle, type BattleResult } from './battle'
import { stageEnemy } from './endless'
import { applyBattleResult } from './result'
import type { Cosmetic } from './cosmetics'
import type { SaveData, StatId } from './types'

/** 자동 진행 한 번에 싸우는 최대 판 수 */
export const AUTO_RUN_MAX = 10

/** 자동 진행은 스테이지마다 정해진 씨앗으로 싸운다(같은 조건이면 언제나 같은 결과) */
export function autoRunSeed(no: number): number {
  return no
}

export interface AutoRunBattle {
  no: number
  win: boolean
  result: BattleResult
}

export interface AutoRun {
  /** 바뀐 저장. 바뀌는 건 깬 스테이지 수와 꾸미기뿐이다 */
  save: SaveData
  /** 판마다 결과(스테이지 번호 차례대로) */
  battles: AutoRunBattle[]
  /** 시작 전 깬 스테이지 수 */
  from: number
  /** 끝난 뒤 깬 스테이지 수 */
  to: number
  /** 새로 얻은 꾸미기(장 모자 등) */
  rewards: Cosmetic[]
  /** 진 스테이지 번호. 최대 판 수까지 다 이겼으면 null */
  stoppedAt: number | null
}

/**
 * 다음 스테이지부터 자동 전투를 줄줄이 이어 하다가 처음 지는 곳이나 max판에서 멈춘다.
 * 전투로는 강해지지 않는다: 능력치는 받은 그대로 쓰고, 저장은 깬 스테이지 수와 꾸미기만 바뀐다(applyBattleResult)
 */
export function autoRun(save: SaveData, stats: Record<StatId, number>, skills: string[], max = AUTO_RUN_MAX): AutoRun {
  const me = playerFighter(stats, skills)
  const from = save.stageProgress
  const battles: AutoRunBattle[] = []
  const rewards: Cosmetic[] = []
  let cur = save
  let stoppedAt: number | null = null
  while (battles.length < max) {
    const no = cur.stageProgress + 1
    const result = simulateBattle(me, stageEnemy(no), autoRunSeed(no))
    battles.push({ no, win: result.win, result })
    if (!result.win) {
      stoppedAt = no
      break
    }
    const outcome = applyBattleResult(cur, no, true)
    cur = outcome.save
    if (outcome.reward && !save.cosmetics.includes(outcome.reward.id)) rewards.push(outcome.reward)
  }
  return { save: cur, battles, from, to: cur.stageProgress, rewards, stoppedAt }
}
