import { SKILLS, type SkillId } from '../core/skills'
import type { StatRow } from '../core/stats'
import type { StampCalendar } from '../core/goal'
import type { WeekGoal } from '../core/week'
import type { HistoryDay, HistoryPage, RecordSummary } from '../core/history'
import { ACTIVITIES } from '../core/activities'
import type { ActivityId } from '../core/types'
import type { AchievementKind, AchievementProgress } from '../core/achievements'
import { achievementValueText, bestDayText, dayDetail, farAchievementIds, formatMinutes, pageRangeText, weekDoneText, weekGoalText, weekTotalText } from './format'

export interface SkillsView {
  points: number
  ranks: Record<SkillId, number>
  stats: StatRow[]
  /** missions: 모은 미션 별(오늘의 미션을 채운 날) 수 */
  board: { calendar: StampCalendar; stamps: number; streak: number; week: WeekGoal; missions: number }
  history: RecordSummary
  /** 내 기록 막대를 앞뒤 주로 넘겨 볼 때의 7일 쪽(0 = 최근 7일) */
  historyPage(page: number): HistoryPage
  /** 업적마다 현재 값·달성 여부(목록 순서) */
  achievements: AchievementProgress[]
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
/** 주간 목표는 월요일에 시작한다 */
const MON_FIRST = ['월', '화', '수', '목', '금', '토', '일']

/** 이번 주 월~일 7칸 */
export function weekRowHtml(w: WeekGoal): string {
  return w.days
    .map((d, i) => {
      // 'today'는 홈의 오늘 분 칩 이름과 겹쳐 'now'로 쓴다
      const cls = ['week-day', d.stamped && 'stamped', d.today && 'now', d.future && 'future'].filter(Boolean).join(' ')
      const label = ` aria-label="${MON_FIRST[i]}요일${d.stamped ? ' 도장' : ''}"`
      return `<li class="${cls}" data-testid="week-day-${i}"${label}><small>${MON_FIRST[i]}</small><span>${d.stamped ? '🌟' : Number(d.key.slice(8))}</span></li>`
    })
    .join('')
}

/** 도장판: 이번 달 달력에 하루 목표를 채운 날을 도장으로 */
export function boardHtml(cal: StampCalendar): string {
  const head = WEEK.map((w) => `<li class="board-week">${w}</li>`).join('')
  const lead = '<li class="board-blank"></li>'.repeat(cal.lead)
  const days = cal.days
    .map((d) => {
      const cls = ['board-day', d.stamped && 'stamped', d.today && 'today', d.future && 'future'].filter(Boolean).join(' ')
      const label = d.stamped ? ` aria-label="${d.day}일 도장"` : ''
      return `<li class="${cls}" data-testid="board-day-${d.day}"${label}>${d.stamped ? '🌟' : d.day}</li>`
    })
    .join('')
  return head + lead + days
}

const ACTIVITY_IDS = Object.keys(ACTIVITIES) as ActivityId[]
/** 막대 꼭대기 눈금. 조금만 한 날이 칸을 꽉 채워 보이지 않게 적어도 1시간으로 잡는다 */
const BAR_MIN_SCALE = 60

/** 내 기록: 7일 활동별 색을 쌓은 막대(오래된 날부터). 누르면 그날 말풍선, selected = 고른 날 */
export function historyBarsHtml(days: HistoryDay[], selected: string | null = null): string {
  const scale = Math.max(BAR_MIN_SCALE, ...days.map((d) => d.total))
  return days
    .map((d, i) => {
      const cls = ['hist-day', d.today && 'now', d.total === 0 && 'rest', d.key === selected && 'sel'].filter(Boolean).join(' ')
      const parts = ACTIVITY_IDS.filter((id) => d.minutes[id] > 0)
        .map((id) => `<i class="hist-seg act-${id}" style="height:${((d.minutes[id] / scale) * 100).toFixed(1)}%"></i>`)
        .join('')
      const label = ` aria-label="${WEEK[d.weekday]}요일 ${formatMinutes(d.total)}${d.stamped ? ' 도장' : ''}"`
      return `<li><button type="button" class="${cls}" data-testid="hist-day-${i}" data-key="${d.key}" aria-pressed="${d.key === selected}"${label}><span class="hist-star">${d.stamped ? '🌟' : ''}</span><span class="hist-bar">${parts}</span><small>${d.today ? '오늘' : WEEK[d.weekday]}</small></button></li>`
    })
    .join('')
}

/** 막대 말풍선: 그날 합계, 활동별 분, 도장 */
export function dayTipHtml(d: HistoryDay): string {
  const t = dayDetail(d)
  const parts = ACTIVITY_IDS.filter((id) => d.minutes[id] > 0)
    .map((id, i) => `<li><i class="hist-dot act-${id}" aria-hidden="true"></i>${t.parts[i]}</li>`)
    .join('')
  return `<b data-testid="hist-tip-title">${t.title}</b>${parts ? `<ul class="hist-tip-parts" data-testid="hist-tip-parts">${parts}</ul>` : ''}<span class="hist-tip-stamp${d.stamped ? ' stamped' : ''}" data-testid="hist-tip-stamp">${t.stamp}</span>`
}

/** 내 기록: 활동별 누적 시간 */
export function historyTotalsHtml(h: RecordSummary): string {
  return ACTIVITY_IDS.map(
    (id) =>
      `<li data-testid="hist-total-${id}"><i class="hist-dot act-${id}" aria-hidden="true"></i>${ACTIVITIES[id].label} <b>${formatMinutes(h.totals[id])}</b></li>`,
  ).join('')
}

const ACHIEVEMENT_ICONS: Record<ActivityId | Exclude<AchievementKind, 'minutes'>, string> = {
  exercise: '🏃',
  study: '✏️',
  reading: '📚',
  relax: '🍵',
  stamps: '🌟',
  streak: '🔥',
  variety: '🌈',
}

/** 업적 칸: 이름, 진행 막대와 글자, 달성 표시. 같은 줄에서 다음 것보다 먼 업적은 흐리게 */
export function achievementsHtml(list: AchievementProgress[]): string {
  const far = farAchievementIds(list)
  return list
    .map((a) => {
      const cls = ['ach', a.done && 'done', far.has(a.id) && 'far'].filter(Boolean).join(' ')
      const icon = ACHIEVEMENT_ICONS[a.kind === 'minutes' ? a.activity! : a.kind]
      const fill = a.kind === 'minutes' ? ` act-${a.activity}` : ''
      const pct = Math.min(100, (a.value / a.goal) * 100).toFixed(1)
      const mark = a.done ? '<span class="ach-mark">달성</span>' : ''
      const sub = a.done ? `🏅 칭호 “${a.titleName}”` : achievementValueText(a)
      return `<li class="${cls}" data-testid="ach-${a.id}"><span class="ach-icon" aria-hidden="true">${icon}</span><span class="ach-text"><span class="ach-head"><b>${a.label}</b>${mark}</span><span class="ach-bar"><i class="ach-fill${fill}" style="width:${pct}%"></i></span><small data-testid="ach-value-${a.id}">${sub}</small></span></li>`
    })
    .join('')
}

/** 받침이 있으면 '을', 없으면 '를' */
export function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code < 11172 && code % 28 > 0 ? '을' : '를'
}

/** 나 창: 운동으로 오른 능력치, 남은 포인트와 스킬 3종, 골라서 배우기 */
export function createSkills(root: HTMLElement, h: { view(): SkillsView; onLearn(id: SkillId): void }) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'skills'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="skills-title">
      <h2 id="skills-title">나의 말랑이</h2>
      <ul class="stat-list" data-testid="stats"></ul>
      <h3 class="sheet-sub">스킬</h3>
      <p class="skill-points" data-testid="skill-points"></p>
      <ul class="skill-list">
        ${SKILLS.map(
          (s) => `
          <li class="skill" data-testid="skill-${s.id}">
            <span class="skill-icon" aria-hidden="true">${s.icon}</span>
            <span class="skill-text">
              <b>${s.name} <small data-testid="skill-rank-${s.id}"></small></b>
              <span>${s.desc}</span>
            </span>
            <button type="button" class="skill-learn" data-testid="learn-${s.id}">배우기</button>
          </li>`,
        ).join('')}
      </ul>
      <p class="sheet-desc" data-testid="skill-hint"></p>
      <h3 class="sheet-sub board-title" data-testid="board-title"></h3>
      <div class="board-summary">
        <span class="board-chip" data-testid="board-stamps"></span>
        <span class="board-chip" data-testid="board-streak"></span>
        <span class="board-chip board-mission" data-testid="board-missions"></span>
      </div>
      <div class="week-goal" data-testid="week-goal">
        <div class="week-goal-head">
          <b data-testid="week-goal-text"></b>
          <span data-testid="week-done"></span>
        </div>
        <ul class="week-row" data-testid="week-row"></ul>
      </div>
      <ul class="board" data-testid="board"></ul>
      <p class="sheet-desc">하루 활동 합쳐 30분을 채우면 도장을 찍어요. 한 주(월~일)에 5일 찍으면 이번 주 목표 달성!</p>
      <h3 class="sheet-sub hist-title">📖 내 기록</h3>
      <div class="hist" data-testid="history">
        <p class="hist-empty" data-testid="hist-empty">아직 기록이 없어요 · 타이머를 켜면 여기에 쌓여요</p>
        <div class="hist-body" data-testid="hist-body">
          <b class="hist-week" data-testid="hist-week"></b>
          <div class="hist-nav">
            <button type="button" class="hist-arrow" data-testid="hist-prev" aria-label="앞 주 보기">‹</button>
            <span class="hist-range" data-testid="hist-range"></span>
            <button type="button" class="hist-arrow" data-testid="hist-next" aria-label="다음 주 보기">›</button>
          </div>
          <ul class="hist-bars" data-testid="hist-bars"></ul>
          <div class="hist-tip" data-testid="hist-tip" hidden></div>
          <ul class="hist-totals" data-testid="hist-totals"></ul>
          <p class="hist-best" data-testid="hist-best"></p>
        </div>
      </div>
      <h3 class="sheet-sub ach-title" data-testid="ach-title"></h3>
      <ul class="ach-list" data-testid="achievements"></ul>
      <div class="sheet-foot">
        <button type="button" class="sheet-close" data-testid="skills-close">닫기</button>
      </div>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!

  /** 한 번 누른 스킬. 잘못 눌러 포인트를 쓰지 않게 한 번 더 눌러야 배운다 */
  let asking: SkillId | null = null
  let lastStats = ''
  let lastBoard = ''
  let lastWeek = ''
  let lastBars = ''
  let lastTip = ''
  let lastTotals = ''
  let lastAch = ''
  /** 내 기록에서 보고 있는 7일 쪽과 누른 날 */
  let page = 0
  let picked: string | null = null

  const draw = () => {
    const v = h.view()
    if (v.points < 1) asking = null
    // 매초 다시 그리므로 바뀐 게 있을 때만 칸을 새로 만든다(칸이 깜빡이거나 사라졌다 생기지 않게)
    const stats = v.stats
      .map(
        (s) => `
        <li class="stat${s.source ? '' : ' soon'}" data-testid="stat-${s.id}">
          <span class="stat-name"><span aria-hidden="true">${s.icon}</span> ${s.name}</span>
          <span class="stat-role" data-testid="stat-role-${s.id}">${s.role}</span>
          <b data-testid="stat-value-${s.id}">${s.value}</b>
          <small data-testid="stat-next-${s.id}">${s.toNext === null ? '준비 중' : `${s.tomorrow ? '내일 ' : ''}${s.source} ${s.toNext}분 더`}</small>
        </li>`,
      )
      .join('')
    if (stats !== lastStats) {
      lastStats = stats
      q('stats').innerHTML = stats
    }
    const cal = v.board.calendar
    q('board-title').textContent = `🗓️ ${cal.month}월 도장판`
    q('board-stamps').textContent = `🌟 모은 도장 ${v.board.stamps}개`
    q('board-streak').textContent = `🔥 ${v.board.streak}일 이어 왔어요`
    q('board-missions').textContent = `📜 모은 미션 별 ${v.board.missions}개`
    const board = boardHtml(cal)
    if (board !== lastBoard) {
      lastBoard = board
      q('board').innerHTML = board
    }
    const week = v.board.week
    q('week-goal-text').textContent = weekGoalText(week)
    q('week-done').textContent = weekDoneText(week.doneWeeks)
    q('week-goal').classList.toggle('done', week.done)
    const row = weekRowHtml(week)
    if (row !== lastWeek) {
      lastWeek = row
      q('week-row').innerHTML = row
    }
    const hist = v.history
    q('hist-empty').hidden = !hist.empty
    q('hist-body').hidden = hist.empty
    if (!hist.empty) {
      q('hist-week').textContent = weekTotalText(hist.week)
      q('hist-best').textContent = hist.best ? bestDayText(hist.best) : ''
      const shown = v.historyPage(page)
      page = shown.page
      const day = shown.days.find((d) => d.key === picked)
      if (!day) picked = null
      q('hist-range').textContent = pageRangeText(
        shown.days.map((d) => d.key),
        page,
      )
      ;(q('hist-prev') as HTMLButtonElement).disabled = !shown.hasOlder
      ;(q('hist-next') as HTMLButtonElement).disabled = !shown.hasNewer
      const bars = historyBarsHtml(shown.days, picked)
      if (bars !== lastBars) {
        lastBars = bars
        q('hist-bars').innerHTML = bars
      }
      const tip = q('hist-tip')
      tip.hidden = !day
      const tipHtml = day ? dayTipHtml(day) : ''
      if (tipHtml !== lastTip) {
        lastTip = tipHtml
        tip.innerHTML = tipHtml
      }
      // 말풍선 꼬리가 누른 막대를 가리키게
      if (day) tip.style.setProperty('--at', `${((shown.days.indexOf(day) + 0.5) / 7) * 100}%`)
      const totals = historyTotalsHtml(hist)
      if (totals !== lastTotals) {
        lastTotals = totals
        q('hist-totals').innerHTML = totals
      }
    }
    const done = v.achievements.filter((a) => a.done).length
    q('ach-title').textContent = `🏆 업적 ${done} / ${v.achievements.length}`
    const ach = achievementsHtml(v.achievements)
    if (ach !== lastAch) {
      lastAch = ach
      q('achievements').innerHTML = ach
    }
    q('skill-points').innerHTML = `남은 포인트 <b>${v.points}</b>`
    const asked = SKILLS.find((s) => s.id === asking)
    q('skill-hint').textContent = asked
      ? `한 번 더 누르면 ${asked.name}${objectParticle(asked.name)} 배워요`
      : v.points > 0
        ? '하나를 골라 배워요. 같은 스킬을 또 배우면 더 강해져요.'
        : '운동해서 레벨을 올리면 포인트를 받아요.'
    q('skill-hint').classList.toggle('asking', !!asked)
    for (const s of SKILLS) {
      const rank = v.ranks[s.id]
      q(`skill-rank-${s.id}`).textContent = rank > 0 ? `Lv.${rank}` : ''
      q(`skill-${s.id}`).classList.toggle('known', rank > 0)
      q(`skill-${s.id}`).classList.toggle('asking', s.id === asking)
      const btn = q(`learn-${s.id}`) as HTMLButtonElement
      btn.disabled = v.points < 1
      btn.textContent = s.id === asking ? '정말?' : '배우기'
    }
  }

  for (const s of SKILLS) {
    q(`learn-${s.id}`).addEventListener('click', () => {
      if (asking === s.id) {
        asking = null
        h.onLearn(s.id)
      } else {
        asking = s.id
      }
      draw()
    })
  }
  q('hist-bars').addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key
    if (!key) return
    picked = picked === key ? null : key
    draw()
  })
  const turn = (by: number) => {
    page += by
    picked = null
    draw()
  }
  q('hist-prev').addEventListener('click', () => turn(1))
  q('hist-next').addEventListener('click', () => turn(-1))
  const close = () => {
    asking = null
    page = 0
    picked = null
    wrap.hidden = true
  }
  q('skills-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      draw()
      wrap.hidden = false
    },
    /** 열려 있는 동안 레벨이 오르면 포인트를 다시 그린다 */
    refresh() {
      if (!wrap.hidden) draw()
    },
  }
}
