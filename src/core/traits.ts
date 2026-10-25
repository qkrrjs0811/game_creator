import type { BattleEvent } from './battle'
import { chapterOf, stageMonsterLook } from './endless'
import { STAT_INFO } from './stats'
import type { MonsterShape } from './monsters'
import type { ActivityId, StatId } from './types'

/** 몬스터 성격. 성격마다 잘 통하는 능력치(약점)가 달라 어떤 활동을 할지가 전투와 이어진다 */
export type MonsterTrait = 'plain' | 'sturdy' | 'swift'

/**
 * 성격마다 이름·약점 능력치·그 능력치를 올리는 활동·하는 일.
 * 약점은 지능·집중처럼 기본값을 넘은 만큼만 효과가 있어 운동만 한 말랑이의 전투는 그대로다
 */
export const TRAITS: Record<MonsterTrait, { name: string; icon: string; weakness: StatId | null; activity: ActivityId | null; tip: string }> = {
  plain: { name: '무난함', icon: '🙂', weakness: null, activity: null, tip: '고루 통해요' },
  sturdy: { name: '단단함', icon: '🪨', weakness: 'int', activity: 'study', tip: '치명타가 방어를 뚫어요' },
  swift: { name: '날쌤', icon: '💨', weakness: 'focus', activity: 'reading', tip: '집중이 높으면 덜 피해요' },
}

const SHAPE_TRAIT: Record<Exclude<MonsterShape, 'king'>, MonsterTrait> = {
  slime: 'plain',
  mushroom: 'sturdy',
  rock: 'sturdy',
  drop: 'swift',
  cloud: 'swift',
}

/** 모양과 장 번호로 성격. 보스(왕)는 홀수 장이면 단단함, 짝수 장이면 날쌤 */
export function shapeTrait(shape: MonsterShape, chapter: number): MonsterTrait {
  if (shape === 'king') return Math.max(1, Math.floor(chapter) || 1) % 2 === 1 ? 'sturdy' : 'swift'
  return SHAPE_TRAIT[shape]
}

/** 모험 지도에 보여 줄 힌트("약점: 🧠 지능"). 약점이 없으면 null */
export function weaknessHint(trait: MonsterTrait): string | null {
  const stat = STAT_INFO.find((s) => s.id === TRAITS[trait].weakness)
  return stat ? `약점: ${stat.icon} ${stat.name}` : null
}

/** 지도 칸·홈 몬스터 곁에 붙는 이름표("🪨 단단함 · 약점: 🧠 지능"). 무난함은 약점이 없어 붙이지 않는다 */
export function traitLabel(trait: MonsterTrait): string | null {
  const hint = weaknessHint(trait)
  return hint ? `${TRAITS[trait].icon} ${TRAITS[trait].name} · ${hint}` : null
}

/** 스테이지 번호의 몬스터 성격 */
export function stageTrait(no: number): MonsterTrait {
  return shapeTrait(stageMonsterLook(no).shape, chapterOf(no))
}

/**
 * 약점이 통한 공격에 띄울 글자. 단단한 상대의 방어를 뚫은 치명타는 "약점!",
 * 집중 덕분에 날쌘 상대를 맞힌 공격은 "명중!". 그 밖에는 null(보통 숫자·치명타 글자를 쓴다)
 */
export function weakHitText(step: Pick<BattleEvent, 'kind' | 'damage' | 'crit' | 'pierce' | 'aimed'>): string | null {
  if (step.kind !== 'hit') return null
  if (step.pierce) return `약점! -${step.damage}`
  if (step.aimed) return `명중! -${step.damage}`
  return null
}
