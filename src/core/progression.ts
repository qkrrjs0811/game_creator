import { ACTIVITIES } from './activities'
import type { ActivityId, ActivityRecord, Progress, StatId } from './types'

export const EXP_PER_MINUTE = 10
export const BASE_STAT = 5

const MINUTE = 60_000

/** level 에서 다음 레벨로 가는 데 필요한 경험치 */
export function expToNext(level: number): number {
  return 100 + 50 * (level - 1)
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function nextLocalMidnight(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
}

/** 활동 시간을 로컬 날짜별 ms 로 나눈다 */
function msByDay(records: ActivityRecord[], activity: ActivityId): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const r of records) {
    if (r.activity !== activity) continue
    const end = Math.max(r.startedAt, r.endedAt)
    let t = r.startedAt
    while (t < end) {
      const cut = Math.min(end, nextLocalMidnight(t))
      const key = dayKey(t)
      byDay.set(key, (byDay.get(key) ?? 0) + (cut - t))
      t = cut
    }
  }
  return byDay
}

/** 로컬 날짜별로 나눠 하루 상한을 적용한 인정 분 */
export function creditedMinutes(records: ActivityRecord[], activity: ActivityId): number {
  // 상한은 날짜별로, 내림은 합계에 한 번만 한다(자정을 걸친 세션이 분을 잃지 않게)
  const capMs = ACTIVITIES[activity].dailyCapMinutes * MINUTE
  let totalMs = 0
  for (const ms of msByDay(records, activity).values()) totalMs += Math.min(ms, capMs)
  return Math.floor(totalMs / MINUTE)
}

export interface TodayStatus {
  minutes: number
  cap: number
  reached: boolean
}

/** now 가 속한 로컬 날짜에 인정된 분(상한까지)과 상한 도달 여부 */
export function todayStatus(records: ActivityRecord[], activity: ActivityId, now: number): TodayStatus {
  const cap = ACTIVITIES[activity].dailyCapMinutes
  const ms = msByDay(records, activity).get(dayKey(now)) ?? 0
  const minutes = Math.min(cap, Math.floor(ms / MINUTE))
  return { minutes, cap, reached: minutes >= cap }
}

export function computeProgress(records: ActivityRecord[]): Progress {
  const ids = Object.keys(ACTIVITIES) as ActivityId[]
  const minutes = Object.fromEntries(ids.map((id) => [id, creditedMinutes(records, id)])) as Record<ActivityId, number>

  const stats: Record<StatId, number> = { str: BASE_STAT, vit: BASE_STAT, int: BASE_STAT }
  for (const stat of Object.keys(stats) as StatId[]) {
    const linked = ids.filter((id) => ACTIVITIES[id].stats.includes(stat)).reduce((sum, id) => sum + minutes[id], 0)
    stats[stat] += Math.floor(linked / 10)
  }

  const exp = ids.reduce((sum, id) => sum + minutes[id], 0) * EXP_PER_MINUTE
  let level = 1
  let rest = exp
  while (rest >= expToNext(level)) {
    rest -= expToNext(level)
    level++
  }

  return {
    creditedMinutes: minutes,
    exp,
    level,
    expIntoLevel: rest,
    expForNextLevel: expToNext(level),
    stats,
    skillPoints: level - 1,
  }
}
