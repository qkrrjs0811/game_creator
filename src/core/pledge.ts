import { ACTIVITIES } from './activities'
import { dayKey, todayStatus } from './progression'
import type { ActivityId, ActivityRecord } from './types'

/**
 * 오늘의 다짐: 하루에 한 번 내가 직접 활동 하나와 시간을 고른다("오늘은 공부 30분").
 * 채움은 그날 그 활동의 인정 분(상한 안)으로만 센다. 고른 값은 보조 키에 두고 보상이 없어
 * 저장 형식·경험치·능력치는 그대로다
 */
export const PLEDGE_MINUTES = [10, 20, 30, 60] as const

export interface Pledge {
  /** 다짐한 로컬 날짜 YYYY-MM-DD */
  day: string
  activity: ActivityId
  minutes: number
}

const isActivity = (v: unknown): v is ActivityId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACTIVITIES, v)

/** 그 활동 상한 안에 들고 오늘 이미 한 분보다 긴 시간만 고를 수 있다 */
export function pledgeOptions(records: ActivityRecord[], activity: ActivityId, now: number): number[] {
  const { minutes, cap } = todayStatus(records, activity, now)
  return PLEDGE_MINUTES.filter((m) => m <= cap && m > minutes)
}

export function serializePledge(p: Pledge): string {
  return JSON.stringify({ day: p.day, activity: p.activity, minutes: p.minutes })
}

/** 없거나 깨졌거나 모양이 틀리거나 오늘 다짐이 아니면 null */
export function parsePledge(raw: string | null, now: number): Pledge | null {
  if (raw === null) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
    const { day, activity, minutes } = v as Record<string, unknown>
    if (day !== dayKey(now) || !isActivity(activity)) return null
    if (typeof minutes !== 'number' || !(PLEDGE_MINUTES as readonly number[]).includes(minutes)) return null
    if (minutes > ACTIVITIES[activity].dailyCapMinutes) return null
    return { day, activity, minutes }
  } catch {
    return null
  }
}

export interface PledgeProgress {
  activity: ActivityId
  goal: number
  /** 오늘 그 활동의 인정 분(상한 안). 다짐을 넘겨도 계속 센다 */
  minutes: number
  remaining: number
  /** 진행 막대 0~1 */
  ratio: number
  done: boolean
}

/** 기록(켜 둔 타이머 몫을 합친 것)으로 오늘 다짐의 진행. 다짐이 없으면 null */
export function pledgeProgress(p: Pledge | null, records: ActivityRecord[], now: number): PledgeProgress | null {
  if (!p) return null
  const { minutes } = todayStatus(records, p.activity, now)
  return {
    activity: p.activity,
    goal: p.minutes,
    minutes,
    remaining: Math.max(0, p.minutes - minutes),
    ratio: Math.min(1, minutes / p.minutes),
    done: minutes >= p.minutes,
  }
}

/** 다짐은 채우기 전까지만 정하거나 바꿀 수 있다 */
export function canChangePledge(p: Pledge | null, records: ActivityRecord[], now: number): boolean {
  return !pledgeProgress(p, records, now)?.done
}

/** 지킴 배지를 지금 띄울지. 알린 날(보조 키 값)이 다짐한 날과 다르면 아직 안 알린 것이다 */
export function pledgeCelebrateNow(p: Pledge | null, progress: PledgeProgress | null, celebratedRaw: string | null): boolean {
  if (!p || !progress?.done) return false
  return celebratedRaw !== p.day
}
