/**
 * 효과음 악보. 파일 없이 Web Audio로 코드에서 만든다. 소리만 정하고 전투 결과·성장 값은 바꾸지 않는다.
 * 귀여운 분위기에 맞게 둥근 소리(사인·삼각파) 위주로, 짧고 작게 낸다.
 */
export const SOUND_NAMES = ['hit', 'crit', 'miss', 'win', 'lose', 'levelup'] as const
export type SoundName = (typeof SOUND_NAMES)[number]

/** 소리 한 조각: at초에 freq(Hz)로 시작해 to(Hz)로 미끄러지며 dur초 동안 울린다 */
export interface Tone {
  at: number
  dur: number
  freq: number
  to?: number
  wave: 'sine' | 'triangle' | 'square'
  gain: number
}

// 도레미 높이(Hz)
const C5 = 523
const E5 = 659
const G5 = 784
const C6 = 1047
const E6 = 1319
const G4 = 392
const E4 = 330
const C4 = 262

const RECIPES: Record<SoundName, Tone[]> = {
  // 말랑한 "퐁": 낮게 떨어지는 둥근 소리와 짧은 딸깍
  hit: [
    { at: 0, dur: 0.12, freq: 320, to: 140, wave: 'sine', gain: 0.22 },
    { at: 0, dur: 0.04, freq: 900, to: 500, wave: 'triangle', gain: 0.08 },
  ],
  // 치명타: 더 크고 낮은 "쿵"에 반짝이는 높은 소리
  crit: [
    { at: 0, dur: 0.22, freq: 260, to: 90, wave: 'sine', gain: 0.28 },
    { at: 0, dur: 0.06, freq: 1200, to: 600, wave: 'triangle', gain: 0.1 },
    { at: 0.06, dur: 0.16, freq: E6, to: 1800, wave: 'sine', gain: 0.07 },
  ],
  // 회피: 위로 스치는 "휙"
  miss: [{ at: 0, dur: 0.14, freq: 500, to: 1400, wave: 'sine', gain: 0.09 }],
  // 승리: 도-미-솔-도 올라가는 가락
  win: [
    { at: 0, dur: 0.12, freq: C5, wave: 'triangle', gain: 0.16 },
    { at: 0.11, dur: 0.12, freq: E5, wave: 'triangle', gain: 0.16 },
    { at: 0.22, dur: 0.12, freq: G5, wave: 'triangle', gain: 0.16 },
    { at: 0.33, dur: 0.4, freq: C6, wave: 'triangle', gain: 0.18 },
  ],
  // 패배: 솔-미-도 천천히 내려가는 가락(무섭지 않게 작게)
  lose: [
    { at: 0, dur: 0.2, freq: G4, wave: 'triangle', gain: 0.12 },
    { at: 0.2, dur: 0.2, freq: E4, wave: 'triangle', gain: 0.12 },
    { at: 0.4, dur: 0.45, freq: C4, to: 220, wave: 'triangle', gain: 0.12 },
  ],
  // 레벨업: 빠르게 올라가는 반짝 가락
  levelup: [
    { at: 0, dur: 0.1, freq: G5, wave: 'sine', gain: 0.15 },
    { at: 0.08, dur: 0.1, freq: C6, wave: 'sine', gain: 0.15 },
    { at: 0.16, dur: 0.1, freq: E6, wave: 'sine', gain: 0.15 },
    { at: 0.26, dur: 0.5, freq: C6, to: 2093, wave: 'triangle', gain: 0.12 },
  ],
}

export function soundRecipe(name: SoundName): Tone[] {
  return RECIPES[name]
}

/** 소리가 끝나는 시각(초) */
export function soundLength(name: SoundName): number {
  return Math.max(...RECIPES[name].map((t) => t.at + t.dur))
}

/** 전투 한 걸음(맞음·빗나감, 치명타)의 소리 */
export function stepSound(kind: 'hit' | 'miss', crit: boolean): SoundName {
  if (kind === 'miss') return 'miss'
  return crit ? 'crit' : 'hit'
}

/** 효과음 켬·끔 저장 값. 기본은 켬 */
export function parseSoundOn(raw: string | null): boolean {
  return raw !== 'off'
}

export function serializeSoundOn(on: boolean): string {
  return on ? 'on' : 'off'
}
