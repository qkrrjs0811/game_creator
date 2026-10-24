import { ACTIVITIES } from './activities'
import { MINUTES_PER_STAT } from './progression'
import type { ActivityId, Progress, StatId } from './types'

export interface StatRow {
  id: StatId
  name: string
  icon: string
  value: number
  /** 이 능력치를 올리는 활동 이름. 아직 없으면 null */
  source: string | null
  /** 다음 +1까지 남은 인정 분. 올리는 활동이 없으면 null */
  toNext: number | null
  /** 올리는 활동이 모두 오늘 상한을 채워 내일부터 다시 오르는지 */
  tomorrow: boolean
}

export const STAT_INFO: { id: StatId; name: string; icon: string }[] = [
  { id: 'str', name: '힘', icon: '💪' },
  { id: 'vit', name: '체력', icon: '❤️' },
  { id: 'int', name: '지능', icon: '🧠' },
]

/** 화면에 보여 줄 능력치 줄. 값은 computeProgress 결과를 그대로 쓴다. cappedToday = 오늘 상한을 채운 활동 */
export function statRows(p: Progress, cappedToday: ActivityId[] = []): StatRow[] {
  const ids = Object.keys(ACTIVITIES) as ActivityId[]
  return STAT_INFO.map((s) => {
    const linked = ids.filter((id) => ACTIVITIES[id].stats.includes(s.id))
    if (linked.length === 0) return { ...s, value: p.stats[s.id], source: null, toNext: null, tomorrow: false }
    const minutes = linked.reduce((sum, id) => sum + p.creditedMinutes[id], 0)
    return {
      ...s,
      value: p.stats[s.id],
      source: linked.map((id) => ACTIVITIES[id].label).join('·'),
      toNext: MINUTES_PER_STAT - (minutes % MINUTES_PER_STAT),
      tomorrow: linked.every((id) => cappedToday.includes(id)),
    }
  })
}
