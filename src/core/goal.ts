import { ACTIVITIES } from './activities'
import { dayKey, msByDay } from './progression'
import type { ActivityId, ActivityRecord } from './types'

/** 하루 목표: 모든 활동을 합쳐 인정된(상한 안) 분. 경험치·능력치와는 상관없다 */
export const DAILY_GOAL_MINUTES = 30

const MINUTE = 60_000

/** 로컬 날짜별로 활동마다 상한을 적용해 합친 인정 분 */
function goalMinutesByDay(records: ActivityRecord[]): Map<string, number> {
  const msTotal = new Map<string, number>()
  for (const id of Object.keys(ACTIVITIES) as ActivityId[]) {
    const capMs = ACTIVITIES[id].dailyCapMinutes * MINUTE
    for (const [key, ms] of msByDay(records, id)) msTotal.set(key, (msTotal.get(key) ?? 0) + Math.min(ms, capMs))
  }
  const minutes = new Map<string, number>()
  for (const [key, ms] of msTotal) minutes.set(key, Math.floor(ms / MINUTE))
  return minutes
}

export interface TodayGoal {
  minutes: number
  goal: number
  done: boolean
}

/** now 가 속한 로컬 날짜의 하루 목표 진행 */
export function todayGoal(records: ActivityRecord[], now: number): TodayGoal {
  const minutes = goalMinutesByDay(records).get(dayKey(now)) ?? 0
  return { minutes, goal: DAILY_GOAL_MINUTES, done: minutes >= DAILY_GOAL_MINUTES }
}

/** 하루 목표를 채운 날(도장 찍은 날)의 YYYY-MM-DD 키 */
export function goalDays(records: ActivityRecord[]): Set<string> {
  const days = new Set<string>()
  for (const [key, m] of goalMinutesByDay(records)) if (m >= DAILY_GOAL_MINUTES) days.add(key)
  return days
}

/** 모은 도장 수 = 목표를 채운 날 수 */
export function stampCount(records: ActivityRecord[]): number {
  return goalDays(records).size
}

export interface StampDay {
  day: number
  stamped: boolean
  today: boolean
  future: boolean
}

export interface StampCalendar {
  year: number
  /** 1~12 */
  month: number
  /** 1일 앞 빈칸 수(일요일 시작) */
  lead: number
  days: StampDay[]
  /** 이번 달에 찍은 도장 수 */
  monthStamps: number
}

/** now 가 속한 달의 도장판 달력 */
export function stampCalendar(records: ActivityRecord[], now: number): StampCalendar {
  const stamped = goalDays(records)
  const d = new Date(now)
  const year = d.getFullYear()
  const month = d.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  const days: StampDay[] = []
  for (let i = 1; i <= count; i++) {
    days.push({
      day: i,
      stamped: stamped.has(dayKey(new Date(year, month, i).getTime())),
      today: i === d.getDate(),
      future: i > d.getDate(),
    })
  }
  return {
    year,
    month: month + 1,
    lead: new Date(year, month, 1).getDay(),
    days,
    monthStamps: days.filter((x) => x.stamped).length,
  }
}

/**
 * 오늘까지 이어 온 날 수. 오늘을 아직 못 채웠으면 어제까지 센다(오늘 안에 채우면 이어진다).
 */
export function goalStreak(records: ActivityRecord[], now: number): number {
  const days = goalDays(records)
  const d = new Date(now)
  let cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (!days.has(dayKey(cursor.getTime()))) cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor.getTime()))) {
    streak++
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
  }
  return streak
}
