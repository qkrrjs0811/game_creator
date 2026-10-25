import { goalDays } from './goal'
import { dayKey } from './progression'
import type { ActivityRecord } from './types'

/** 도장 몇 개마다 쉼표 하나 */
export const REST_EVERY_STAMPS = 7
/** 한 번에 들고 있을 수 있는 쉼표 수 */
export const REST_MAX = 2

export interface RestStreak {
  /** 쉼표로 지킨 날까지 센 이어 온 날 수 */
  streak: number
  /** 지금 들고 있는 쉼표 수 */
  rests: number
  /** 다음 쉼표까지 남은 도장 수 */
  toNextRest: number
  /** 쉼표로 지킨 날의 YYYY-MM-DD 키(날짜순) */
  restedDays: string[]
  /** 쉼표로 지킨 날까지 넣어 가장 길게 이어 온 날 수(끊겨도 내려가지 않음) */
  best: number
  /** 지금까지 실제로 얻은 쉼표 수(가득 차서 버려진 것은 빼고, 기록이 늘어도 내려가지 않음) */
  earned: number
}

/** 쉼표로 지킨 날 중 그 달(month 1~12)의 일(日) 번호 */
export function restedInMonth(restedDays: string[], year: number, month: number): number[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  return restedDays.filter((k) => k.startsWith(prefix)).map((k) => Number(k.slice(prefix.length)))
}

/** 도장판 쉼표 줄: "🛟 쉼표 1 / 2개 · 다음 쉼표까지 도장 3개" */
export function restText(r: Pick<RestStreak, 'rests' | 'toNextRest'>): string {
  const held = `🛟 쉼표 ${r.rests} / ${REST_MAX}개`
  return r.rests >= REST_MAX ? `${held} · 가득 찼어요` : `${held} · 다음 쉼표까지 도장 ${r.toNextRest}개`
}

const nextDay =(d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

/**
 * 도장 찍은 날을 날짜순으로 따라가며 쉼표를 모으고, 하루만 빈 날을 쉼표로 메워 이어 온 날을 센다.
 * 이틀 이상 빈 곳은 메우지 않는다. 지킨 날은 도장이 아니라 쉼표 모으기에 세지 않는다.
 * 오늘을 아직 못 채웠으면 오늘은 건너뛴다(goalStreak 와 같음). 기록에서 계산만 한다.
 */
export function restStreak(records: ActivityRecord[], now: number): RestStreak {
  const days = goalDays(records)
  const result: RestStreak = { streak: 0, rests: 0, toNextRest: REST_EVERY_STAMPS, restedDays: [], best: 0, earned: 0 }
  if (days.size === 0) return result
  const todayKey = dayKey(now)
  const first = [...days].sort()[0]
  const [y, m, d] = first.split('-').map(Number)
  let cursor = new Date(y, m - 1, d)
  let counter = 0
  for (let key = dayKey(cursor.getTime()); key <= todayKey; cursor = nextDay(cursor), key = dayKey(cursor.getTime())) {
    if (days.has(key)) {
      result.streak++
      result.best = Math.max(result.best, result.streak)
      counter++
      if (counter === REST_EVERY_STAMPS) {
        counter = 0
        if (result.rests < REST_MAX) {
          result.rests++
          result.earned++
        }
      }
      continue
    }
    if (key === todayKey) break
    const next = dayKey(nextDay(cursor).getTime())
    const oneDayGap = days.has(next) || next === todayKey
    if (result.streak > 0 && result.rests > 0 && oneDayGap) {
      result.rests--
      result.streak++
      result.restedDays.push(key)
    } else {
      result.streak = 0
    }
  }
  result.toNextRest = REST_EVERY_STAMPS - counter
  return result
}

/** 어제를 쉼표로 지켰는지 */
export function restedYesterday(restedDays: string[], now: number): boolean {
  const d = new Date(now)
  return restedDays.includes(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime()))
}

/** 보조 키에 남긴 "알린 쉼표 수". 없거나 이상하면 null */
export function parseSeenRests(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null
  return Number(raw)
}

/**
 * 쉼표를 새로 얻었으면 배지를 한 번 띄운다. 처음 여는 창(본 수 없음)은 지금 수를 기억만 한다.
 * remember 가 null 이 아니면 그 수를 보조 키에 남긴다.
 */
export function restEarnedNow(earned: number, seen: number | null): { show: boolean; remember: number | null } {
  if (seen === null) return { show: false, remember: earned }
  if (earned > seen) return { show: true, remember: earned }
  return { show: false, remember: null }
}
