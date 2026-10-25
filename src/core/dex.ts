import { stageMinutesToWin } from './coach'
import { stageMonsterLook } from './endless'
import type { Monster } from './monsters'
import type { ActivityId } from './types'

/** 다음 새 몬스터를 찾을 때 깬 스테이지 뒤로 이만큼까지만 본다 */
export const DEX_LOOKAHEAD = 60

export type MonsterLook = Omit<Monster, 'stats'>

export interface DexEntry {
  /** 모습(모양·색)이 같으면 같은 칸 */
  key: string
  monster: MonsterLook
  /** 이 모습을 처음 만난 스테이지 */
  firstStage: number
  boss: boolean
}

export interface MonsterDex {
  entries: DexEntry[]
  count: number
}

/** 도감 칸을 가르는 열쇠: 모양과 몸 색이 같으면 같은 몬스터로 본다 */
export function dexKey(monster: Pick<Monster, 'shape' | 'color'>): string {
  return `${monster.shape}:${monster.color.toString(16)}`
}

const cleared = (stageProgress: number) => Math.max(0, Math.floor(stageProgress) || 0)

function entryOf(no: number): DexEntry {
  const monster = stageMonsterLook(no)
  return { key: dexKey(monster), monster, firstStage: no, boss: monster.boss }
}

/**
 * 깬 스테이지 수로 모은(이긴) 몬스터를 처음 이긴 순서대로. 깬 스테이지에서 계산만 하고
 * 저장·경험치·능력치는 바꾸지 않는다
 */
export function monsterDex(stageProgress: number): MonsterDex {
  const seen = new Set<string>()
  const entries: DexEntry[] = []
  for (let no = 1; no <= cleared(stageProgress); no++) {
    const entry = entryOf(no)
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    entries.push(entry)
  }
  return { entries, count: entries.length }
}

/** 깬 스테이지 다음부터 도감에 아직 없는 모습을 count 마리까지(찾는 범위 안에서) */
export function upcomingMonsters(stageProgress: number, count: number): DexEntry[] {
  const done = cleared(stageProgress)
  const seen = new Set(monsterDex(done).entries.map((e) => e.key))
  const found: DexEntry[] = []
  for (let no = done + 1; no <= done + DEX_LOOKAHEAD && found.length < count; no++) {
    const entry = entryOf(no)
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    found.push(entry)
  }
  return found
}

/**
 * 그림자 칸: 다음 새 몬스터마다 그 스테이지를 운동 몇 분 더 하면 이길 만한지.
 * 지금도 이길 만하면 0, 찾는 범위 밖이면 null. 화면에 보여 줄 값일 뿐이다
 */
export function dexShadows(
  minutes: Partial<Record<ActivityId, number>>,
  skills: string[],
  stageProgress: number,
  count = 3,
): (DexEntry & { toWin: number | null })[] {
  return upcomingMonsters(stageProgress, count).map((e) => ({ ...e, toWin: stageMinutesToWin(minutes, skills, e.firstStage) }))
}
