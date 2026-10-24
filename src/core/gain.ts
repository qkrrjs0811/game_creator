import { computeProgress } from './progression'
import { stopSession } from './session'
import type { SaveData, StatId } from './types'

export interface SessionGain {
  /** 이번에 타이머를 켜 둔 분(하루 상한과 상관없이) */
  minutes: number
  /** 이번에 늘어난 경험치(하루 상한 적용) */
  exp: number
  stats: Record<StatId, number>
}

/** 진행 중인 운동을 now 에 그만두면 얻는 것. 그만두기 전후의 computeProgress 차이다. 진행 중이 아니면 null */
export function sessionGain(save: SaveData, now: number): SessionGain | null {
  if (!save.active) return null
  const before = computeProgress(save.records)
  const after = computeProgress(stopSession(save, now).records)
  const stats = Object.fromEntries(
    (Object.keys(before.stats) as StatId[]).map((id) => [id, after.stats[id] - before.stats[id]]),
  ) as Record<StatId, number>
  return {
    minutes: Math.floor(Math.max(0, now - save.active.startedAt) / 60_000),
    exp: after.exp - before.exp,
    stats,
  }
}
