/** 이전 레벨보다 올랐으면 새 레벨, 아니면 null. 처음 본 레벨(prev 없음)은 축하하지 않는다 */
export function levelUpTo(prev: number | undefined, next: number): number | null {
  if (prev === undefined) return null
  return next > prev ? next : null
}
