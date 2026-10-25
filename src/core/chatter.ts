import { ACTIVITIES } from './activities'
import { winnableStages } from './coach'
import { todayGoal } from './goal'
import { dayMinutes } from './history'
import { todayMission } from './mission'
import { computeProgress, dayKey } from './progression'
import { restedYesterday, restStreak } from './rest'
import { upcomingRewards, type RewardKind, type UpcomingReward } from './rewards'
import type { ActivityRecord } from './types'
import { weekGoal } from './week'

/**
 * 말랑이 한마디: 타이머가 꺼져 있을 때 장면 말풍선에 띄울 후보를 중요한 순서로 고른다.
 * 기록·깬 스테이지 수·시각에서 계산만 하고 저장 형식·경험치·능력치는 바꾸지 않는다.
 */

/** 장면 말풍선에 들어가는 한 줄 글자 수(이모지 하나 = 한 글자) */
export const CHAT_MAX_CHARS = 18

/** 마지막으로 본 뒤 이만큼 지났으면 "보고 싶었어" */
export const MISSED_MS = 24 * 60 * 60_000

export type ChatKind = 'rested' | 'welcome' | 'missed' | 'goal' | 'mission' | 'allDone' | 'reward' | 'best' | 'winnable' | 'streak' | 'week' | 'cheer'

export interface ChatLine {
  kind: ChatKind
  text: string
}

export interface ChatInput {
  records: ActivityRecord[]
  stageProgress: number
  skills: string[]
  now: number
  /** 마지막으로 본 시각(보조 키 last-seen). 모르면 null */
  lastSeen: number | null
}

/** 곧 받을 보상은 진척이 이보다 클 때만 한마디로 말한다 */
export const REWARD_CHAT_RATIO = 0.5

const REWARD_TAIL: Record<RewardKind, string> = {
  stamp: '새 모자!',
  mission: '새 모자!',
  week: '새 색!',
  chapter: '새 모자!',
  achievement: '새 칭호!',
  prop: '새 소품!',
  growth: '쑥 자라!',
}

/** 받침이 있으면 "이면", 없으면 "면" */
const ifJosa = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code < 11172 && code % 28 !== 0 ? '이면' : '면'
}

/** 곧 받을 보상을 말풍선 한 줄로("🎁 도장 2개면 새 모자!"). 현실 활동으로 안내할 수 없거나 너무 길면 null */
export function rewardChatText(r: UpcomingReward): string | null {
  const tail = REWARD_TAIL[r.kind]
  let m: RegExpExecArray | null
  let text: string | null = null
  if ((m = /^(\d+)일 더 이어 하기$/.exec(r.need))) text = `🎁 ${m[1]}일 더 이어 가면 ${tail}`
  else if ((m = /^활동 (\d+)가지 더 해 보기$/.exec(r.need))) text = `🎁 ${m[1]}가지 더 해 보면 ${tail}`
  else if ((m = /^스테이지 (\d+)개 더 깨기$/.exec(r.need))) text = `🎁 ${m[1]}곳 더 깨면 ${tail}`
  else if ((m = /^(.+) 더$/.exec(r.need))) text = `🎁 ${m[1]}${ifJosa(m[1])} ${tail}`
  return text !== null && Array.from(text).length <= CHAT_MAX_CHARS ? text : null
}

/** 오늘 인정 분이 지난 하루 최고의 이 비율을 넘었을 때만 최고까지 남은 분을 말한다 */
export const BEST_CHAT_RATIO = 0.5

/** 오늘 인정 분이 지난날 하루 최고의 절반을 넘고 아직 못 넘었으면 "🥇 최고까지 8분 남았어!"(넘으려면 1분 더). 아니면 null */
export function bestChatText(records: ActivityRecord[], now: number): string | null {
  const today = dayKey(now)
  let todayMinutes = 0
  let best = 0
  for (const [key, day] of dayMinutes(records)) {
    if (key === today) todayMinutes = day.total
    else if (key < today) best = Math.max(best, day.total)
  }
  if (best <= 0 || todayMinutes <= best * BEST_CHAT_RATIO || todayMinutes > best) return null
  return `🥇 최고까지 ${best + 1 - todayMinutes}분 남았어!`
}

/** 늘 마지막에 오는 기본 한마디 */
export const CHEER_LINE: ChatLine = { kind: 'cheer', text: '💪 오늘도 같이 크는 중!' }

export function chatLines({ records, stageProgress, skills, now, lastSeen }: ChatInput): ChatLine[] {
  const lines: ChatLine[] = []
  const goal = todayGoal(records, now)
  const mission = todayMission(records, now)
  const missionLabel = ACTIVITIES[mission.activity].label
  const rest = restStreak(records, now)

  // 어제를 쉼표가 지켜 줬으면 가장 먼저 알려 준다
  if (restedYesterday(rest.restedDays, now)) lines.push({ kind: 'rested', text: '🛟 어제는 쉼표가 지켜 줬어!' })

  if (records.length === 0) lines.push({ kind: 'welcome', text: '👋 안녕! 타이머 켜 볼까?' })
  else if (!goal.done && lastSeen !== null && now - lastSeen >= MISSED_MS) {
    lines.push({ kind: 'missed', text: '🥺 보고 싶었어! 5분만 같이?' })
  }

  if (!goal.done) lines.push({ kind: 'goal', text: `🎯 오늘 목표까지 ${goal.goal - goal.minutes}분!` })
  if (!mission.done) {
    lines.push({
      kind: 'mission',
      text:
        mission.minutes > 0
          ? `📜 ${missionLabel} 미션 ${mission.goal - mission.minutes}분 남았어!`
          : `📜 오늘은 ${missionLabel} ${mission.goal}분 어때?`,
    })
  }
  if (goal.done) lines.push({ kind: 'allDone', text: '🌟 오늘 도장 고마워!' })

  const reward = upcomingRewards({ records, stageProgress, skills, now })
    .filter((r) => r.ratio > REWARD_CHAT_RATIO)
    .map(rewardChatText)
    .find((t): t is string => t !== null)
  if (reward) lines.push({ kind: 'reward', text: reward })

  const best = bestChatText(records, now)
  if (best) lines.push({ kind: 'best', text: best })

  const minutes = computeProgress(records).creditedMinutes
  if (winnableStages(minutes, skills, stageProgress, 1) > 0) lines.push({ kind: 'winnable', text: '🍀 이길 만한 곳이 있어!' })

  const streak = rest.streak
  if (streak > 0) {
    lines.push({ kind: 'streak', text: goal.done ? `🔥 ${streak}일째 같이 하는 중!` : `🔥 오늘 하면 ${streak + 1}일째야!` })
  }

  const week = weekGoal(records, now)
  if (week.done) lines.push({ kind: 'week', text: '🏅 이번 주 목표 채웠어!' })
  else {
    const need = week.goal - week.stamped
    const left = week.days.filter((d) => !d.stamped && (d.today || d.future)).length
    if (need <= left) lines.push({ kind: 'week', text: `📅 이번 주 ${need}일만 더!` })
  }

  lines.push(CHEER_LINE)
  return lines
}

/** 말풍선을 누르면 다음 후보로 넘어간다. 마지막 뒤(또는 후보가 줄어 범위를 벗어났으면) 처음으로 돌아간다 */
export function nextChatIndex(index: number, count: number): number {
  return count > 0 && index + 1 < count ? index + 1 : 0
}

/** 후보 목록이 그대로면 보던 자리를 지키고, 하나라도 바뀌었으면(기록·날이 바뀌면) 처음 후보부터 다시 보여 준다 */
export function keepChatIndex(prev: readonly string[], next: readonly string[], index: number): number {
  const same = prev.length === next.length && prev.every((t, i) => t === next[i])
  return same && index < next.length ? index : 0
}
