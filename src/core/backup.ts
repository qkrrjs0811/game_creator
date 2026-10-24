import { ACTIVITIES } from './activities'
import type { ActiveSession, ActivityId, ActivityRecord, SaveData } from './types'

export const BACKUP_APP = 'growth-game'

export type BackupResult = { ok: true; save: SaveData } | { ok: false }

export function exportBackup(save: SaveData, now: number): string {
  return JSON.stringify({ app: BACKUP_APP, exportedAt: now, save }, null, 2)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function backupFileName(now: number): string {
  const d = new Date(now)
  return `growth-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

/** 백업 파일(감싼 형식) 또는 저장 데이터 그대로를 받는다. 하나라도 틀리면 통째로 거절한다 */
export function parseBackup(text: string): BackupResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (isObject(data) && 'app' in data) {
    if (data.app !== BACKUP_APP) return { ok: false }
    data = data.save
  }
  const save = toSave(data)
  return save ? { ok: true, save } : { ok: false }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isActivity = (v: unknown): v is ActivityId => typeof v === 'string' && Object.hasOwn(ACTIVITIES, v)
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

function toRecord(v: unknown): ActivityRecord | null {
  if (!isObject(v)) return null
  const { id, activity, startedAt, endedAt } = v
  if (typeof id !== 'string' || !isActivity(activity) || !isTime(startedAt) || !isTime(endedAt)) return null
  // 시계가 뒤로 간 기록은 거절하지 않고 길이 0으로 바로잡는다(백업 전체를 못 쓰게 되지 않게)
  return { id, activity, startedAt, endedAt: Math.max(startedAt, endedAt) }
}

function toActive(v: unknown): ActiveSession | null | undefined {
  if (v === null) return null
  if (!isObject(v) || !isActivity(v.activity) || !isTime(v.startedAt)) return undefined
  return { activity: v.activity, startedAt: v.startedAt }
}

/** 저장 데이터 형식을 엄격하게 확인한다. 틀리면 null */
export function toSave(v: unknown): SaveData | null {
  if (!isObject(v) || v.version !== 1 || !Array.isArray(v.records)) return null
  const records = v.records.map(toRecord)
  if (records.some((r) => r === null)) return null
  const active = toActive(v.active)
  if (active === undefined) return null
  const { skills, stageProgress, cosmetics } = v
  if (!isStringList(skills) || !isStringList(cosmetics)) return null
  if (!Number.isInteger(stageProgress) || (stageProgress as number) < 0) return null
  // 입은 꾸미기는 나중에 생긴 필드라 없으면 아무것도 안 입은 것으로 본다
  const worn = v.worn === undefined ? [] : v.worn
  if (!isStringList(worn)) return null
  return {
    version: 1,
    records: records as ActivityRecord[],
    active,
    skills: [...skills],
    stageProgress: stageProgress as number,
    cosmetics: [...cosmetics],
    worn: [...worn],
  }
}
