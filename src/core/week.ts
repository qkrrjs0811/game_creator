import { goalDays } from './goal'
import { dayKey } from './progression'
import type { ActivityRecord } from './types'

/** 주간 목표: 한 주(월~일)에 도장 찍은 날(하루 목표를 채운 날) 수. 경험치·능력치와는 상관없다 */
export const WEEKLY_GOAL_DAYS = 5

/** ms 가 속한 주의 로컬 월요일 0시 */
function mondayOf(ms: number): Date {
  const d = new Date(ms)
  const back = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
}

/** ms 가 속한 주의 키 = 그 주 월요일의 YYYY-MM-DD */
export function weekKey(ms: number): string {
  return dayKey(mondayOf(ms).getTime())
}

export interface WeekDay {
  /** YYYY-MM-DD */
  key: string
  stamped: boolean
  today: boolean
  future: boolean
}

export interface WeekGoal {
  /** 이번 주 월요일의 YYYY-MM-DD */
  week: string
  /** 월~일 7칸 */
  days: WeekDay[]
  /** 이번 주에 도장 찍은 날 수 */
  stamped: number
  goal: number
  done: boolean
  /** 지금까지 목표를 채운 주 수(이번 주 포함) */
  doneWeeks: number
}

/** 주마다 도장 찍은 날 수 */
function stampsByWeek(stamped: Set<string>): Map<string, number> {
  const weeks = new Map<string, number>()
  for (const key of stamped) {
    const [y, m, d] = key.split('-').map(Number)
    const week = weekKey(new Date(y, m - 1, d).getTime())
    weeks.set(week, (weeks.get(week) ?? 0) + 1)
  }
  return weeks
}

function countDoneWeeks(stamped: Set<string>): number {
  let count = 0
  for (const n of stampsByWeek(stamped).values()) if (n >= WEEKLY_GOAL_DAYS) count++
  return count
}

/** 지금까지 목표(5일)를 채운 주 수 */
export function doneWeeks(records: ActivityRecord[]): number {
  return countDoneWeeks(goalDays(records))
}

/** now 가 속한 주의 주간 목표 */
export function weekGoal(records: ActivityRecord[], now: number): WeekGoal {
  const stamped = goalDays(records)
  const monday = mondayOf(now)
  const todayKey = dayKey(now)
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const key = dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i).getTime())
    days.push({ key, stamped: stamped.has(key), today: key === todayKey, future: key > todayKey })
  }
  const count = days.filter((d) => d.stamped).length
  return {
    week: dayKey(monday.getTime()),
    days,
    stamped: count,
    goal: WEEKLY_GOAL_DAYS,
    done: count >= WEEKLY_GOAL_DAYS,
    doneWeeks: countDoneWeeks(stamped),
  }
}
