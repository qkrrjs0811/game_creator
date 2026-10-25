import type { ActiveSession } from './types'

/**
 * 집중 목표: 타이머를 켤 때 고르는 "이번엔 25분" 같은 목표 분. 0 = 없음.
 * 보여 줄 값일 뿐 경험치·능력치·상한은 그대로다(실제로 켜 둔 시간만 기록된다)
 */
export const FOCUS_TARGETS = [0, 15, 25, 45, 60] as const

const MINUTE = 60_000

const isTarget = (n: unknown): n is number => typeof n === 'number' && (FOCUS_TARGETS as readonly number[]).includes(n)

export interface FocusProgress {
  target: number
  /** 켠 뒤 지난 분(내림). 목표를 넘겨도 계속 센다 */
  elapsedMinutes: number
  /** 목표까지 남은 분(올림). 닿으면 0 */
  remainingMinutes: number
  /** 진행 막대 0~1 */
  ratio: number
  reached: boolean
}

/** 목표 분과 켜 둔 타이머 시작 시각으로 지금의 진행. 목표가 없거나 고를 수 없는 값이면 null */
export function focusProgress(target: number, startedAt: number, now: number): FocusProgress | null {
  if (!isTarget(target) || target === 0) return null
  const elapsedMs = Math.max(0, now - startedAt)
  const targetMs = target * MINUTE
  return {
    target,
    elapsedMinutes: Math.floor(elapsedMs / MINUTE),
    remainingMinutes: Math.max(0, Math.ceil((targetMs - elapsedMs) / MINUTE)),
    ratio: Math.min(1, elapsedMs / targetMs),
    reached: elapsedMs >= targetMs,
  }
}

/** 보조 키에 두는 값: 어느 타이머(시작 시각)에 고른 목표인지 */
export interface FocusGoal {
  startedAt: number
  minutes: number
}

export function serializeFocusGoal(goal: FocusGoal): string {
  return JSON.stringify({ startedAt: goal.startedAt, minutes: goal.minutes })
}

/** 없거나 깨졌거나 모양이 틀리면 null */
export function parseFocusGoal(raw: string | null): FocusGoal | null {
  if (raw === null) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
    const { startedAt, minutes } = v as Record<string, unknown>
    if (typeof startedAt !== 'number' || !Number.isFinite(startedAt) || !isTarget(minutes)) return null
    return { startedAt, minutes }
  } catch {
    return null
  }
}

/** 켜 둔 타이머의 목표 분. 다른(이전) 타이머에 고른 목표면 없음(0) */
export function focusTargetFor(goal: FocusGoal | null, active: ActiveSession | null): number {
  if (!goal || !active || goal.startedAt !== active.startedAt) return 0
  return goal.minutes
}

/**
 * 목표 달성 배지를 지금 띄울지. 축하한 타이머의 시작 시각(보조 키 값)과 다르면 아직 축하하지 않은 것이다.
 * 닫아 둔 사이 닿았어도 다시 열 때 한 번만 띄운다
 */
export function focusCelebrateNow(p: FocusProgress | null, active: ActiveSession | null, celebratedRaw: string | null): boolean {
  if (!p || !active || !p.reached) return false
  return celebratedRaw !== String(active.startedAt)
}

/** 다음에 켤 때 먼저 골라 둘 목표 분. 고를 수 없는 값이면 없음(0) */
export function parseFocusDefault(raw: string | null): number {
  if (raw === null || raw.trim() === '') return 0
  const n = Number(raw)
  return isTarget(n) ? n : 0
}
