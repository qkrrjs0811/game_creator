import type { SessionGain } from '../core/gain'
import { STAT_INFO } from '../core/stats'
import { ACTIVITIES } from '../core/activities'
import type { ActivityId } from '../core/types'
import type { TodayGoal } from '../core/goal'
import type { AwaySummary } from '../core/away'
import type { WeekGoal } from '../core/week'
import { WINNABLE_MAX } from '../core/coach'
import { AUTO_RUN_MAX, type AutoRun } from '../core/autorun'

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

/** 지금까지 이번 주 목표를 채운 주 수 */
export function weekDoneText(weeks: number): string {
  return weeks > 0 ? `🏅 채운 주 ${weeks}번` : '🏅 채운 주 아직 없어요'
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
