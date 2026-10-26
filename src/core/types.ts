export type ActivityId = 'exercise' | 'study' | 'reading' | 'relax'
export type StatId = 'str' | 'vit' | 'int' | 'focus'

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
  /** 입은 꾸미기 id(종류마다 하나). 이전 형식에는 없어서 읽을 때 []로 채운다 */
  worn: string[]
  /** 지은 말랑이 이름(1~8자). 짓지 않았거나 이전 형식이면 없다(말랑이로 부른다) */
  name?: string
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
