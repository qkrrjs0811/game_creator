import type { SessionGain } from '../core/gain'
import { STAT_INFO } from '../core/stats'
import { ACTIVITIES } from '../core/activities'
import type { ActivityId } from '../core/types'
import { DAILY_GOAL_MINUTES, type TodayGoal } from '../core/goal'
import type { AwaySummary } from '../core/away'
import type { WeekGoal } from '../core/week'
import type { TodayMission } from '../core/mission'
import type { BestDay, HistoryDay, WeekTotals } from '../core/history'
import { WINNABLE_MAX } from '../core/coach'
import { AUTO_RUN_MAX, type AutoRun } from '../core/autorun'
import { ACHIEVEMENTS, type AchievementProgress } from '../core/achievements'
import type { FocusProgress } from '../core/focus'

const pad =(n: number) => String(n).padStart(2, '0')

/** 한 시간 미만은 MM:SS, 이상은 H:MM:SS */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 한 시간 미만은 N분, 이상은 N시간 M분 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/**
 * 도감 그림자 칸: 그 몬스터를 운동 몇 분 더 하면 이길 만한지(0이면 지금도, null이면 찾는 범위 밖).
 * 칸이 좁아 ❔ 는 그림자 그림 위에 따로 얹는다
 */
export function dexShadowText(toWin: number | null): string {
  if (toWin === null) return '더 키워서 만나요'
  if (toWin === 0) return '🍀 지금 만나요'
  return `운동 ${formatMinutes(toWin)} 더`
}

/** 결과 카드에 다는 도감 알림. 새로 모은 몬스터가 없으면 null(숨김) */
export function dexNewText(count: number): string | null {
  return count > 0 ? `📚 도감에 새 몬스터 +${count}` : null
}

function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code < 11172 && code % 28 !== 0
}

/** 낱말 끝 글자에 받침이 있으면 "을", 없으면 "를"(운동을 · 공부를) */
export const objectJosa = (word: string) => (hasBatchim(word) ? '을' : '를')
/** 받침이 있으면 "은", 없으면 "는"(운동은 · 공부는) */
export const topicJosa = (word: string) => (hasBatchim(word) ? '은' : '는')

/** 홈 타이머 카드의 하루 목표 글자. 30분을 넘겨도 실제 분을 보여 준다 */
export function goalText(g: TodayGoal): string {
  return g.done ? `🌟 오늘 목표 달성 ${g.minutes} / ${g.goal}분` : `🎯 오늘 목표 ${g.minutes} / ${g.goal}분`
}

type WeekCount = Pick<WeekGoal, 'stamped' | 'goal' | 'done'>

/** 도장판의 이번 주 제목 */
export function weekGoalText(w: WeekCount): string {
  return w.done ? `🏅 이번 주 목표 달성 ${w.stamped} / ${w.goal}일` : `📅 이번 주 ${w.stamped} / ${w.goal}일`
}

/** 홈 오늘 목표 줄 끝의 작은 이번 주 칩 */
export function weekChip(w: WeekCount): string {
  return `${w.done ? '🏅' : '📅'} ${w.stamped}/${w.goal}`
}

/** 홈 오늘 분 칩 옆의 작은 오늘의 미션 칩 */
export function missionChip(m: TodayMission): string {
  const name = ACTIVITIES[m.activity].label
  return m.done ? `📜 ${name} 완료!` : `📜 ${name} ${Math.min(m.minutes, m.goal)} / ${m.goal}분`
}

/** 지금까지 이번 주 목표를 채운 주 수 */
export function weekDoneText(weeks: number): string {
  return weeks > 0 ? `🏅 채운 주 ${weeks}번` : '🏅 채운 주 아직 없어요'
}

/** 내 기록의 이번 주 합계. 지난주가 비었으면 견주지 않고, 모자라면 "N분 더"로 북돋운다 */
export function weekTotalText(w: WeekTotals): string {
  const head = `이번 주 ${formatMinutes(w.thisWeek)}`
  if (w.lastWeek === 0) return head
  if (w.diff > 0) return `${head} · 지난주보다 +${formatMinutes(w.diff)}`
  if (w.diff === 0) return `${head} · 지난주와 같아요`
  return `${head} · 지난주까지 ${formatMinutes(-w.diff)} 더`
}

/** 내 기록의 가장 많이 한 날 */
export function bestDayText(b: BestDay): string {
  const [, m, d] = b.key.split('-').map(Number)
  return `🏆 가장 많이 한 날 · ${m}월 ${d}일 ${formatMinutes(b.minutes)}`
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

/** 내 기록 막대를 누르면 뜨는 말풍선: 그날 합계, 활동별 분(1분 이상만), 도장 */
export function dayDetail(d: HistoryDay): { title: string; parts: string[]; stamp: string } {
  const [, m, day] = d.key.split('-').map(Number)
  const date = d.today ? `오늘 ${m}월 ${day}일` : `${m}월 ${day}일 ${WEEKDAY_NAMES[d.weekday]}요일`
  const parts = (Object.keys(ACTIVITIES) as ActivityId[])
    .filter((id) => d.minutes[id] > 0)
    .map((id) => `${ACTIVITIES[id].label} ${formatMinutes(d.minutes[id])}`)
  const stamp = d.stamped
    ? '🌟 도장 찍은 날'
    : d.today
      ? `🎯 도장까지 ${formatMinutes(DAILY_GOAL_MINUTES - d.total)} 더`
      : d.total === 0
        ? '😴 쉬어 간 날'
        : `도장은 ${DAILY_GOAL_MINUTES}분부터`
  return { title: `${date} · ${formatMinutes(d.total)}`, parts, stamp }
}

/** 넘겨 보는 7일 쪽 이름. keys = 그 쪽 날짜들(오래된 날부터), page 0 은 최근 7일 */
export function pageRangeText(keys: string[], page: number): string {
  if (page === 0) return '최근 7일'
  const [, m1, d1] = keys[0].split('-').map(Number)
  const [, m2, d2] = keys[keys.length - 1].split('-').map(Number)
  return m1 === m2 ? `${m1}월 ${d1}일 ~ ${d2}일` : `${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`
}

/**
 * 활동을 그만둘 때 띄우는 요약. capReached = 오늘 상한에 닿았는지.
 * 안내는 폰 폭에서 한 줄에 들어가게 짧게 쓴다(두 줄이면 카드가 길어져 말랑이를 가린다)
 */
export function sessionSummary(g: SessionGain, capReached: boolean, activity: ActivityId = 'exercise'): { title: string; detail: string } {
  const name = ACTIVITIES[activity].label
  const title = g.minutes > 0 ? `🎉 ${name} ${formatMinutes(g.minutes)} 했어요!` : `🎉 ${name}${objectJosa(name)} 마쳤어요!`
  if (g.exp <= 0) {
    return { title, detail: capReached ? '상한을 채워서 경험치는 내일 쌓여요' : '1분 넘게 하면 경험치가 쌓여요' }
  }
  const stats = STAT_INFO.filter((s) => g.stats[s.id] > 0).map((s) => `${s.icon} ${s.name} +${g.stats[s.id]}`)
  return { title, detail: [`EXP +${g.exp}`, ...stats].join(' · ') }
}

/** 자리 비운 시간. 하루 넘게 비우면 N일 M시간(분은 뺀다) */
function formatAway(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const d = Math.floor(minutes / 1440)
  if (d === 0) return formatMinutes(minutes)
  const h = Math.floor((minutes % 1440) / 60)
  return h === 0 ? `${d}일` : `${d}일 ${h}시간`
}

/**
 * 자리 비운 동안 카드 맨 아래 모험 안내. winnable = 지금 줄줄이 이길 만한 스테이지 수(winnableStages),
 * toWin = 그게 없을 때 다음 스테이지까지 운동 몇 분 더(null이면 찾는 범위 밖)
 */
export function awayAdventure(winnable: number, toWin: number | null): string {
  // 자동 진행·모험 버튼 옆에 들어가게 짧게 쓴다. 두 줄이 되면 "이길 만한"이 갈라지지 않게 붙인다
  if (winnable >= WINNABLE_MAX) return `🍀 이길 만한 곳 ${WINNABLE_MAX}개 이상`
  if (winnable > 0) return `🍀 이길 만한 곳 ${winnable}개`
  if (toWin === null) return '💪 운동으로 더 키워서 와요'
  return `💪 다음 스테이지까지 운동 ${formatMinutes(toWin)} 더`
}

/**
 * 자동 진행이 끝나면 띄우는 결과 카드 글자. toWin = 멈춘 스테이지를 운동 몇 분 더 하면 이길 만한지
 * (stageMinutesToWin, 0이면 지금도 이길 만함, null이면 찾는 범위 밖). 다 이겼으면 쓰지 않는다
 */
export function autoRunCard(
  run: Pick<AutoRun, 'from' | 'to' | 'stoppedAt' | 'rewards'>,
  toWin: number | null,
): { win: boolean; title: string; detail: string; note: string; reward: string | null } {
  const win = run.to > run.from
  const detail = !win
    ? `${run.stoppedAt}스테이지에서 아쉽게 졌어요`
    : run.from === 0
      ? `${run.to}스테이지까지 깼어요`
      : `${run.from} → ${run.to}스테이지까지 깼어요`
  let note: string
  if (run.stoppedAt === null) note = `⏩ ${AUTO_RUN_MAX}판 다 이겼어요!`
  else if (toWin === null) note = '💪 운동으로 더 키워서 다시 와요'
  else if (toWin === 0) note = '🍀 지금도 이길 만해요 · 다시 도전해 봐요'
  else note = `💪 다음은 운동 ${formatMinutes(toWin)} 더 하면 이길 만해요`
  // 여러 개면 이름 대신 아이콘만 늘어놓아 카드가 길어져 말랑이를 가리지 않게 한다
  const [one] = run.rewards
  const reward =
    run.rewards.length === 0
      ? null
      : run.rewards.length === 1
        ? `🎁 새 꾸미기 · ${one.icon} ${one.name}`
        : `🎁 새 꾸미기 ${run.rewards.length}개 · ${run.rewards.map((c) => c.icon).join(' ')}`
  return { win, title: win ? '🏁 자동 진행 끝!' : '💧 아쉬워요', detail, note, reward }
}

/** 다시 열 때 띄우는 "자리 비운 동안" 카드 글자 */
export function awayCard(a: AwaySummary): { title: string; did: string; gain: string; chips: string[] } {
  const did = (Object.keys(ACTIVITIES) as ActivityId[])
    .filter((id) => a.minutes[id] > 0)
    .map((id) => `${ACTIVITIES[id].label} ${formatMinutes(a.minutes[id])}`)
  const stats = STAT_INFO.filter((s) => a.stats[s.id] > 0).map((s) => `${s.icon} ${s.name} +${a.stats[s.id]}`)
  const chips: string[] = []
  if (a.levelAfter > a.levelBefore) {
    chips.push(`⬆️ Lv.${a.levelBefore} → Lv.${a.levelAfter}`, `✨ 스킬 포인트 +${a.levelAfter - a.levelBefore}`)
  }
  if (a.stampsAfter > a.stampsBefore) chips.push(`🌟 도장 +${a.stampsAfter - a.stampsBefore}`)
  return {
    title: `🌙 자리 비운 동안 · ${formatAway(a.awayMs)}`,
    did: did.length > 0 ? `${did.join(' · ')} 했어요` : '',
    gain: [`EXP +${a.exp}`, ...stats].join(' · '),
    chips,
  }
}

/** 업적 칸 진행 글자("운동 7 / 10시간"). 목표를 넘어도 목표에서 멈춘다 */
export function achievementValueText(a: AchievementProgress): string {
  const v = Math.min(a.value, a.goal)
  switch (a.kind) {
    case 'minutes': {
      const now = v > 0 && v < 60 ? `${v}분` : String(Math.floor(v / 60))
      return `${ACTIVITIES[a.activity!].label} ${now} / ${a.goal / 60}시간`
    }
    case 'stamps':
      return `도장 ${v} / ${a.goal}개`
    case 'streak':
      return `가장 길게 ${v} / ${a.goal}일`
    case 'variety':
      return `해 본 활동 ${v} / ${a.goal}가지`
  }
}

/** 흐리게 보일 먼 업적: 같은 줄(활동·종류)에서 아직 못 닿은 첫 업적 뒤의 것 */
export function farAchievementIds(list: AchievementProgress[]): Set<string> {
  const next = new Set<string>()
  const far = new Set<string>()
  for (const a of list) {
    if (a.done) continue
    const line = `${a.kind}:${a.activity ?? ''}`
    if (next.has(line)) far.add(a.id)
    else next.add(line)
  }
  return far
}

/** 새로 닿은 업적 알림 글자. 여럿이면(처음 열 때 기존 기록 등) 묶어서 하나로 보여 준다 */
export function achievementToast(ids: string[]): { title: string; detail: string } | null {
  const list = ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter((a) => a !== undefined)
  if (list.length === 0) return null
  if (list.length === 1) return { title: '🏆 업적 달성!', detail: `${list[0].label} · 🏅 ${list[0].titleName}` }
  return { title: `🏆 업적 ${list.length}개 달성!`, detail: `🏅 ${list[0].titleName} 외 칭호 ${list.length - 1}개` }
}

/** 켜 둔 타이머의 집중 목표 진행 한 줄. 닿은 뒤에도 타이머는 흐르니 몇 분째인지 보여 준다 */
export function focusText(p: FocusProgress): string {
  if (p.reached) return `⏰ 목표 ${p.target}분 채웠어요 · ${formatMinutes(p.elapsedMinutes)}째`
  return `🎯 ${p.target}분 중 ${p.elapsedMinutes}분 · ${p.remainingMinutes}분 남음`
}

/** 집중 목표 칩 글자 */
export function focusChipLabel(minutes: number): string {
  return minutes === 0 ? '없음' : `${minutes}분`
}
