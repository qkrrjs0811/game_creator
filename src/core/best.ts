import { ACTIVITIES } from './activities'
import { dayMinutes } from './history'
import { dayKey } from './progression'
import { restStreak } from './rest'
import { weekKey } from './week'
import type { ActivityId, ActivityRecord } from './types'

/** 내 최고 기록: 기록에서 계산만 한다. 상한 안 인정 분만 세어 켜 두고 잊기로 부풀지 않는다. 경험치·능력치와는 상관없다 */

const MINUTE = 60_000
const IDS = Object.keys(ACTIVITIES) as ActivityId[]

const zero = (): Record<ActivityId, number> => ({ exercise: 0, study: 0, reading: 0, relax: 0 })

export interface BestPeriod {
  /** 하루면 YYYY-MM-DD, 주면 그 주 월요일 YYYY-MM-DD */
  key: string
  minutes: number
}

export interface PersonalBests {
  /** 활동별 한 번에 가장 길게 한 인정 분 */
  session: Record<ActivityId, number>
  /** 인정 분 합계가 가장 많은 날(같으면 먼저 한 날). 기록이 없으면 null */
  day: BestPeriod | null
  /** 인정 분 합계가 가장 많은 주(월~일, 같으면 먼저 한 주). 기록이 없으면 null */
  week: BestPeriod | null
  /** 쉼표로 지킨 날까지 넣어 가장 길게 이어 온 날 수 */
  streak: number
}

function nextLocalMidnight(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
}

/** 활동별 한 번 최고: 시작 순으로 따라가며 그날 이미 쓴 상한을 빼고 남은 만큼만 인정한다 */
function sessionBests(records: ActivityRecord[]): Record<ActivityId, number> {
  const best = zero()
  const used = new Map<string, number>()
  for (const r of [...records].sort((a, b) => a.startedAt - b.startedAt)) {
    const capMs = ACTIVITIES[r.activity].dailyCapMinutes * MINUTE
    const end = Math.max(r.startedAt, r.endedAt)
    let credited = 0
    for (let t = r.startedAt; t < end; ) {
      const cut = Math.min(end, nextLocalMidnight(t))
      const slot = `${r.activity}|${dayKey(t)}`
      const before = used.get(slot) ?? 0
      credited += Math.max(0, Math.min(cut - t, capMs - before))
      used.set(slot, before + (cut - t))
      t = cut
    }
    best[r.activity] = Math.max(best[r.activity], Math.floor(credited / MINUTE))
  }
  return best
}

/** 가장 큰 값(같으면 앞 키) */
function topOf(totals: Map<string, number>): BestPeriod | null {
  let top: BestPeriod | null = null
  for (const key of [...totals.keys()].sort()) {
    const minutes = totals.get(key)!
    if (minutes >= 1 && (!top || minutes > top.minutes)) top = { key, minutes }
  }
  return top
}

export function personalBests(records: ActivityRecord[], now: number): PersonalBests {
  const days = new Map<string, number>()
  const weeks = new Map<string, number>()
  for (const [key, day] of dayMinutes(records)) {
    days.set(key, day.total)
    const [y, m, d] = key.split('-').map(Number)
    const week = weekKey(new Date(y, m - 1, d).getTime())
    weeks.set(week, (weeks.get(week) ?? 0) + day.total)
  }
  return { session: sessionBests(records), day: topOf(days), week: topOf(weeks), streak: restStreak(records, now).best }
}

/** 보조 키에 남기는 본 최고 기록(숫자만) */
export interface SeenBests {
  session: Record<ActivityId, number>
  day: number
  week: number
  streak: number
}

/** 갱신될 수 있는 항목: 활동별 한 번 최고, 하루, 주, 이어 온 날 */
export type BestKind = ActivityId | 'day' | 'week' | 'streak'

export function bestValues(b: PersonalBests): SeenBests {
  return { session: { ...b.session }, day: b.day?.minutes ?? 0, week: b.week?.minutes ?? 0, streak: b.streak }
}

/** 본 값보다 늘어난 항목. 전에 0이던 것(처음 해 본 활동 등)은 갱신으로 치지 않는다 */
export function bestsBroken(now: SeenBests, seen: SeenBests): BestKind[] {
  const broken: BestKind[] = []
  for (const id of IDS) if (seen.session[id] > 0 && now.session[id] > seen.session[id]) broken.push(id)
  for (const k of ['day', 'week', 'streak'] as const) if (seen[k] > 0 && now[k] > seen[k]) broken.push(k)
  return broken
}

const sameBests = (a: SeenBests, b: SeenBests) =>
  a.day === b.day && a.week === b.week && a.streak === b.streak && IDS.every((id) => a.session[id] === b.session[id])

/**
 * 새 최고 기록이 생겼으면 배지를 한 번 띄운다. 처음 여는 창(본 기록 없음)은 지금 값을 기억만 한다.
 * remember 가 null 이 아니면 그 값을 보조 키에 남긴다(줄어든 값도 남겨 다음 갱신을 그 값과 비교한다).
 */
export function bestsNow(now: SeenBests, seen: SeenBests | null): { show: boolean; broken: BestKind[]; remember: SeenBests | null } {
  if (seen === null) return { show: false, broken: [], remember: now }
  if (sameBests(now, seen)) return { show: false, broken: [], remember: null }
  const broken = bestsBroken(now, seen)
  return { show: broken.length > 0, broken, remember: now }
}

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** 보조 키에 남긴 본 최고 기록. 없거나 이상하면 null. 빠진 활동은 0으로 읽는다 */
export function parseSeenBests(raw: string | null): SeenBests | null {
  if (raw === null) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (!count(o.day) || !count(o.week) || !count(o.streak)) return null
  if (typeof o.session !== 'object' || o.session === null || Array.isArray(o.session)) return null
  const s = o.session as Record<string, unknown>
  const session = zero()
  for (const id of IDS) {
    if (s[id] === undefined) continue
    if (!count(s[id])) return null
    session[id] = s[id]
  }
  return { session, day: o.day, week: o.week, streak: o.streak }
}
