import { playerFighter, type Fighter } from './battle'
import { likelyWin } from './coach'
import { EXP_PER_MINUTE, expToNext, statsFromMinutes } from './progression'
import { SKILLS } from './skills'

/** 난이도를 잴 때 찾아보는 누적 운동 분의 끝(기본 200시간) */
const MEASURE_MINUTES = 12_000

/** 운동만 한 누적 분으로 오른 레벨 */
function levelFromMinutes(minutes: number): number {
  let level = 1
  let rest = minutes * EXP_PER_MINUTE
  while (rest >= expToNext(level)) {
    rest -= expToNext(level)
    level++
  }
  return level
}

/** 레벨마다 받은 포인트를 펀치→몸→발 순서로 돌려 가며 배웠다고 본 스킬 목록 */
export function rotatedSkills(level: number): string[] {
  return Array.from({ length: Math.max(0, level - 1) }, (_, i) => SKILLS[i % SKILLS.length].id)
}

/** 처음부터 운동만 누적 minutes 분 한 말랑이(스킬은 골고루) */
export function freshFighter(minutes: number): Fighter {
  return playerFighter(statsFromMinutes({ exercise: minutes }), rotatedSkills(levelFromMinutes(minutes)))
}

/**
 * 난이도 측정: 처음부터 운동만 했을 때 enemy 를 이길 만해지는 가장 적은 누적 운동 분.
 * 찾는 범위 안에서 안 되면 null. 스테이지 능력치를 맞추는 데 쓰고, 저장·성장은 바꾸지 않는다
 */
export function freshMinutesToWin(enemy: Fighter, maxMinutes = MEASURE_MINUTES): number | null {
  let last = ''
  for (let m = 0; m <= maxMinutes; m++) {
    const me = freshFighter(m)
    const key = JSON.stringify(me)
    // 능력치·스킬이 그대로인 분은 결과도 같으니 건너뛴다
    if (key === last) continue
    last = key
    if (likelyWin(me, enemy)) return m
  }
  return null
}
