import { ACTIVITIES } from './activities'
import { computeProgress } from './progression'
import type { ActivityId, ActivityRecord } from './types'

/**
 * 말랑이 모습: 기록에서 계산한 레벨로 성장 단계를, 활동별 인정 분(상한 안)으로 특징을 정한다.
 * 그림만 정하고 저장하지 않는다. 경험치·능력치·전투 값과는 상관없다
 */

export type GrowthStageId = 'baby' | 'kid' | 'teen' | 'adult'

export interface GrowthStage {
  id: GrowthStageId
  name: string
  /** 이 단계가 되는 레벨 */
  minLevel: number
  /** 장면에서 몸 크기 배율 */
  scale: number
}

export const GROWTH_STAGES: GrowthStage[] = [
  { id: 'baby', name: '아기', minLevel: 1, scale: 1 },
  { id: 'kid', name: '어린이', minLevel: 5, scale: 1.1 },
  { id: 'teen', name: '청소년', minLevel: 10, scale: 1.2 },
  { id: 'adult', name: '어른', minLevel: 20, scale: 1.3 },
]

export interface StageInfo {
  stage: GrowthStage
  /** GROWTH_STAGES 안의 순서 */
  index: number
  /** 다음 단계가 되는 레벨. 마지막 단계면 null */
  nextLevel: number | null
  levelsToNext: number | null
}

/** 레벨의 성장 단계. 레벨로만 정해져 내려가지 않는다 */
export function growthStage(level: number): StageInfo {
  let index = 0
  while (index + 1 < GROWTH_STAGES.length && level >= GROWTH_STAGES[index + 1].minLevel) index++
  const next = GROWTH_STAGES[index + 1]
  return {
    stage: GROWTH_STAGES[index],
    index,
    nextLevel: next ? next.minLevel : null,
    levelsToNext: next ? next.minLevel - level : null,
  }
}

/** 두 번째로 많이 한 활동이 첫째의 이만큼 이상이면 특징을 둘 붙인다 */
export const SECOND_TRAIT_RATIO = 0.75

export const TRAIT_LABELS: Record<ActivityId, string> = {
  exercise: '운동파',
  study: '공부파',
  reading: '독서파',
  relax: '휴식파',
}

/** 많이 한 활동(많은 순, 최대 둘). 1분 이상 한 활동이 없으면 [] */
export function mainTraits(minutes: Record<ActivityId, number>): ActivityId[] {
  const ids = (Object.keys(ACTIVITIES) as ActivityId[]).filter((id) => minutes[id] >= 1)
  // 같은 분이면 ACTIVITIES 순서(정렬은 안정적이다)
  ids.sort((a, b) => minutes[b] - minutes[a])
  if (ids.length === 0) return []
  const [first, second] = ids
  return second && minutes[second] >= minutes[first] * SECOND_TRAIT_RATIO ? [first, second] : [first]
}

/** "운동파 어린이 말랑이", "공부·독서파 청소년 말랑이", "아기 말랑이" */
export function lookName(traits: ActivityId[], stage: GrowthStage): string {
  const trait = traits.length ? `${traits.map((id) => ACTIVITIES[id].label).join('·')}파 ` : ''
  return `${trait}${stage.name} 말랑이`
}

export interface MalangLook extends StageInfo {
  traits: ActivityId[]
  name: string
}

/** 기록에서 말랑이 모습 */
export function malangLook(records: ActivityRecord[]): MalangLook {
  const progress = computeProgress(records)
  const info = growthStage(progress.level)
  const traits = mainTraits(progress.creditedMinutes)
  return { ...info, traits, name: lookName(traits, info.stage) }
}

/** "나" 창 모습 줄: 지금 이름과 다음 단계까지 남은 레벨 */
export function lookLine(look: MalangLook): { name: string; next: string } {
  const next = GROWTH_STAGES[look.index + 1]
  return {
    name: `🌱 지금 모습: ${look.name}`,
    next: next ? `다음 단계(${next.name})까지 Lv ${look.levelsToNext}` : '다 자랐어요 · 하는 활동대로 특징이 바뀌어요',
  }
}

/** 보조 키에 남긴 본 단계(GROWTH_STAGES 순서)를 되살린다. 없거나 깨졌으면 null */
export function restoreSeenStage(stored: string | null): number | null {
  if (stored === null || !/^\d+$/.test(stored)) return null
  const index = Number(stored)
  return index < GROWTH_STAGES.length ? index : null
}

/**
 * 자람 연출을 띄울 단계. 본 단계보다 자랐을 때만 지금 단계, 아니면 null.
 * 본 단계가 없으면(처음 열거나 백업을 가져온 직후) 지금 단계를 본 것으로 두고 띄우지 않는다
 */
export function grownStage(seen: number | null, current: number): number | null {
  if (seen === null) return null
  return current > seen ? current : null
}
