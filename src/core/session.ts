import type { ActivityId, ActivityRecord, SaveData } from './types'

export function newSave(): SaveData {
  return { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [] }
}

/** 이미 진행 중이면 같은 객체를 그대로 돌려준다 */
export function startSession(save: SaveData, activity: ActivityId, now: number): SaveData {
  if (save.active) return save
  return { ...save, active: { activity, startedAt: now } }
}

export function stopSession(save: SaveData, now: number): SaveData {
  if (!save.active) return save
  return { ...save, active: null, records: [...save.records, toRecord(save.active.activity, save.active.startedAt, now)] }
}

/** 진행 중인 세션을 now 까지의 기록으로 포함한 목록 */
export function liveRecords(save: SaveData, now: number): ActivityRecord[] {
  if (!save.active) return save.records
  return [...save.records, toRecord(save.active.activity, save.active.startedAt, now)]
}

function toRecord(activity: ActivityId, startedAt: number, endedAt: number): ActivityRecord {
  return { id: `${activity}-${startedAt}`, activity, startedAt, endedAt }
}
