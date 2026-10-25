import { stampCount } from './goal'
import { computeProgress } from './progression'
import { liveRecords } from './session'
import type { ActivityId, ActivityRecord, SaveData, StatId } from './types'

/** 기록을 until 시각까지만 남긴다(그 뒤에 시작한 기록은 빼고, 걸친 기록은 자른다) */
export function recordsUntil(records: ActivityRecord[], until: number): ActivityRecord[] {
  return records
    .filter((r) => r.startedAt < until)
    .map((r) => (r.endedAt > until ? { ...r, endedAt: until } : r))
}

export interface AwaySummary {
  /** 마지막으로 본 뒤 흐른 시간(ms) */
  awayMs: number
  /** 그 사이 늘어난 활동별 인정 분(하루 상한 적용) */
  minutes: Record<ActivityId, number>
  exp: number
  stats: Record<StatId, number>
  levelBefore: number
  levelAfter: number
  stampsBefore: number
  stampsAfter: number
  /** 경험치나 도장이 늘었는지 */
  gained: boolean
}

/**
 * 마지막으로 본 시각(lastSeen)과 now 사이에 기록·켜 둔 타이머로 늘어난 것.
 * lastSeen 때의 기록과 now 때의 기록으로 각각 계산한 차이라, 상한을 넘긴 시간은 세지 않는다. 기록만 읽는다.
 */
export function awaySummary(save: SaveData, lastSeen: number, now: number): AwaySummary {
  const seen = Math.min(lastSeen, now)
  const beforeRecords = recordsUntil(liveRecords(save, seen), seen)
  const afterRecords = liveRecords(save, now)
  const before = computeProgress(beforeRecords)
  const after = computeProgress(afterRecords)
  const minutes = Object.fromEntries(
    (Object.keys(before.creditedMinutes) as ActivityId[]).map((id) => [id, after.creditedMinutes[id] - before.creditedMinutes[id]]),
  ) as Record<ActivityId, number>
  const stats = Object.fromEntries(
    (Object.keys(before.stats) as StatId[]).map((id) => [id, after.stats[id] - before.stats[id]]),
  ) as Record<StatId, number>
  const stampsBefore = stampCount(beforeRecords)
  const stampsAfter = stampCount(afterRecords)
  const exp = after.exp - before.exp
  return {
    awayMs: Math.max(0, now - lastSeen),
    minutes,
    exp,
    stats,
    levelBefore: before.level,
    levelAfter: after.level,
    stampsBefore,
    stampsAfter,
    gained: exp > 0 || stampsAfter > stampsBefore,
  }
}
