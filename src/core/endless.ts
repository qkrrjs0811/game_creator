import { simulateBattle, type Fighter } from './battle'
import { freshFighter } from './difficulty'
import { MONSTERS, type Monster, type MonsterShape } from './monsters'
import { EXP_PER_MINUTE, MINUTES_PER_STAT, expToNext } from './progression'
import { STAGES } from './stages'
import { shapeTrait } from './traits'

/** 한 장 = 스테이지 10개, 10번째가 보스. 장은 끝없이 이어진다 */
export const STAGES_PER_CHAPTER = 10

export interface EndlessStage {
  no: number
  chapter: number
  /** 장 안 순서(1~10) */
  index: number
  chapterName: string
  name: string
  icon: string
  boss: boolean
  monster: Monster
  /** 이 스테이지 상대의 전투 값 */
  enemy: Fighter
}

/** 장마다 붙는 말과 몬스터 색 조합. 다 쓰면 처음부터 다시 쓰되 장 번호가 붙는다 */
const CHAPTER_WORDS = ['말랑', '반짝', '몽실', '보들', '새콤', '포근', '달콤', '살랑', '콩닥', '두근', '초롱', '토독']

/** 파스텔 몸 색과 그늘 색. 장 번호로 순서를 밀어 장마다 조합이 바뀐다 */
const PALETTE: { name: string; color: number; shade: number }[] = [
  { name: '민트', color: 0xa8ead6, shade: 0x84d2bb },
  { name: '레몬', color: 0xfff0a0, shade: 0xf0d878 },
  { name: '복숭아', color: 0xffc4a8, shade: 0xf0a486 },
  { name: '라벤더', color: 0xd4c2ff, shade: 0xb6a0f0 },
  { name: '하늘', color: 0xb4dcff, shade: 0x8ec2f0 },
  { name: '딸기', color: 0xffb0c4, shade: 0xf08ea6 },
  { name: '말차', color: 0xc8e6a0, shade: 0xa8cf7e },
  { name: '코코아', color: 0xe0c4ac, shade: 0xc8a688 },
  { name: '소다', color: 0xa8f0f0, shade: 0x82d6d6 },
  { name: '자두', color: 0xe8b4e8, shade: 0xd090d0 },
  { name: '귤', color: 0xffd09c, shade: 0xf0b478 },
]

/** 장 안 순서(1~9)마다 장소와 아이콘. 보스는 왕의 둥지 */
const SPOTS = [
  { name: '풀밭', icon: '🌱' },
  { name: '숲', icon: '🍄' },
  { name: '호숫가', icon: '💧' },
  { name: '언덕', icon: '☁️' },
  { name: '바위산', icon: '⛰️' },
  { name: '오솔길', icon: '🍃' },
  { name: '개울', icon: '🐟' },
  { name: '동굴', icon: '✨' },
  { name: '꽃밭', icon: '🌸' },
]
const BOSS_SPOT = { name: '왕의 둥지', icon: '👑' }

/** 1장 6~9스테이지 이름(앞 다섯과 보스는 예전 스테이지 이름을 쓴다) */
const FIRST_CHAPTER_EXTRA = ['데굴 오솔길', '졸졸 개울', '보들 동굴', '폭신 꽃밭']

const SHAPES: MonsterShape[] = ['slime', 'mushroom', 'drop', 'cloud', 'rock']
const SHAPE_NAMES: Record<MonsterShape, string> = {
  slime: '말랑',
  mushroom: '뽀짝',
  drop: '퐁',
  cloud: '뭉게',
  rock: '꿍',
  king: '왕 말랑',
}

/**
 * 모양마다 성격: 체력·공격·방어 비율과 빠르기·피하기. 전체 세기는 난이도 곡선에 맞춰 따로 정한다.
 * spd 는 말랑이보다 얼마나 빠른지(+면 먼저 움직임)
 */
const PERSONALITY: Record<MonsterShape, { hp: number; atk: number; def: number; spd: number; dodge: number }> = {
  slime: { hp: 1, atk: 1, def: 0.5, spd: -1, dodge: 0 },
  mushroom: { hp: 1.2, atk: 0.85, def: 0.8, spd: -2, dodge: 0 },
  drop: { hp: 0.85, atk: 1.05, def: 0.4, spd: 2, dodge: 0.15 },
  cloud: { hp: 1.05, atk: 0.95, def: 0.5, spd: 1, dodge: 0.08 },
  rock: { hp: 1.3, atk: 0.9, def: 0.9, spd: -1, dodge: 0 },
  king: { hp: 1.15, atk: 1, def: 0.6, spd: 1, dodge: 0.08 },
}

const cleanNo = (no: number) => Math.max(1, Math.floor(no) || 1)

/** 기획서 난이도 곡선: 처음부터 운동만 했을 때 이길 만해지는 누적 운동 분. 보스는 한 스테이지 뒤 수준 */
export function targetMinutes(no: number): number {
  const n = cleanNo(no)
  const level = n % STAGES_PER_CHAPTER === 0 ? n + 1 : n
  return 1.5 * (level - 1) ** 1.75
}

/** 말랑이 능력치·레벨이 바뀌는 누적 운동 분(10분마다 능력치, 레벨업마다 스킬) 중 target 에 가장 가까운 것 */
function nearestStep(target: number): number {
  let best = 0
  let exp = 0
  let level = 1
  const steps: number[] = []
  for (let m = 0; m <= target + MINUTES_PER_STAT; m += MINUTES_PER_STAT) steps.push(m)
  while (exp / EXP_PER_MINUTE <= target + MINUTES_PER_STAT) {
    exp += expToNext(level++)
    steps.push(Math.ceil(exp / EXP_PER_MINUTE))
  }
  for (const s of steps) if (Math.abs(s - target) < Math.abs(best - target) || (Math.abs(s - target) === Math.abs(best - target) && s > best)) best = s
  return best
}

const TRIALS = 20
/** 목표 시간의 말랑이가 이 정도(20번 중)는 이기도록 맞춘다. 실제 전투는 씨앗이 매번 달라서 아슬아슬하면 억울하다 */
const COMFORT_WINS = 14

function wins(me: Fighter, enemy: Fighter): number {
  let w = 0
  for (let seed = 1; seed <= TRIALS; seed++) if (simulateBattle(me, enemy, seed).win) w++
  return w
}

function scaledEnemy(me: Fighter, shape: MonsterShape, chapter: number, name: string, k: number): Fighter {
  const p = PERSONALITY[shape]
  return {
    name,
    hp: Math.max(1, Math.round(me.hp * p.hp * k)),
    atk: Math.max(1, Math.round((me.def + me.atk * 0.6) * p.atk * k)),
    def: Math.max(0, Math.round(me.atk * 0.35 * p.def * k)),
    spd: Math.max(1, me.spd + p.spd),
    dodge: p.dodge,
    // 성격은 맞추는 말랑이(운동만 함)에게 효과가 없어 세기를 바꾸지 않는다
    trait: shapeTrait(shape, chapter),
  }
}

/** 목표 시간의 말랑이가 넉넉히 이기는 가장 센 상대 */
function calibratedEnemy(no: number, shape: MonsterShape, name: string): Fighter {
  const me = freshFighter(nearestStep(targetMinutes(no)))
  const chapter = chapterOf(no)
  let lo = 0.05
  let hi = 4
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (wins(me, scaledEnemy(me, shape, chapter, name, mid)) >= COMFORT_WINS) lo = mid
    else hi = mid
  }
  return scaledEnemy(me, shape, chapter, name, lo)
}

function chapterWord(chapter: number): string {
  const word = CHAPTER_WORDS[(chapter - 1) % CHAPTER_WORDS.length]
  const round = Math.floor((chapter - 1) / CHAPTER_WORDS.length)
  return round === 0 ? word : `${word}${round + 1}`
}

export function chapterName(chapter: number): string {
  return `${chapterWord(chapter)} 나라`
}

function stageLook(chapter: number, index: number): { name: string; icon: string } {
  const spot = index === STAGES_PER_CHAPTER ? BOSS_SPOT : SPOTS[index - 1]
  if (chapter === 1) {
    if (index <= 5) return { name: STAGES[index - 1].name, icon: STAGES[index - 1].icon }
    if (index === STAGES_PER_CHAPTER) return { name: STAGES[5].name, icon: STAGES[5].icon }
    return { name: FIRST_CHAPTER_EXTRA[index - 6], icon: spot.icon }
  }
  return { name: `${chapterWord(chapter)} ${spot.name}`, icon: spot.icon }
}

function monsterLook(chapter: number, index: number): Omit<Monster, 'stats'> {
  const boss = index === STAGES_PER_CHAPTER
  if (chapter === 1 && (index <= 5 || boss)) {
    const { stats: _stats, ...look } = MONSTERS[boss ? 5 : index - 1]
    return look
  }
  const shape: MonsterShape = boss ? 'king' : SHAPES[(index - 1) % SHAPES.length]
  // 장마다 색 순서를 밀고, 같은 장 안에서는 순서마다 다른 색
  const tone = PALETTE[(chapter * 3 + index) % PALETTE.length]
  return {
    id: `c${chapter}-s${index}`,
    name: `${tone.name} ${SHAPE_NAMES[shape]}`,
    shape,
    color: tone.color,
    shade: tone.shade,
    boss,
  }
}

/** 스테이지 번호의 몬스터 모습(이름·모양·색). 전투 값을 맞추지 않아 가볍다 */
export function stageMonsterLook(no: number): Omit<Monster, 'stats'> {
  const n = cleanNo(no)
  const chapter = Math.ceil(n / STAGES_PER_CHAPTER)
  return monsterLook(chapter, n - (chapter - 1) * STAGES_PER_CHAPTER)
}

const cache = new Map<number, EndlessStage>()

/**
 * 스테이지 번호 n 으로 정해지는 장·순서·이름·아이콘·몬스터·전투 값.
 * 같은 n 은 언제나 같은 스테이지다. 몬스터만 정하고 저장·성장은 바꾸지 않는다
 */
export function endlessStage(no: number): EndlessStage {
  const n = cleanNo(no)
  const hit = cache.get(n)
  if (hit) return hit
  const chapter = Math.ceil(n / STAGES_PER_CHAPTER)
  const index = n - (chapter - 1) * STAGES_PER_CHAPTER
  const look = monsterLook(chapter, index)
  const enemy = calibratedEnemy(n, look.shape, look.name)
  const { name: _name, ...stats } = enemy
  const stage: EndlessStage = {
    no: n,
    chapter,
    index,
    chapterName: chapterName(chapter),
    ...stageLook(chapter, index),
    boss: index === STAGES_PER_CHAPTER,
    monster: { ...look, stats },
    enemy,
  }
  cache.set(n, stage)
  return stage
}

const cleared = (stageProgress: number) => Math.max(0, Math.floor(stageProgress) || 0)

/** stageProgress = 깬 스테이지 수. 깬 스테이지와 바로 다음 스테이지는 언제든 도전할 수 있고, 끝은 없다 */
export function endlessStageOpen(stageProgress: number, no: number): boolean {
  return Number.isFinite(no) && no >= 1 && no <= cleared(stageProgress) + 1
}

export function stageMonster(no: number): Monster {
  return endlessStage(no).monster
}

/** 스테이지 상대의 전투 값 */
export function stageEnemy(no: number): Fighter {
  return endlessStage(no).enemy
}

/** 홈 장면에 나오는 몬스터: 다음에 도전할 스테이지 */
export function homeMonster(stageProgress: number): Monster {
  return stageMonster(cleared(stageProgress) + 1)
}

export function chapterOf(no: number): number {
  return Math.ceil(cleanNo(no) / STAGES_PER_CHAPTER)
}

export interface ChapterBrowse {
  /** 보여 줄 장 */
  chapter: number
  /** 지금 장(다음에 깰 스테이지가 있는 장) */
  current: number
  prev: boolean
  next: boolean
  /** 열린 장인지. 아직 안 열린 장은 이름을 비밀로 둔다 */
  revealed: boolean
}

/** 모험 지도에서 넘겨 볼 장: 1장부터 지금 장 바로 다음 장까지. 장을 고르지 않거나 이상하면 지금 장 */
export function chapterBrowse(stageProgress: number, chapter?: number): ChapterBrowse {
  const current = chapterOf(cleared(stageProgress) + 1)
  const want = chapter === undefined || !Number.isFinite(chapter) ? current : Math.floor(chapter)
  const c = Math.min(current + 1, Math.max(1, want))
  return { chapter: c, current, prev: c > 1, next: c <= current, revealed: c <= current }
}

export type StageState ='cleared' | 'open' | 'locked'

/** 한 장의 스테이지 10칸과 깸·도전 가능·잠김 상태. 장을 고르지 않으면 다음에 깰 스테이지가 있는 장 */
export function chapterStages(stageProgress: number, chapter?: number): (EndlessStage & { state: StageState })[] {
  const done = cleared(stageProgress)
  const c = chapter === undefined ? chapterOf(done + 1) : Math.max(1, Math.floor(chapter) || 1)
  return Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => {
    const s = endlessStage((c - 1) * STAGES_PER_CHAPTER + i + 1)
    return { ...s, state: s.no <= done ? 'cleared' : s.no === done + 1 ? 'open' : 'locked' }
  })
}
