export interface Stage {
  no: number
  name: string
  icon: string
  boss: boolean
}

/** 스테이지 5개와 마지막 보스. 스테이지마다 나오는 몬스터는 `monsters.ts`에 있다 */
export const STAGES: Stage[] = [
  { no: 1, name: '말랑 풀밭', icon: '🌱', boss: false },
  { no: 2, name: '버섯 숲', icon: '🍄', boss: false },
  { no: 3, name: '반짝 호숫가', icon: '💧', boss: false },
  { no: 4, name: '솜사탕 언덕', icon: '☁️', boss: false },
  { no: 5, name: '노을 바위산', icon: '⛰️', boss: false },
  { no: 6, name: '왕의 둥지', icon: '👑', boss: true },
]

export type StageState = 'cleared' | 'open' | 'locked'

/** stageProgress = 깬 스테이지 수. 깬 스테이지와 바로 다음 스테이지는 언제든 도전할 수 있다 */
export function isStageOpen(stageProgress: number, no: number): boolean {
  return no >= 1 && no <= STAGES.length && no <= Math.max(0, stageProgress) + 1
}

export function stageList(stageProgress: number): (Stage & { state: StageState })[] {
  return STAGES.map((s) => ({
    ...s,
    state: s.no <= stageProgress ? 'cleared' : isStageOpen(stageProgress, s.no) ? 'open' : 'locked',
  }))
}
