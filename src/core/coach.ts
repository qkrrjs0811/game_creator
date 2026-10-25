import { playerFighter, simulateBattle, type Fighter } from './battle'
import { statsFromMinutes } from './progression'
import { ACTIVITIES } from './activities'
import { stageEnemy, targetMinutes } from './endless'
import type { ActivityId } from './types'

/** 이길 만한지 보려고 돌려 보는 시험 전투 수. 절반 이상 이기면 이길 만하다고 본다 */
const TRIAL_SEEDS = 20
/** 이만큼(인정 분) 더 해도 이길 만하지 않으면 찾지 않는다 */
const SEARCH_MINUTES = 6000

/** 정해 둔 씨앗들로 전투를 돌려 절반 이상 이기는지 */
export function likelyWin(me: Fighter, enemy: Fighter): boolean {
  let wins = 0
  for (let seed = 1; seed <= TRIAL_SEEDS; seed++) if (simulateBattle(me, enemy, seed).win) wins++
  return wins * 2 >= TRIAL_SEEDS
}

/**
 * 진 뒤 "얼마나 더 키우면 되는지" 알려 주려고, 활동을 몇 분(인정 분) 더 하면 이길 만해지는지 센다.
 * 지금도 이길 만하면 0, 찾는 범위 안에서 안 되면 null. 스킬은 지금 배운 것 그대로 본다.
 * 화면에 보여 줄 값만 만들고 저장·성장은 바꾸지 않는다
 */
export function minutesToWin(
  minutes: Partial<Record<ActivityId, number>>,
  skills: string[],
  enemy: Fighter,
  maxMinutes = SEARCH_MINUTES,
  activity: ActivityId = 'exercise',
): number | null {
  const now = minutes[activity] ?? 0
  const per = ACTIVITIES[activity].minutesPerStat
  // 능력치는 per 분마다 오르므로 그 순간들만 본다
  for (let extra = 0; extra <= maxMinutes; extra = per * (Math.floor((now + extra) / per) + 1) - now) {
    const me = playerFighter(statsFromMinutes({ ...minutes, [activity]: now + extra }), skills)
    if (likelyWin(me, enemy)) return extra
  }
  return null
}

/**
 * 스테이지 번호로 운동 몇 분 더 하면 이길 만한지. 먼 장은 처음부터 100시간 넘게 걸리므로
 * 그 스테이지 난이도 곡선의 두 배까지는 찾는다
 */
export function stageMinutesToWin(minutes: Partial<Record<ActivityId, number>>, skills: string[], no: number): number | null {
  return minutesToWin(minutes, skills, stageEnemy(no), Math.max(SEARCH_MINUTES, Math.ceil(targetMinutes(no) * 2)))
}

/**
 * 모험 지도에서 다음에 깰 스테이지(stageProgress + 1)를 운동 몇 분 더 하면 이길 만한지.
 * 스테이지는 끝이 없어 언제나 다음이 있다. 화면에 보여 줄 값일 뿐이다
 */
export function nextStageAdvice(
  minutes: Partial<Record<ActivityId, number>>,
  skills: string[],
  stageProgress: number,
): { no: number; toWin: number | null } | null {
  const no = Math.max(0, Math.floor(stageProgress) || 0) + 1
  return { no, toWin: stageMinutesToWin(minutes, skills, no) }
}

/** 이길 만한 스테이지를 이만큼까지만 센다(화면에는 "N개 이상"으로 보여 준다) */
export const WINNABLE_MAX = 10

/**
 * 다음에 깰 스테이지부터 줄줄이 이길 만한 스테이지 수. 스테이지는 차례로 열리니
 * 처음 못 이길 만한 곳에서 멈춘다. 화면에 보여 줄 값일 뿐이다
 */
export function winnableStages(
  minutes: Partial<Record<ActivityId, number>>,
  skills: string[],
  stageProgress: number,
  max = WINNABLE_MAX,
): number {
  const me = playerFighter(statsFromMinutes(minutes), skills)
  const first = Math.max(0, Math.floor(stageProgress) || 0) + 1
  let n = 0
  while (n < max && likelyWin(me, stageEnemy(first + n))) n++
  return n
}
