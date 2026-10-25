import type { MonsterShape } from './monsters'
import { contactAt, type Impact } from './impact'

/**
 * 몬스터 몸의 움직임(그림만). 몸은 가운데(0,0)를 기준으로 늘고 줄어드니,
 * 아래끝(MONSTER_BOTTOM)이 땅에 붙어 있게 poseY가 줄어든 만큼 내려 준다
 */
export const MONSTER_BOTTOM = 26
/** 몸 그림 기준으로 위 HP 막대(테두리 포함)의 아래끝 바로 밑. 뛰어올라도 머리가 여기를 넘지 않는다 */
export const ATTACK_CEILING = -64

/** 한 자세: 뜬 높이(lift, 위가 -), 기울기(도, 왼쪽=앞으로 숙임이 -), 가로·세로 배율 */
export interface Pose {
  lift: number
  angle: number
  sx: number
  sy: number
}

/** 몸 그림을 둘 y. 세로로 줄면 아래끝이 뜨지 않게 그만큼 내린다 */
export function poseY(p: Pose): number {
  return p.lift + MONSTER_BOTTOM * (1 - p.sy)
}

/** 제자리·제모양 */
export const REST_POSE: Pose = { lift: 0, angle: 0, sx: 1, sy: 1 }
const pose = (p: Partial<Pose>): Pose => ({ ...REST_POSE, ...p })

export type IdleKind = 'squish' | 'sway' | 'bounce' | 'float' | 'shiver' | 'puff'

/** 가만히 있을 때: 제자리에서 pose까지 갔다가 돌아오기를 되풀이한다. rest는 되풀이 사이에 쉬는 시간(ms) */
export interface IdleMotion {
  kind: IdleKind
  pose: Pose
  duration: number
  rest: number
}

export const MONSTER_IDLE: Record<MonsterShape, IdleMotion> = {
  // 말랑 방울이 납작해졌다 펴진다
  slime: { kind: 'squish', pose: pose({ sx: 1.08, sy: 0.9 }), duration: 700, rest: 0 },
  // 갓이 좌우로 살랑 흔들린다
  mushroom: { kind: 'sway', pose: pose({ angle: 7 }), duration: 1300, rest: 0 },
  // 통통 튀고 잠깐 쉰다
  drop: { kind: 'bounce', pose: pose({ lift: -7, sx: 0.97, sy: 1.04 }), duration: 360, rest: 500 },
  // 둥실 떠서 살짝 기운다
  cloud: { kind: 'float', pose: pose({ lift: -7, angle: -3 }), duration: 1800, rest: 0 },
  // 가만히 있다가 가끔 부르르 떤다
  rock: { kind: 'shiver', pose: pose({ angle: 3 }), duration: 80, rest: 1800 },
  // 가슴을 펴듯 천천히 부풀었다 돌아온다
  king: { kind: 'puff', pose: pose({ sx: 0.97, sy: 1.06 }), duration: 1500, rest: 0 },
}

export type AttackKind = 'headbutt' | 'hop' | 'dash' | 'swoop' | 'roll' | 'slam'

/**
 * 공격 동작: 움츠림(windup) 자세 하나와, 튀어 나가는 동안(lunge) 지날 자세들.
 * 튀어 나가는 동안의 자세는 시간을 똑같이 나눠 지나고, 마지막 자세에서 부딪힌다
 */
export interface AttackMotion {
  kind: AttackKind
  windup: Pose
  lunge: Pose[]
}

export const MONSTER_ATTACK: Record<MonsterShape, AttackMotion> = {
  // 고개를 젖혔다가 머리로 들이받는다
  slime: { kind: 'headbutt', windup: pose({ angle: 12, sx: 0.94, sy: 1.08 }), lunge: [pose({ angle: -22, sx: 1.1, sy: 0.92 })] },
  // 쪼그려 앉았다가 튀어 올라 갓으로 내려찍는다
  mushroom: {
    kind: 'hop',
    windup: pose({ sx: 1.12, sy: 0.82 }),
    lunge: [pose({ lift: -14, angle: -8, sx: 0.94, sy: 1.08 }), pose({ angle: -10, sx: 1.1, sy: 0.9 })],
  },
  // 몸을 길게 늘여 쏜살같이 찌른다
  drop: { kind: 'dash', windup: pose({ sx: 0.86, sy: 1.12 }), lunge: [pose({ angle: -6, sx: 1.3, sy: 0.78 })] },
  // 위로 둥실 떴다가 아래로 휙 내려온다
  cloud: { kind: 'swoop', windup: pose({ lift: -12, angle: 10, sx: 1.05, sy: 0.95 }), lunge: [pose({ angle: -14, sx: 1.12, sy: 0.9 })] },
  // 뒤로 기울었다가 데굴 한 바퀴 굴러 부딪힌다
  rock: { kind: 'roll', windup: pose({ angle: 20, sx: 1.08, sy: 0.9 }), lunge: [pose({ angle: -360 })] },
  // 무겁게 웅크렸다가 살짝 뛰어 쿵 내려앉는다
  king: {
    kind: 'slam',
    windup: pose({ sx: 1.12, sy: 0.84 }),
    lunge: [pose({ lift: -8 }), pose({ angle: -6, sx: 1.14, sy: 0.86 })],
  },
}

/** 공격 동작을 한 번의 타격 시간(fx)에 맞춘 구간들. 모두 지나면 바로 부딪히는 때(contactAt)다 */
export function attackPlan(shape: MonsterShape, fx: Impact): { pose: Pose; duration: number }[] {
  const m = MONSTER_ATTACK[shape]
  const n = m.lunge.length
  const part = Math.floor(fx.lunge / n)
  const plan = [{ pose: m.windup, duration: fx.windup }]
  m.lunge.forEach((p, i) => plan.push({ pose: p, duration: i === n - 1 ? contactAt(fx) - fx.windup - part * (n - 1) : part }))
  return plan
}
