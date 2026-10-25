import type { MonsterShape } from './monsters'

/** 몬스터 표정: 기본·맞음·승리 */
export type MonsterFace = 'idle' | 'hurt' | 'win'
export const MONSTER_FACES: MonsterFace[] = ['idle', 'hurt', 'win']

/** 실루엣을 가르는 특징. 모양마다 겹치지 않게 둬서 그림자만 봐도 누군지 안다 */
export type MonsterFeature =
  | 'sprout'
  | 'drips'
  | 'cap'
  | 'stem'
  | 'point'
  | 'splash'
  | 'puffs'
  | 'wisp'
  | 'horns'
  | 'crack'
  | 'crown'
  | 'ears'

export const MONSTER_FEATURES: Record<MonsterShape, MonsterFeature[]> = {
  // 머리 위 새싹, 아래로 흘러내린 말랑 방울
  slime: ['sprout', 'drips'],
  // 넓은 갓과 짧은 기둥 다리
  mushroom: ['cap', 'stem'],
  // 뾰족한 머리와 옆으로 튀는 물방울
  drop: ['point', 'splash'],
  // 몽글몽글한 윗부분과 살랑이는 꼬리
  cloud: ['puffs', 'wisp'],
  // 작은 돌뿔과 금
  rock: ['horns', 'crack'],
  // 왕관과 동그란 귀
  king: ['crown', 'ears'],
}

/** 전투 한 걸음 동안의 몬스터 표정. 맞으면 맞음, 말랑이를 때리면 신남, 빗나가면 기본 */
export function monsterStepFace(step: { actor: 'player' | 'enemy'; kind: 'hit' | 'miss' }): MonsterFace {
  if (step.kind === 'miss') return 'idle'
  return step.actor === 'player' ? 'hurt' : 'win'
}

/** 전투가 끝난 뒤의 몬스터 표정. playerWin은 말랑이가 이겼는지 */
export function monsterEndFace(playerWin: boolean): MonsterFace {
  return playerWin ? 'hurt' : 'win'
}
