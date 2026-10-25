import type { Fighter } from './battle'

/** 장면이 몬스터를 그리는 방법. 모두 코드로 그린 둥근 도형이다 */
export type MonsterShape = 'slime' | 'mushroom' | 'drop' | 'cloud' | 'rock' | 'king'

export interface Monster {
  id: string
  name: string
  shape: MonsterShape
  /** 몸 색과 그늘 색(0xRRGGBB) */
  color: number
  shade: number
  boss: boolean
  stats: Omit<Fighter, 'name'>
}

/**
 * 1장 1~5스테이지와 보스의 몬스터 모습. 성격: 무난·단단·날쌤·고루·묵직·보스.
 * 실제 전투 값은 끝없는 스테이지 규칙(`endless.ts`)이 난이도 곡선에 맞춰 정하고, stats 는 예전 값이다
 */
export const MONSTERS: Monster[] = [
  { id: 'leaf', name: '풀잎 말랑', shape: 'slime', color: 0xa8e6a1, shade: 0x84cf7d, boss: false, stats: { hp: 26, atk: 6, def: 0, spd: 4, dodge: 0 } },
  { id: 'mushroom', name: '버섯 뽀짝', shape: 'mushroom', color: 0xff9fa8, shade: 0xf07a86, boss: false, stats: { hp: 40, atk: 8, def: 2, spd: 3, dodge: 0 } },
  { id: 'drop', name: '물방울 퐁', shape: 'drop', color: 0xa8d4ff, shade: 0x80b8f0, boss: false, stats: { hp: 46, atk: 11, def: 2, spd: 8, dodge: 0.15 } },
  { id: 'cloud', name: '솜사탕 뭉게', shape: 'cloud', color: 0xffc8e6, shade: 0xf0a6cf, boss: false, stats: { hp: 60, atk: 13, def: 3, spd: 6, dodge: 0.1 } },
  { id: 'rock', name: '바위 꿍', shape: 'rock', color: 0xd9c2a8, shade: 0xbfa486, boss: false, stats: { hp: 78, atk: 16, def: 6, spd: 4, dodge: 0 } },
  { id: 'king', name: '왕 말랑', shape: 'king', color: 0xc9a7ff, shade: 0xa985ea, boss: true, stats: { hp: 120, atk: 20, def: 6, spd: 8, dodge: 0.1 } },
]
