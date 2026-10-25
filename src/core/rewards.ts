import { ACTIVITIES } from './activities'
import { achievementProgress, ACHIEVEMENTS, type Achievement } from './achievements'
import { stageMinutesToWin } from './coach'
import { chapterCosmetic, MISSION_COSMETICS, STAMP_COSMETICS, WEEK_COSMETICS, type Cosmetic } from './cosmetics'
import { STAGES_PER_CHAPTER } from './endless'
import { stampCount } from './goal'
import { GROWTH_STAGES, growthStage } from './look'
import { missionStars } from './mission'
import { computeProgress, EXP_PER_MINUTE, expToNext } from './progression'
import { restStreak } from './rest'
import type { ActivityRecord } from './types'
import { doneWeeks } from './week'

/**
 * 곧 받을 보상: 여러 창에 흩어진 아직 못 받은 보상(꾸미기·장 모자·칭호·성장 단계)을 모아 가까운 순서로 고른다.
 * 기록·깬 스테이지 수에서 계산만 하고 저장 형식·경험치·능력치는 바꾸지 않는다.
 */

export type RewardKind = 'stamp' | 'mission' | 'week' | 'chapter' | 'achievement' | 'growth'

export interface UpcomingReward {
  kind: RewardKind
  icon: string
  /** 받을 것의 이름(꾸미기·칭호·모습) */
  name: string
  /** 지금 값과 목표 값(도장 수, 별 수, 주 수, 이번 장에서 깬 스테이지 수, 업적 값, 레벨) */
  value: number
  goal: number
  /** 남은 양 글: "도장 2개 더", "운동 3시간 더" */
  need: string
  /** 앞 단계(없으면 0)부터 센 진척 0 이상 1 미만 */
  ratio: number
}

export interface RewardInput {
  records: ActivityRecord[]
  stageProgress: number
  skills: string[]
  now: number
}

/** 남은 분을 "40분", "1시간", "2시간 10분"으로. 1분이 안 되면 1분 */
export function leftMinutesText(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest}분`
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`
}

const progressRatio = (value: number, base: number, goal: number) =>
  goal > base ? Math.min(Math.max((value - base) / (goal - base), 0), 1) : 0

/** 단계로 받는 꾸미기 중 다음 것. 다 받았으면 null */
function nextTier(kind: RewardKind, list: Cosmetic[], key: 'stamps' | 'missions' | 'weeks', value: number, need: (left: number) => string): UpcomingReward | null {
  const i = list.findIndex((c) => (c[key] ?? 0) > value)
  if (i < 0) return null
  const c = list[i]
  const goal = c[key]!
  const base = i > 0 ? list[i - 1][key]! : 0
  return { kind, icon: c.icon, name: c.name, value, goal, need: need(goal - value), ratio: progressRatio(value, base, goal) }
}

/** 같은 갈래(종류·활동)에서 바로 앞 업적 목표. 없으면 0 */
const prevGoal = (a: Achievement) =>
  Math.max(0, ...ACHIEVEMENTS.filter((b) => b.kind === a.kind && b.activity === a.activity && b.goal < a.goal).map((b) => b.goal))

function nearestAchievement(records: ActivityRecord[], now: number): UpcomingReward | null {
  const streak = restStreak(records, now).streak
  let best: UpcomingReward | null = null
  for (const a of achievementProgress(records)) {
    if (a.done) continue
    // 이어 하기는 가장 길었던 날이 아니라 지금 이어 온 날부터 다시 닿아야 한다
    const value = a.kind === 'streak' ? streak : a.value
    const left = a.goal - value
    const need =
      a.kind === 'minutes'
        ? `${ACTIVITIES[a.activity!].label} ${leftMinutesText(left)} 더`
        : a.kind === 'stamps'
          ? `도장 ${left}개 더`
          : a.kind === 'streak'
            ? `${left}일 더 이어 하기`
            : `활동 ${left}가지 더 해 보기`
    const r: UpcomingReward = { kind: 'achievement', icon: '🏆', name: a.titleName, value, goal: a.goal, need, ratio: progressRatio(value, prevGoal(a), a.goal) }
    if (!best || r.ratio > best.ratio) best = r
  }
  return best
}

/** 레벨 1에서 level 이 되는 데 드는 경험치 */
const expAt = (level: number) => {
  let sum = 0
  for (let l = 1; l < level; l++) sum += expToNext(l)
  return sum
}

function nextGrowth(records: ActivityRecord[]): UpcomingReward | null {
  const progress = computeProgress(records)
  const info = growthStage(progress.level)
  const next = GROWTH_STAGES[info.index + 1]
  if (!next) return null
  const goalExp = expAt(next.minLevel)
  return {
    kind: 'growth',
    icon: '🌱',
    name: `${next.name} 말랑이`,
    value: progress.level,
    goal: next.minLevel,
    need: `활동 ${leftMinutesText((goalExp - progress.exp) / EXP_PER_MINUTE)} 더`,
    ratio: progressRatio(progress.exp, expAt(info.stage.minLevel), goalExp),
  }
}

function nextChapterHat(records: ActivityRecord[], stageProgress: number, skills: string[]): UpcomingReward | null {
  const cleared = Math.max(0, Math.floor(stageProgress) || 0)
  const chapter = Math.floor(cleared / STAGES_PER_CHAPTER) + 1
  const hat = chapterCosmetic(chapter)
  if (!hat) return null
  const value = cleared - (chapter - 1) * STAGES_PER_CHAPTER
  const left = STAGES_PER_CHAPTER - value
  // 보스를 이길 만하면 앞 스테이지들도 이길 만하다. 아직이면 현실 운동으로 안내한다
  const toWin = stageMinutesToWin(computeProgress(records).creditedMinutes, skills, chapter * STAGES_PER_CHAPTER)
  const need = toWin === null || toWin === 0 ? `스테이지 ${left}개 더 깨기` : `운동 ${leftMinutesText(toWin)} 더 하면 이길 만해요`
  return { kind: 'chapter', icon: hat.icon, name: hat.name, value, goal: STAGES_PER_CHAPTER, need, ratio: value / STAGES_PER_CHAPTER }
}

/** 아직 못 받은 보상 후보를 진척이 큰(가까운) 순서로. 진척이 같으면 종류 순서를 지킨다 */
export function upcomingRewards({ records, stageProgress, skills, now }: RewardInput): UpcomingReward[] {
  const list = [
    nextTier('stamp', STAMP_COSMETICS, 'stamps', stampCount(records), (left) => `도장 ${left}개 더`),
    nextTier('mission', MISSION_COSMETICS, 'missions', missionStars(records), (left) => `미션 별 ${left}개 더`),
    nextTier('week', WEEK_COSMETICS, 'weeks', doneWeeks(records), (left) => `주간 목표 ${left}번 더`),
    nextChapterHat(records, stageProgress, skills),
    nearestAchievement(records, now),
    nextGrowth(records),
  ].filter((r): r is UpcomingReward => r !== null)
  return list.sort((a, b) => b.ratio - a.ratio)
}
