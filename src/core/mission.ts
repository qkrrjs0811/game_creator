import { dayMinutes } from './history'
import { dayKey } from './progression'
import type { ActivityId, ActivityRecord } from './types'

/**
 * 오늘의 미션: 날짜마다 활동 하나와 목표 분을 정하고, 그날 그 활동의 인정 분(상한 안)으로 채운다.
 * 기록에서 계산만 하고 경험치·능력치와는 상관없다. 채운 날마다 미션 별 하나.
 */

/** 날마다 하루씩 이 순서로 돌아간다 */
const MISSION_ORDER: ActivityId[] = ['exercise', 'study', 'reading', 'relax']

/** 활동마다 미션 목표 분. 휴식은 상한(30분)보다 짧게 둔다 */
export const MISSION_MINUTES: Record<ActivityId, number> = { exercise: 20, study: 15, reading: 15, relax: 10 }

export interface Mission {
  activity: ActivityId
  goal: number
}

/** YYYY-MM-DD 날짜의 미션. 1970-01-01부터 센 날 수로 돌려 같은 날은 늘 같다 */
function missionOfKey(key: string): Mission {
  const [y, m, d] = key.split('-').map(Number)
  const index = Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
  const activity = MISSION_ORDER[((index % 4) + 4) % 4]
  return { activity, goal: MISSION_MINUTES[activity] }
}

/** now 가 속한 로컬 날짜의 미션 */
export function missionFor(now: number): Mission {
  return missionOfKey(dayKey(now))
}

export interface TodayMission extends Mission {
  /** 오늘 그 활동의 인정 분 */
  minutes: number
  done: boolean
}

/** now 가 속한 로컬 날짜의 미션 진행 */
export function todayMission(records: ActivityRecord[], now: number): TodayMission {
  const mission = missionFor(now)
  const minutes = dayMinutes(records).get(dayKey(now))?.minutes[mission.activity] ?? 0
  return { ...mission, minutes, done: minutes >= mission.goal }
}

/** 미션을 채운 날의 YYYY-MM-DD 키 */
export function missionDays(records: ActivityRecord[]): Set<string> {
  const days = new Set<string>()
  for (const [key, day] of dayMinutes(records)) {
    const mission = missionOfKey(key)
    if (day.minutes[mission.activity] >= mission.goal) days.add(key)
  }
  return days
}

/** 모은 미션 별 수 = 미션을 채운 날 수 */
export function missionStars(records: ActivityRecord[]): number {
  return missionDays(records).size
}
