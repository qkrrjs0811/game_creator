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
}

const nextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

/**
 * 도장 찍은 날을 날짜순으로 따라가며 쉼표를 모으고, 하루만 빈 날을 쉼표로 메워 이어 온 날을 센다.
 * 이틀 이상 빈 곳은 메우지 않는다. 지킨 날은 도장이 아니라 쉼표 모으기에 세지 않는다.
 * 오늘을 아직 못 채웠으면 오늘은 건너뛴다(goalStreak 와 같음). 기록에서 계산만 한다.
 */
export function restStreak(records: ActivityRecord[], now: number): RestStreak {
  const days = goalDays(records)
  const result: RestStreak = { streak: 0, rests: 0, toNextRest: REST_EVERY_STAMPS, restedDays: [] }
  if (days.size === 0) return result
  const todayKey = dayKey(now)
  const first = [...days].sort()[0]
  const [y, m, d] = first.split('-').map(Number)
  let cursor = new Date(y, m - 1, d)
  let counter = 0
  for (let key = dayKey(cursor.getTime()); key <= todayKey; cursor = nextDay(cursor), key = dayKey(cursor.getTime())) {
    if (days.has(key)) {
      result.streak++
      counter++
      if (counter === REST_EVERY_STAMPS) {
        counter = 0
        result.rests = Math.min(REST_MAX, result.rests + 1)
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
