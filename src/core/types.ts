export type ActivityId = 'exercise'
export type StatId = 'str' | 'vit' | 'int'

/** 시각은 모두 epoch ms */
export interface ActivityRecord {
  id: string
  activity: ActivityId
  startedAt: number
  endedAt: number
}

export interface ActiveSession {
  activity: ActivityId
  startedAt: number
}

export interface SaveData {
  version: 1
  records: ActivityRecord[]
  active: ActiveSession | null
  skills: string[]
  stageProgress: number
  cosmetics: string[]
}

export interface Progress {
  creditedMinutes: Record<ActivityId, number>
  exp: number
  level: number
  expIntoLevel: number
  expForNextLevel: number
  stats: Record<StatId, number>
  skillPoints: number
}
