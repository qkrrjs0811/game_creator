import type { SaveData } from './types'

export type SkillId = 'punch' | 'tough' | 'quick'

export interface Skill {
  id: SkillId
  name: string
  icon: string
  desc: string
}

/** 전투에서 쓰는 스킬 3종. 같은 스킬을 여러 번 배우면 단계가 오른다 */
export const SKILLS: Skill[] = [
  { id: 'punch', name: '말랑 펀치', icon: '👊', desc: '힘을 실어 더 세게 때려요' },
  { id: 'tough', name: '단단한 몸', icon: '🛡️', desc: '맞아도 덜 아파요' },
  { id: 'quick', name: '날쌘 발', icon: '💨', desc: '먼저 움직이고 가끔 피해요' },
]

const isSkillId = (v: string): v is SkillId => SKILLS.some((s) => s.id === v)

/** 남은 포인트 = 레벨 - 1 - 배운 스킬 수 (0 아래로는 내려가지 않음) */
export function remainingSkillPoints(level: number, skills: string[]): number {
  return Math.max(0, level - 1 - skills.length)
}

/** 스킬별 배운 횟수(단계). 모르는 이름은 세지 않는다 */
export function skillRanks(skills: string[]): Record<SkillId, number> {
  const ranks = Object.fromEntries(SKILLS.map((s) => [s.id, 0])) as Record<SkillId, number>
  for (const id of skills) if (isSkillId(id)) ranks[id]++
  return ranks
}

/** 포인트 하나를 써서 스킬을 배운 새 저장. 포인트가 없거나 없는 스킬이면 null */
export function learnSkill(save: SaveData, level: number, id: string): SaveData | null {
  if (!isSkillId(id) || remainingSkillPoints(level, save.skills) < 1) return null
  return { ...save, skills: [...save.skills, id] }
}
