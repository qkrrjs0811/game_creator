import { playerFighter, simulateBattle, type Fighter } from './battle'
import { MINUTES_PER_STAT, statsFromMinutes } from './progression'
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
  minutes: Record<ActivityId, number>,
  skills: string[],
  enemy: Fighter,
  maxMinutes = SEARCH_MINUTES,
  activity: ActivityId = 'exercise',
): number | null {
  const now = minutes[activity]
  // 능력치는 MINUTES_PER_STAT 분마다 오르므로 그 순간들만 본다
  for (let extra = 0; extra <= maxMinutes; extra = MINUTES_PER_STAT * (Math.floor((now + extra) / MINUTES_PER_STAT) + 1) - now) {
    const me = playerFighter(statsFromMinutes({ ...minutes, [activity]: now + extra }), skills)
    if (likelyWin(me, enemy)) return extra
  }
  return null
}
