/** 이전 레벨보다 올랐으면 새 레벨, 아니면 null. 처음 본 레벨(prev 없음)은 축하하지 않는다 */
export function levelUpTo(prev: number | undefined, next: number): number | null {
  if (prev === undefined) return null
  return next > prev ? next : null
}

/**
 * 지난번 창에서 마지막으로 본 레벨(저장소에 남긴 글자)을 되살린다.
 * 앱을 닫아 둔 사이 타이머로 오른 레벨을 다시 열 때 축하하려고 쓴다.
 * 없거나 깨졌거나 지금보다 높으면 undefined(처음 본 것으로 두어 축하하지 않음).
 */
export function restoreShownLevel(stored: string | null, current: number): number | undefined {
  if (stored === null || !/^\d+$/.test(stored)) return undefined
  const level = Number(stored)
  return level >= 1 && level <= current ? level : undefined
}
