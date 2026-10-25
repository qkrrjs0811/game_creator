import type { Monster, MonsterShape } from './monsters'

/** 장이 올라갈수록 몬스터에 하나씩 더해지는 무늬·장식: 점무늬 → 리본 → 배 하트 → 반짝이 */
export type MonsterDecor = 'dots' | 'bow' | 'heart' | 'sparkle'
export const MONSTER_DECORS: MonsterDecor[] = ['dots', 'bow', 'heart', 'sparkle']

/** 장 번호(1부터)에 붙는 장식. 1장은 없고, 장마다 하나씩 늘어 5장부터 모두 두른다. 틀린 값은 1장으로 본다 */
export function monsterDecor(chapter: number): MonsterDecor[] {
  const c = Number.isFinite(chapter) && chapter >= 1 ? Math.floor(chapter) : 1
  return MONSTER_DECORS.slice(0, Math.min(MONSTER_DECORS.length, c - 1))
}

/** 몬스터가 나오는 장. 끝없는 스테이지 몬스터 id는 `c장-s순서`, 1장의 처음 몬스터들은 이름 id다 */
export function monsterChapter(m: Pick<Monster, 'id'>): number {
  const hit = /^c(\d+)-s/.exec(m.id)
  return hit ? Math.max(1, Number(hit[1])) : 1
}

/**
 * 모양마다 장식을 그릴 자리(몬스터 가운데 기준 x, y. 아래끝 y≈26).
 * 눈·입·볼터치·실루엣 특징을 피해 두고, 머리끝보다 위로 가지 않아 HP 막대에 닿지 않는다
 */
export const MONSTER_DECOR_SPOTS: Record<MonsterShape, Record<MonsterDecor, [number, number][]>> = {
  slime: { dots: [[-27, -10], [26, -16], [-15, 17]], bow: [[22, -26]], heart: [[2, 16]], sparkle: [[-46, -28], [46, -6]] },
  mushroom: { dots: [[-13, -28], [14, -21], [-31, -13]], bow: [[-27, -33]], heart: [[15, -29]], sparkle: [[-50, -28], [50, -10]] },
  drop: { dots: [[8, -22], [20, -5], [-9, 20]], bow: [[-9, -30]], heart: [[10, 20]], sparkle: [[-44, -2], [30, -36]] },
  cloud: { dots: [[-22, -10], [22, -12], [33, 9]], bow: [[-20, -18]], heart: [[0, 19]], sparkle: [[-48, -20], [26, -36]] },
  rock: { dots: [[4, -15], [-29, -2], [-14, 18]], bow: [[0, -22]], heart: [[9, 18]], sparkle: [[-46, -14], [42, -26]] },
  king: { dots: [[20, -20], [-33, -4], [31, 15]], bow: [[33, -14]], heart: [[0, 17]], sparkle: [[-52, -34], [52, -20]] },
}
