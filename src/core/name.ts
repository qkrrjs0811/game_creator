import type { SaveData } from './types'

/** 이름을 짓지 않았을 때 부르는 이름 */
export const DEFAULT_NAME = '말랑이'
/** 이름 글자 수 상한(이모지도 한 글자) */
export const NAME_MAX = 8

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'long' }

/** 앞뒤 빈칸을 빼고, 줄바꿈·제어 문자는 빈칸으로, 이어진 빈칸은 하나로 줄인 뒤 1~8자인지 본다 */
export function checkName(input: string): NameCheck {
  // eslint-disable-next-line no-control-regex
  const name = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  const length = Array.from(name).length
  if (length === 0) return { ok: false, reason: 'empty' }
  if (length > NAME_MAX) return { ok: false, reason: 'long' }
  return { ok: true, name }
}

/** 화면에 부르는 말랑이 이름 */
export function charName(save: Pick<SaveData, 'name'>): string {
  return save.name ?? DEFAULT_NAME
}

/** 이름을 짓는다. 틀린 이름이면 null. 기본 이름으로 되돌리면 저장에서 이름을 지운다 */
export function renameMalang(save: SaveData, input: string): SaveData | null {
  const r = checkName(input)
  if (!r.ok) return null
  const { name: _, ...rest } = save
  return r.name === DEFAULT_NAME ? rest : { ...rest, name: r.name }
}
