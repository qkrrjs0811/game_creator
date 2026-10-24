import { toSave } from './backup'
import { newSave } from './session'
import type { SaveData } from './types'

export const SAVE_KEY = 'growth-game:save'
export type KV = Pick<Storage, 'getItem' | 'setItem'>

/** 깨진 데이터는 버리지 않고 `:corrupt:<now>` 키로 옮겨 둔 뒤 새로 시작한다 */
export function loadSave(kv: KV, now: number): SaveData {
  let raw: string | null
  try {
    raw = kv.getItem(SAVE_KEY)
  } catch {
    return newSave()
  }
  if (raw === null) return newSave()
  try {
    const data = toSave(JSON.parse(raw))
    if (data) return data
  } catch {
    // 아래에서 보존 처리
  }
  try {
    kv.setItem(`${SAVE_KEY}:corrupt:${now}`, raw)
  } catch {
    // 보존도 못 하면 새로 시작만 한다
  }
  return newSave()
}

export function writeSave(kv: KV, save: SaveData): boolean {
  try {
    kv.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}
