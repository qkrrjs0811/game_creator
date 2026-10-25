import { BASE_STAT } from './progression'
import { MAX_FOCUS_DODGE, QUICK_DODGE, type BattleEvent } from './battle'
import type { Impact } from './impact'
import { skillRanks } from './skills'
import type { StatId } from './types'

/**
 * 전투에서 스킬이 보이는 연출. 그림만 정하고 전투 결과·성장 값은 바꾸지 않는다.
 * fist: 말랑 펀치 주먹 궤적, dash: 날쌘 발로 튀어 나갈 때 잔상, bolt: 지능 치명타 번개,
 * shield: 단단한 몸 방패 반짝임, blur: 날쌘 발로 피한 잔상, calm: 집중으로 피한 잔상
 */
export type SkillFxKind = 'fist' | 'dash' | 'bolt' | 'shield' | 'blur' | 'calm'

/** 연출 이름(e2e·기록용) */
export const SKILL_FX: Record<SkillFxKind, string> = {
  fist: '말랑 펀치',
  dash: '날쌘 발',
  bolt: '번뜩 치명타',
  shield: '단단한 몸',
  blur: '날쌘 발 회피',
  calm: '집중 회피',
}

/** 말랑이가 전투에서 보여 줄 스킬: 배운 단계와 회피가 날쌘 발·집중에서 얼마씩 오는지 */
export interface SkillStyle {
  punch: number
  tough: number
  quick: number
  quickDodge: number
  focusDodge: number
}

export function skillStyle(stats: Record<StatId, number>, skills: string[]): SkillStyle {
  const r = skillRanks(skills)
  const calm = Math.max(0, stats.focus - BASE_STAT)
  return {
    punch: r.punch,
    tough: r.tough,
    quick: r.quick,
    quickDodge: r.quick * QUICK_DODGE,
    focusDodge: Math.min(MAX_FOCUS_DODGE, calm * 0.01),
  }
}

/** 걸음 번호로 정해지는 0~1 값(황금비). 같은 걸음은 늘 같은 잔상을 고른다 */
const spread = (index: number) => (index * 0.6180339887498949) % 1

/** 전투 기록 한 줄(index 번째 걸음)에 보일 스킬 연출. 그리는 순서대로 */
export function stepSkillFx(step: Pick<BattleEvent, 'actor' | 'kind' | 'crit'>, style: SkillStyle, index: number): SkillFxKind[] {
  const out: SkillFxKind[] = []
  if (step.actor === 'player') {
    if (style.quick > 0) out.push('dash')
    if (step.kind === 'hit' && style.punch > 0) out.push('fist')
    if (step.kind === 'hit' && step.crit) out.push('bolt')
    return out
  }
  if (step.kind === 'hit') return style.tough > 0 ? ['shield'] : []
  const dodge = style.quickDodge + style.focusDodge
  if (dodge <= 0) return []
  return [spread(index) < style.quickDodge / dodge ? 'blur' : 'calm']
}

/** 스킬 단계가 오를수록 연출이 조금씩 커진다(1.5배까지) */
export function skillFxSize(rank: number): number {
  return Math.min(1.5, 1 + 0.12 * Math.max(0, rank - 1))
}

/**
 * 걸음을 시작하고 연출이 시작되기까지(start ms)와 보이는 시간(duration ms).
 * 모두 그 걸음의 타격 연출 안에 끝나 다음 걸음과 겹치지 않는다
 */
export function skillFxTiming(kind: SkillFxKind, fx: Impact): { start: number; duration: number } {
  const contact = fx.windup + fx.lunge
  switch (kind) {
    case 'fist':
      return { start: fx.windup, duration: fx.lunge + fx.hitstop + Math.round(fx.back / 2) }
    case 'dash':
      return { start: fx.windup, duration: fx.lunge + Math.round(fx.back / 2) }
    case 'bolt': {
      // 번개가 위에서 내리꽂혀 부딪히는 순간에 닿는다
      const lead = Math.min(60, fx.lunge)
      return { start: contact - lead, duration: lead + fx.hitstop + Math.round(fx.back * 0.6) }
    }
    case 'shield':
      return { start: contact, duration: fx.hitstop + fx.back }
    case 'blur':
    case 'calm':
      return { start: contact, duration: fx.back }
  }
}
