export interface Stage {
  no: number
  name: string
  icon: string
  boss: boolean
}

/**
 * 1장 앞쪽 스테이지 5개와 옛 보스의 이름. 끝없는 스테이지(`endless.ts`)가 1~5스테이지와 1장 보스 이름으로 다시 쓴다.
 * 예전에는 이 여섯 개가 전부였다
 */
export const STAGES: Stage[] = [
  { no: 1, name: '말랑 풀밭', icon: '🌱', boss: false },
  { no: 2, name: '버섯 숲', icon: '🍄', boss: false },
  { no: 3, name: '반짝 호숫가', icon: '💧', boss: false },
  { no: 4, name: '솜사탕 언덕', icon: '☁️', boss: false },
  { no: 5, name: '노을 바위산', icon: '⛰️', boss: false },
  { no: 6, name: '왕의 둥지', icon: '👑', boss: true },
]
