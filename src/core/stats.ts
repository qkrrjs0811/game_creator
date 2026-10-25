import { ACTIVITIES } from './activities'
import type { ActivityId, Progress, StatId } from './types'

export interface StatRow {
  id: StatId
  name: string
  icon: string
  /** 전투에서 하는 일 */
  role: string
  value: number
  /** 이 능력치를 올리는 활동 이름. 아직 없으면 null */
  source: string | null
  /** 다음 +1까지 남은 인정 분. 올리는 활동이 없으면 null */
  toNext: number | null
  /** 올리는 활동이 모두 오늘 상한을 채워 내일부터 다시 오르는지 */
  tomorrow: boolean
}

export const STAT_INFO: { id: StatId; name: string; icon: string; role: string }[] = [
  { id: 'str', name: '힘', icon: '💪', role: '공격' },
  { id: 'vit', name: '체력', icon: '❤️', role: 'HP·방어' },
  { id: 'int', name: '지능', icon: '🧠', role: '치명타·두루' },
  { id: 'focus', name: '집중', icon: '🎯', role: '회피·두루' },
]

/** 화면에 보여 줄 능력치 줄. 값은 computeProgress 결과를 그대로 쓴다. cappedToday = 오늘 상한을 채운 활동 */
export function statRows(p: Progress, cappedToday: ActivityId[] = []): StatRow[] {
  const ids = Object.keys(ACTIVITIES) as ActivityId[]
  return STAT_INFO.map((s) => {
    const linked = ids.filter((id) => ACTIVITIES[id].stats.includes(s.id))
    if (linked.length === 0) return { ...s, value: p.stats[s.id], source: null, toNext: null, tomorrow: false }
    // 활동마다 따로 내림해 오르므로, 오늘 더 할 수 있는 첫 활동(운동이 먼저)의 분으로 센다
    const next = linked.find((id) => !cappedToday.includes(id)) ?? linked[0]
    const per = ACTIVITIES[next].minutesPerStat
    return {
      ...s,
      value: p.stats[s.id],
      source: ACTIVITIES[next].label,
      toNext: per - (p.creditedMinutes[next] % per),
      tomorrow: linked.every((id) => cappedToday.includes(id)),
    }
  })
}
