import type { SessionGain } from '../core/gain'
import { STAT_INFO } from '../core/stats'
import { ACTIVITIES } from '../core/activities'
import type { ActivityId } from '../core/types'
import type { TodayGoal } from '../core/goal'

const pad =(n: number) => String(n).padStart(2, '0')

/** 한 시간 미만은 MM:SS, 이상은 H:MM:SS */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 한 시간 미만은 N분, 이상은 N시간 M분 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code < 11172 && code % 28 !== 0
}

/** 낱말 끝 글자에 받침이 있으면 "을", 없으면 "를"(운동을 · 공부를) */
export const objectJosa = (word: string) => (hasBatchim(word) ? '을' : '를')
/** 받침이 있으면 "은", 없으면 "는"(운동은 · 공부는) */
export const topicJosa = (word: string) => (hasBatchim(word) ? '은' : '는')

/** 홈 타이머 카드의 하루 목표 글자. 30분을 넘겨도 실제 분을 보여 준다 */
export function goalText(g: TodayGoal): string {
  return g.done ? `🌟 오늘 목표 달성 ${g.minutes} / ${g.goal}분` : `🎯 오늘 목표 ${g.minutes} / ${g.goal}분`
}

/**
 * 활동을 그만둘 때 띄우는 요약. capReached = 오늘 상한에 닿았는지.
 * 안내는 폰 폭에서 한 줄에 들어가게 짧게 쓴다(두 줄이면 카드가 길어져 말랑이를 가린다)
 */
export function sessionSummary(g: SessionGain, capReached: boolean, activity: ActivityId = 'exercise'): { title: string; detail: string } {
  const name = ACTIVITIES[activity].label
  const title = g.minutes > 0 ? `🎉 ${name} ${formatMinutes(g.minutes)} 했어요!` : `🎉 ${name}${objectJosa(name)} 마쳤어요!`
  if (g.exp <= 0) {
    return { title, detail: capReached ? '상한을 채워서 경험치는 내일 쌓여요' : '1분 넘게 하면 경험치가 쌓여요' }
  }
  const stats = STAT_INFO.filter((s) => g.stats[s.id] > 0).map((s) => `${s.icon} ${s.name} +${g.stats[s.id]}`)
  return { title, detail: [`EXP +${g.exp}`, ...stats].join(' · ') }
}
