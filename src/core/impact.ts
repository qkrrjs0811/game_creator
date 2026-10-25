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

/** 한 걸음(걸음 사이 delay ms)에 들어갈 타격 연출. 전투 기록의 한 줄(맞음·빗나감, 치명타)로 정해진다 */
export function hitImpact(kind: 'hit' | 'miss', crit: boolean, delay: number): Impact {
  const f = Math.min(1, Math.max(MIN_SPEED, delay / FULL_SPEED_DELAY))
  const hit = kind === 'hit'
  const big = hit && crit
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
