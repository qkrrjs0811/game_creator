import { ACTIVITIES } from './activities'
import { goalDays } from './goal'
import { dayMinutes } from './history'
import { restStreak } from './rest'
import type { ActivityId, ActivityRecord, SaveData } from './types'

/**
 * 업적: 현실 활동으로만 닿는 이정표. 기록에서 인정 분(상한 안)만 세어 계산하고 저장하지 않는다.
 * 업적마다 칭호(강해지지 않는 꾸미기)를 하나씩 준다. 전투로는 아무 업적도 얻지 않는다.
 */

export type AchievementKind = 'minutes' | 'stamps' | 'streak' | 'variety'

export interface Achievement {
  id: string
  kind: AchievementKind
  /** kind 가 minutes 일 때 세는 활동 */
  activity?: ActivityId
  /** minutes 는 분, stamps 는 도장 수, streak 는 이어 온 날 수, variety 는 활동 종류 수 */
  goal: number
  /** 업적 이름(화면에 보이는 글자) */
  label: string
  /** 꾸미기 id 로 worn 에 넣는다 */
  titleId: string
  titleName: string
}

const hours = (
  activity: ActivityId,
  list: [number, string][],
): Achievement[] =>
  list.map(([h, titleName]) => ({
    id: `${activity}-${h}`,
    kind: 'minutes',
    activity,
    goal: h * 60,
    label: `${ACTIVITIES[activity].label} ${h}시간`,
    titleId: `title:${activity}-${h}`,
    titleName,
  }))

const count = (kind: AchievementKind, list: [number, string, string][]): Achievement[] =>
  list.map(([goal, label, titleName]) => ({ id: `${kind}-${goal}`, kind, goal, label, titleId: `title:${kind}-${goal}`, titleName }))

export const ACHIEVEMENTS: Achievement[] = [
  ...hours('exercise', [
    [1, '땀방울 새싹'],
    [10, '꾸준한 운동러'],
    [50, '근육 말랑이'],
    [100, '운동 마스터'],
  ]),
  ...hours('study', [
    [1, '연필 새싹'],
    [10, '공부 벌레'],
    [50, '척척박사'],
  ]),
  ...hours('reading', [
    [1, '책장 새싹'],
    [10, '책벌레'],
    [50, '도서관 주인'],
  ]),
  ...hours('relax', [
    [1, '느긋한 말랑이'],
    [10, '쉼표 장인'],
  ]),
  ...count('stamps', [
    [10, '도장 10개', '도장 수집가'],
    [50, '도장 50개', '도장 부자'],
    [100, '도장 100개', '도장 왕'],
  ]),
  ...count('streak', [
    [3, '3일 이어 하기', '사흘 친구'],
    [7, '7일 이어 하기', '일주일 개근'],
    [30, '30일 이어 하기', '한 달 개근'],
  ]),
  ...count('variety', [[4, '네 활동 모두 해 보기', '팔방미인']]),
]

/** 칭호 id 의 칭호 이름. 없는 id 면 null */
export function titleName(titleId: string): string | null {
  return ACHIEVEMENTS.find((a) => a.titleId === titleId)?.titleName ?? null
}

/** 하루 목표를 채운 날이 쉼표로 지킨 날까지 넣어 가장 길게 이어진 날 수. 끊겨도 내려가지 않는다 */
export function bestStreak(records: ActivityRecord[]): number {
  const days = [...goalDays(records)].sort()
  if (days.length === 0) return 0
  // 가장 긴 줄은 도장 찍은 날에서 끝나므로 마지막 도장 날까지만 따라가면 된다
  const [y, m, d] = days[days.length - 1].split('-').map(Number)
  return restStreak(records, new Date(y, m - 1, d, 12).getTime()).best
}

export interface AchievementProgress extends Achievement {
  /** 지금까지 쌓인 값(목표를 넘을 수 있다) */
  value: number
  done: boolean
}

/** 기록에서 업적마다 현재 값·달성 여부 */
export function achievementProgress(records: ActivityRecord[]): AchievementProgress[] {
  const totals: Record<ActivityId, number> = { exercise: 0, study: 0, reading: 0, relax: 0 }
  for (const day of dayMinutes(records).values()) {
    for (const id of Object.keys(totals) as ActivityId[]) totals[id] += day.minutes[id]
  }
  const values: Record<AchievementKind, number> = {
    minutes: 0,
    stamps: goalDays(records).size,
    streak: bestStreak(records),
    variety: Object.values(totals).filter((m) => m >= 1).length,
  }
  return ACHIEVEMENTS.map((a) => {
    const value = a.kind === 'minutes' ? totals[a.activity!] : values[a.kind]
    return { ...a, value, done: value >= a.goal }
  })
}

/** 보조 키에 남긴 이미 알린 업적 id 목록. 없거나 깨졌으면 null(처음 여는 창으로 본다) */
export function parseSeenAchievements(raw: string | null): string[] | null {
  if (raw === null) return null
  try {
    const list: unknown = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : null
  } catch {
    return null
  }
}

/** 달성했지만 아직 알리지 않은 업적 id. 처음 여는 창(seen = null)이면 이미 닿은 것을 모두 묶어 한 번에 알린다 */
export function unseenAchievements(achieved: string[], seen: string[] | null): string[] {
  const known = new Set(seen ?? [])
  return achieved.filter((id) => !known.has(id))
}

const byTitle = (titleId: string) => ACHIEVEMENTS.find((a) => a.titleId === titleId)

/** 이름 옆에 단 칭호의 업적. 달지 않았거나 아직 얻지 못한 칭호면 null */
export function wornTitle(save: Pick<SaveData, 'records' | 'worn'>): Achievement | null {
  const achieved = new Set(achievedIds(save.records))
  return save.worn.map(byTitle).find((a) => a !== undefined && achieved.has(a.id)) ?? null
}

/** 얻은 칭호를 단다(하나만). 단 칭호를 다시 누르면 뗀다. 모자·색은 그대로, 얻지 못한 칭호면 그대로 돌려준다 */
export function toggleTitle<T extends Pick<SaveData, 'records' | 'worn'>>(save: T, titleId: string): T {
  const a = byTitle(titleId)
  if (!a || !achievedIds(save.records).includes(a.id)) return save
  const others = save.worn.filter((id) => !byTitle(id))
  return { ...save, worn: save.worn.includes(titleId) ? others : [...others, titleId] }
}

/** 달성한 업적 id(목록 순서) */
export function achievedIds(records: ActivityRecord[]): string[] {
  return achievementProgress(records)
    .filter((a) => a.done)
    .map((a) => a.id)
}
