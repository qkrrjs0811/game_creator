import type { ActivityId, StatId } from './types'

/**
 * 활동마다 오르는 능력치·하루 상한·능력치가 1 오르는 데 드는 인정 분.
 * 공부·독서는 능력치 하나만 올려 운동(힘·체력 둘)보다 두 배 빨리 오른다. 분마다 오르는 능력치 수는 같다
 */
export const ACTIVITIES: Record<ActivityId, { label: string; dailyCapMinutes: number; stats: StatId[]; minutesPerStat: number }> = {
  exercise: { label: '운동', dailyCapMinutes: 180, stats: ['str', 'vit'], minutesPerStat: 10 },
  study: { label: '공부', dailyCapMinutes: 120, stats: ['int'], minutesPerStat: 5 },
  reading: { label: '독서', dailyCapMinutes: 120, stats: ['focus'], minutesPerStat: 5 },
}
