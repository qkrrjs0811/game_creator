import type { ActivityId } from './types'

/** 말랑이 기분: 쉬는 중(타이머 꺼짐), 같이 운동·공부·독서·휴식 중, 오늘 상한을 채워 쉬어도 되는 중 */
export type Mood = 'rest' | 'exercise' | 'study' | 'reading' | 'relax' | 'full'

/** 말랑이 표정: 기본·눈 깜빡임·기쁨·맞음·집중·승리·졸림 */
export type Face = 'idle' | 'blink' | 'happy' | 'hurt' | 'focus' | 'win' | 'sleepy'
export const FACES: Face[] = ['idle', 'blink', 'happy', 'hurt', 'focus', 'win', 'sleepy']

/** 눈을 감고 있는 시간(ms) */
export const BLINK_MS = 130
/** 말랑이를 누른 뒤 기뻐하는 시간(ms) */
export const HAPPY_MS = 700

/** 전투가 아닐 때의 표정. 활동 중이면 지금 하는 일을, 쉬는 중이면 많이 한 활동 특징(휴식은 졸린 눈)을 따른다 */
export function moodFace(mood: Mood, traits: ActivityId[]): Face {
  switch (mood) {
    case 'exercise':
    case 'study':
    case 'reading':
      return 'focus'
    case 'relax':
      return 'sleepy'
    case 'full':
      return 'happy'
    case 'rest':
      return traits.includes('relax') ? 'sleepy' : 'idle'
  }
}

/** 전투 한 걸음 동안의 표정. 때릴 땐 집중, 맞으면 맞음, 피하면 기쁨 */
export function stepFace(step: { actor: 'player' | 'enemy'; kind: 'hit' | 'miss' }): Face {
  if (step.actor === 'player') return 'focus'
  return step.kind === 'hit' ? 'hurt' : 'happy'
}

/** 전투가 끝난 뒤의 표정 */
export function endFace(win: boolean): Face {
  return win ? 'win' : 'hurt'
}

/** 눈을 뜬 표정만 깜빡인다 */
export function canBlink(face: Face): boolean {
  return face === 'idle' || face === 'focus'
}

/** n번째 깜빡임 다음까지 기다리는 시간(ms). 몇 초마다, 가끔은 짧게 한 번 더(두 번 깜빡임) */
const BLINK_GAPS = [3200, 2600, 4100, 320, 3600, 2900, 4600, 2400, 360, 3800]
export function blinkGap(n: number): number {
  return BLINK_GAPS[((n % BLINK_GAPS.length) + BLINK_GAPS.length) % BLINK_GAPS.length]
}

/** 지금 보여 줄 표정. 눌린 뒤 잠깐은 기쁨, 깜빡이는 동안은 감은 눈, 아니면 기본 표정 */
export function pickFace(base: Face, at: { now: number; happyUntil?: number; blinkUntil?: number }): Face {
  const open = canBlink(base)
  if (open && at.now < (at.happyUntil ?? -Infinity)) return 'happy'
  if (open && at.now < (at.blinkUntil ?? -Infinity)) return 'blink'
  return base
}
