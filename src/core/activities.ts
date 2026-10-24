import type { ActivityId, StatId } from './types'

export const ACTIVITIES: Record<ActivityId, { label: string; dailyCapMinutes: number; stats: StatId[] }> = {
  exercise: { label: '운동', dailyCapMinutes: 180, stats: ['str', 'vit'] },
}
