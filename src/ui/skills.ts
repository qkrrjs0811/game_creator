import { SKILLS, type SkillId } from '../core/skills'
import type { StatRow } from '../core/stats'
import type { StampCalendar } from '../core/goal'
import type { WeekGoal } from '../core/week'
import { weekDoneText, weekGoalText } from './format'

export interface SkillsView {
  points: number
  ranks: Record<SkillId, number>
  stats: StatRow[]
  board: { calendar: StampCalendar; stamps: number; streak: number; week: WeekGoal }
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
  const close = () => {
    asking = null
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
