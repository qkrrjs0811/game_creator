import { ACTIVITIES } from './activities'
import { goalDays } from './goal'
import { creditedMinutes, dayKey, msByDay } from './progression'
import { weekKey } from './week'
import type { ActivityId, ActivityRecord } from './types'

/** 기록 돌아보기: 활동 기록을 읽어 날짜별로 보여 줄 값만 계산한다. 경험치·능력치와는 상관없다 */

const MINUTE = 60_000
const IDS = Object.keys(ACTIVITIES) as ActivityId[]

const zero = (): Record<ActivityId, number> => ({ exercise: 0, study: 0, reading: 0, relax: 0 })

export interface DayMinutes {
  /** 활동마다 상한 안에서 인정된 분 */
  minutes: Record<ActivityId, number>
  /** 활동별 분의 합 */
  total: number
}

/** 로컬 날짜(YYYY-MM-DD)별·활동별 인정 분 */
export function dayMinutes(records: ActivityRecord[]): Map<string, DayMinutes> {
  const byDay = new Map<string, DayMinutes>()
  for (const id of IDS) {
    const capMs = ACTIVITIES[id].dailyCapMinutes * MINUTE
    for (const [key, ms] of msByDay(records, id)) {
      const day = byDay.get(key) ?? { minutes: zero(), total: 0 }
      const m = Math.floor(Math.min(ms, capMs) / MINUTE)
      day.minutes[id] += m
      day.total += m
      byDay.set(key, day)
    }
  }
  return byDay
}

export interface HistoryDay extends DayMinutes {
  /** YYYY-MM-DD */
  key: string
  /** 0 = 일요일 ~ 6 = 토요일 */
  weekday: number
  today: boolean
  /** 하루 목표를 채워 도장을 찍은 날 */
  stamped: boolean
}

/** end 가 속한 날까지 count 일(오래된 날부터). end 가 오늘이 아니면 today 는 모두 false */
export function recentDays(records: ActivityRecord[], end: number, count = 7, now = end): HistoryDay[] {
  const byDay = dayMinutes(records)
  const stamped = goalDays(records)
  const todayKey = dayKey(now)
  const e = new Date(end)
  const days: HistoryDay[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(e.getFullYear(), e.getMonth(), e.getDate() - i)
    const key = dayKey(d.getTime())
    const m = byDay.get(key)
    days.push({
      key,
      weekday: d.getDay(),
      today: key === todayKey,
      stamped: stamped.has(key),
      minutes: m ? { ...m.minutes } : zero(),
      total: m?.total ?? 0,
    })
  }
  return days
}

export interface HistoryPage {
  /** 0 = 오늘까지 최근 7일, 1 = 그 앞 7일, … (기록 범위 안으로 맞춘 값) */
  page: number
  days: HistoryDay[]
  /** 이 쪽보다 앞에 1분 이상 기록한 날이 있다 */
  hasOlder: boolean
  /** 이 쪽 뒤에 더 최근 쪽이 있다 */
  hasNewer: boolean
}

/** 막대를 앞뒤 주로 넘겨 볼 때의 7일 쪽. 가장 오래된 기록이 든 쪽보다 앞으로, 오늘 뒤로는 가지 않는다 */
export function historyPage(records: ActivityRecord[], now: number, page: number): HistoryPage {
  let first: string | null = null
  for (const [key, day] of dayMinutes(records)) if (day.total >= 1 && (!first || key < first)) first = key
  const n = new Date(now)
  const endOf = (p: number) => new Date(n.getFullYear(), n.getMonth(), n.getDate() - 7 * p)
  let maxPage = 0
  if (first) {
    const [y, m, d] = first.split('-').map(Number)
    const days = Math.round((endOf(0).getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000)
    maxPage = Math.max(0, Math.floor(days / 7))
  }
  const p = Math.min(maxPage, Math.max(0, Math.floor(page)))
  return { page: p, days: recentDays(records, endOf(p).getTime(), 7, now), hasOlder: p < maxPage, hasNewer: p > 0 }
}

export interface WeekTotals {
  /** 이번 주(월~오늘) 인정 분 */
  thisWeek: number
  /** 지난주(월~일) 인정 분 */
  lastWeek: number
  /** thisWeek - lastWeek */
  diff: number
}

/** now 가 속한 주와 그 앞 주의 합계 */
export function weekTotals(records: ActivityRecord[], now: number): WeekTotals {
  const thisKey = weekKey(now)
  const [y, m, d] = thisKey.split('-').map(Number)
  const lastKey = weekKey(new Date(y, m - 1, d - 7).getTime())
  let thisWeek = 0
  let lastWeek = 0
  for (const [key, day] of dayMinutes(records)) {
    const [ky, km, kd] = key.split('-').map(Number)
    const week = weekKey(new Date(ky, km - 1, kd).getTime())
    if (week === thisKey) thisWeek += day.total
    else if (week === lastKey) lastWeek += day.total
  }
  return { thisWeek, lastWeek, diff: thisWeek - lastWeek }
}

/** 지금까지 활동별 누적 인정 분 */
export function activityTotals(records: ActivityRecord[]): Record<ActivityId, number> {
  const totals = zero()
  for (const id of IDS) totals[id] = creditedMinutes(records, id)
  return totals
}

export interface BestDay {
  key: string
  minutes: number
}

/** 인정 분이 가장 많은 날(같으면 먼저 한 날). 1분 이상인 날이 없으면 null */
export function bestDay(records: ActivityRecord[]): BestDay | null {
  let best: BestDay | null = null
  for (const [key, day] of dayMinutes(records)) {
    if (day.total < 1) continue
    if (!best || day.total > best.minutes || (day.total === best.minutes && key < best.key)) best = { key, minutes: day.total }
  }
  return best
}

export interface RecordSummary {
  /** 1분 이상 인정된 기록이 하나도 없다 */
  empty: boolean
  /** 최근 7일(오늘까지) */
  days: HistoryDay[]
  week: WeekTotals
  totals: Record<ActivityId, number>
  best: BestDay | null
}

/** "나" 창 내 기록 칸에 보여 줄 값 */
export function recordSummary(records: ActivityRecord[], now: number): RecordSummary {
  const best = bestDay(records)
  return {
    empty: best === null,
    days: recentDays(records, now),
    week: weekTotals(records, now),
    totals: activityTotals(records),
    best,
  }
}
