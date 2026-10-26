import type { BattleEvent } from './battle'
import { stepSkillFx, type SkillFxKind, type SkillStyle } from './skillfx'
import type { SkillId } from './skills'

/**
 * 스킬 발동 장면. 배운 스킬이 그 전투에서 처음 나갈 때 화면이 잠깐 어두워지고 이름 띠와 빛줄기가 지나간다.
 * 그림만 정하고 전투 결과·성장 값은 바꾸지 않는다
 */
export const SKILL_CUTIN_NAME: Record<SkillId, string> = {
  punch: '👊 말랑 펀치!',
  tough: '🛡️ 단단한 몸!',
  quick: '💨 날쌘 발!',
}

/** 스킬 연출이 어느 스킬에서 나오는지. 번개(지능)·집중 회피는 배우는 스킬이 아니다 */
const FX_SKILL: Partial<Record<SkillFxKind, SkillId>> = { fist: 'punch', dash: 'quick', blur: 'quick', shield: 'tough' }

/**
 * 전투 기록 걸음마다 처음 나가는 스킬(없으면 null). 스킬마다 전투에서 한 번뿐이고, 한 걸음엔 하나만 띄운다.
 * 한 걸음에 둘이 처음 나가면 앞의 것(그리는 순서상 날쌘 발 → 펀치 중 펀치를 먼저)을 띄우고 나머지는 다음에 나갈 때 띄운다
 */
export function skillDebuts(steps: Pick<BattleEvent, 'actor' | 'kind' | 'crit'>[], style: SkillStyle): (SkillId | null)[] {
  const shown = new Set<SkillId>()
  return steps.map((s, i) => {
    const fresh = stepSkillFx(s, style, i)
      .map((k) => FX_SKILL[k])
      .filter((id): id is SkillId => !!id && !shown.has(id))
    const pick = fresh.includes('punch') ? 'punch' : fresh[0] ?? null
    if (pick) shown.add(pick)
    return pick
  })
}

/** 발동 장면 시간(ms): 어두워짐 → 띠가 머묾 → 밝아짐. 걸음 사이 시간(delay) 안에 끝나 다음 걸음과 겹치지 않는다 */
export function skillCutinTiming(delay: number): { dim: number; hold: number; fade: number; dimAlpha: number } {
  const total = delay * 0.85
  return {
    dim: Math.round(total * 0.15),
    hold: Math.round(total * 0.55),
    fade: Math.round(total * 0.3),
    dimAlpha: 0.35,
  }
}
