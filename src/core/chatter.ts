import { ACTIVITIES } from './activities'
import { winnableStages } from './coach'
import { goalStreak, todayGoal } from './goal'
import { todayMission } from './mission'
import { computeProgress } from './progression'
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

export type ChatKind = 'welcome' | 'missed' | 'goal' | 'mission' | 'allDone' | 'winnable' | 'streak' | 'week' | 'cheer'

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

/** 늘 마지막에 오는 기본 한마디 */
export const CHEER_LINE: ChatLine = { kind: 'cheer', text: '💪 오늘도 같이 크는 중!' }

export function chatLines({ records, stageProgress, skills, now, lastSeen }: ChatInput): ChatLine[] {
  const lines: ChatLine[] = []
  const goal = todayGoal(records, now)
  const mission = todayMission(records, now)
  const missionLabel = ACTIVITIES[mission.activity].label

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

  const minutes = computeProgress(records).creditedMinutes
  if (winnableStages(minutes, skills, stageProgress, 1) > 0) lines.push({ kind: 'winnable', text: '🍀 이길 만한 곳이 있어!' })

  const streak = goalStreak(records, now)
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
