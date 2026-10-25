import { ACTIVITIES } from './activities'
import { goalDays } from './goal'
import { dayMinutes } from './history'
import { WEEKLY_GOAL_DAYS, weekKey } from './week'
import type { ActivityId, ActivityRecord } from './types'

/** 지난주 편지: 지난주(월~일) 기록을 돌아보는 값. 기록에서 계산만 하고 보상은 없다 */

const IDS = Object.keys(ACTIVITIES) as ActivityId[]

export const LETTER_ICONS: Record<ActivityId, string> = { exercise: '🏃', study: '✏️', reading: '📚', relax: '🍵' }

export interface WeekLetter {
  /** 지난주 월요일의 YYYY-MM-DD */
  week: string
  /** 지난주 인정 분 */
  total: number
  /** 그 전 주 인정 분 */
  prevTotal: number
  /** total - prevTotal */
  diff: number
  /** 지난주 도장 찍은 날 수 */
  stamped: number
  goal: number
  goalDone: boolean
  /** 지난주 활동별 인정 분 */
  minutes: Record<ActivityId, number>
  /** 가장 많이 한 활동(같으면 운동·공부·독서·휴식 순) */
  top: ActivityId
  /** 지난주 인정 분이 가장 많은 날(같으면 먼저 한 날) */
  best: { key: string; minutes: number }
  /** 지난주에 덜 한 활동(가장 많이 한 활동은 빼고) */
  suggest: ActivityId
  suggestText: string
}

export function suggestText(id: ActivityId): string {
  return `이번 주엔 ${LETTER_ICONS[id]} ${ACTIVITIES[id].label}도 해 볼까?`
}

/** YYYY-MM-DD 키를 그 날의 로컬 시각으로 */
const keyTime = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** now 가 속한 주의 앞 주를 돌아보는 편지. 지난주 인정 분이 1분도 없으면 null */
export function lastWeekLetter(records: ActivityRecord[], now: number): WeekLetter | null {
  const thisMonday = keyTime(weekKey(now))
  const lastDate = new Date(thisMonday)
  const week = weekKey(new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() - 7).getTime())
  const prevWeek = weekKey(new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() - 14).getTime())

  const minutes: Record<ActivityId, number> = { exercise: 0, study: 0, reading: 0, relax: 0 }
  let total = 0
  let prevTotal = 0
  let best: { key: string; minutes: number } | null = null
  for (const [key, day] of dayMinutes(records)) {
    const w = weekKey(keyTime(key))
    if (w === prevWeek) prevTotal += day.total
    if (w !== week) continue
    total += day.total
    for (const id of IDS) minutes[id] += day.minutes[id]
    if (day.total >= 1 && (!best || day.total > best.minutes || (day.total === best.minutes && key < best.key))) {
      best = { key, minutes: day.total }
    }
  }
  if (total < 1 || !best) return null

  let stamped = 0
  for (const key of goalDays(records)) if (weekKey(keyTime(key)) === week) stamped++

  let top = IDS[0]
  for (const id of IDS) if (minutes[id] > minutes[top]) top = id
  const rest = IDS.filter((id) => id !== top)
  let suggest = rest[0]
  for (const id of rest) if (minutes[id] < minutes[suggest]) suggest = id

  return {
    week,
    total,
    prevTotal,
    diff: total - prevTotal,
    stamped,
    goal: WEEKLY_GOAL_DAYS,
    goalDone: stamped >= WEEKLY_GOAL_DAYS,
    minutes,
    top,
    best,
    suggest,
    suggestText: suggestText(suggest),
  }
}

/** 보조 키에 남긴 "본 편지의 주(YYYY-MM-DD)". 없거나 이상하면 null */
export function parseSeenLetter(raw: string | null): string | null {
  if (raw === null || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

/**
 * 새 주의 편지를 한 번 띄운다. 처음 여는 창(본 주 없음)은 지금 편지의 주를 기억만 한다.
 * remember 가 null 이 아니면 그 주를 보조 키에 남긴다.
 */
export function letterNow(week: string | null, seen: string | null): { show: boolean; remember: string | null } {
  if (week === null) return { show: false, remember: null }
  if (seen === null) return { show: false, remember: week }
  if (week !== seen) return { show: true, remember: week }
  return { show: false, remember: null }
}
