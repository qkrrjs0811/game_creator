import type { ReplayStep } from './replay'

/**
 * 한 번의 타격 연출 값(손맛). 그림만 정하고 전투 결과·성장 값은 바꾸지 않는다.
 * 순서: 뒤로 움츠림(windup) → 앞으로 튀어 나감(lunge) → 부딪힘 → 멈춤(hitstop) → 밀리고 돌아옴(back)
 */
export interface Impact {
  /** 움츠리는 시간(ms)과 거리(px) */
  windup: number
  pull: number
  /** 튀어 나가는 시간(ms)과 거리(px). 이 끝에 부딪힌다 */
  lunge: number
  reach: number
  /** 부딪힌 뒤 두 쪽이 멈춰 있는 시간(ms). 빗나가면 0 */
  hitstop: number
  /** 맞은 쪽이 밀려났다 돌아오고 때린 쪽이 제자리로 오는 시간(ms) */
  back: number
  /** 맞은 쪽이 하얗게 번쩍이는지 */
  flash: boolean
  /** 맞은 쪽이 밀리는 거리(px)와 찌그러지는 정도(세로가 이만큼 줄고 가로가 늘어난다) */
  knock: number
  squash: number
  /** 튀는 별·조각 수 */
  sparks: number
  /** 화면 흔들림 시간(ms)과 세기(px). 치명타만 */
  shake: number
  shakePx: number
  /** 진동 시간(ms). 치명타만 */
  vibrate: number
}

/** 걸음 사이가 이만큼이면 움직임을 줄이지 않는다 */
const FULL_SPEED_DELAY = 600
/** 걸음이 짧아도 움직임은 이 배율 아래로 빨라지지 않는다 */
const MIN_SPEED = 0.4
const HITSTOP = 65
const CRIT_HITSTOP = 95
/** 치명타는 이만큼 천천히 밀려나 잠깐 느려진 것처럼 보인다 */
const CRIT_SLOW = 1.4

/** 마지막 한 방은 이만큼 느린 동작으로 움직인다 */
const FINAL_SLOW = 2
const FINAL_HITSTOP = 200
const FINAL_CRIT_HITSTOP = 240
/** 보통 걸음 뒤 결과를 보여 주기까지(ms) */
const FINISH_AFTER = 700
/** 마지막 한 방이 끝나고 진 쪽이 납작해지며 사라지는 걸 볼 시간(ms) */
const FAINT_TIME = 450

/** 마지막 걸음에서 맞은 쪽이 쓰러졌으면 마지막 한 방이다. 오래 끌어 진 판의 마지막 걸음은 아니다 */
export function isFinalBlow(step: Pick<ReplayStep, 'kind' | 'targetHp'>, last: boolean): boolean {
  return last && step.kind === 'hit' && step.targetHp <= 0
}

/**
 * 한 걸음(걸음 사이 delay ms)에 들어갈 타격 연출. 전투 기록의 한 줄(맞음·빗나감, 치명타)로 정해진다.
 * 마지막 한 방(final)은 다음 걸음이 없으니 걸음 사이를 넘겨 느린 동작으로 크게 보여 준다
 */
export function hitImpact(kind: 'hit' | 'miss', crit: boolean, delay: number, final = false): Impact {
  const f = Math.min(1, Math.max(MIN_SPEED, delay / FULL_SPEED_DELAY))
  const hit = kind === 'hit'
  const big = hit && crit
  if (hit && final) {
    const s = f * FINAL_SLOW
    return {
      windup: Math.round(90 * s),
      pull: 14,
      lunge: Math.round(70 * s),
      reach: 52,
      hitstop: crit ? FINAL_CRIT_HITSTOP : FINAL_HITSTOP,
      back: Math.round(140 * s * (crit ? CRIT_SLOW : 1)),
      flash: true,
      knock: crit ? 34 : 28,
      squash: crit ? 0.34 : 0.3,
      sparks: crit ? 16 : 13,
      shake: 260,
      shakePx: 8,
      vibrate: 60,
    }
  }
  return {
    windup: Math.round(90 * f),
    pull: 8,
    lunge: Math.round(70 * f),
    reach: 46,
    hitstop: hit ? (big ? CRIT_HITSTOP : HITSTOP) : 0,
    back: Math.round(140 * f * (big ? CRIT_SLOW : 1)),
    flash: hit,
    knock: hit ? (big ? 18 : 10) : 0,
    squash: hit ? (big ? 0.2 : 0.12) : 0,
    sparks: hit ? (big ? 9 : 5) : 0,
    shake: big ? 160 : 0,
    shakePx: big ? 5 : 0,
    vibrate: big ? 30 : 0,
  }
}

/** 걸음을 시작하고 부딪히기까지(ms) */
export function contactAt(i: Impact): number {
  return i.windup + i.lunge
}

/** 한 번의 타격 연출이 모두 끝나기까지(ms) */
export function impactLength(i: Impact): number {
  return contactAt(i) + i.hitstop + i.back
}

/** 마지막 걸음을 시작하고 결과(승패 포즈·결과 카드)로 넘어가기까지(ms). 마지막 한 방이면 그 연출을 다 보여 준 뒤 */
export function finishDelay(i: Impact): number {
  return Math.max(FINISH_AFTER, impactLength(i) + FAINT_TIME)
}

/**
 * HP 막대 뒤의 옅은 막대: 깎인 만큼 앞 막대가 바로 줄면, 옅은 막대는 잠깐(wait ms) 남았다가
 * 깎인 양(drop, 0~1)에 따라 천천히(duration ms) 따라 줄어든다
 */
export function hpTrail(drop: number): { wait: number; duration: number } {
  const d = Math.min(1, Math.max(0, drop))
  return { wait: 180, duration: Math.round(240 + 600 * d) }
}
