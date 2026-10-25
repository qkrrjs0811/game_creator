import { formatElapsed, goalText, objectJosa, topicJosa } from './format'
import { ACTIVITIES } from '../core/activities'
import type { TodayGoal } from '../core/goal'
import type { ActivityId } from '../core/types'

export interface HudView {
  level: number
  expIntoLevel: number
  expForNextLevel: number
  /** 지금 고른 활동 탭 */
  activity: ActivityId
  /** 켜져 있는 타이머의 활동. 꺼져 있으면 null */
  live: ActivityId | null
  /** 고른 활동의 타이머가 켜져 있는지 */
  running: boolean
  elapsedMs: number
  todayMinutes: number
  todayCap: number
  capReached: boolean
  skillPoints: number
  /** 브라우저 저장소에 저장하지 못했으면 true */
  saveFailed: boolean
  /** 모든 활동을 합친 오늘 목표 진행 */
  goal: TodayGoal
}

/** 활동마다 타이머 카드에 쓰는 안내 */
const ACTIVITY_TEXT: Record<ActivityId, { idle: string; running: string }> = {
  exercise: { idle: '운동하는 동안 경험치가 쌓여요', running: '운동 중 · 경험치가 쌓이고 있어요' },
  study: { idle: '공부하는 동안 지능이 올라요', running: '공부 중 · 지능이 오르고 있어요' },
  reading: { idle: '독서하는 동안 집중이 올라요', running: '독서 중 · 집중이 오르고 있어요' },
  relax: { idle: '푹 쉬는 동안 체력이 조금 올라요', running: '휴식 중 · 체력이 조금씩 올라요' },
}

const TABS: { label: string; activity?: ActivityId; testid?: string }[] = [
  { label: '운동', activity: 'exercise' },
  { label: '공부', activity: 'study' },
  { label: '독서', activity: 'reading' },
  { label: '휴식', activity: 'relax' },
  { label: '나', testid: 'tab-me' },
]

/** 레벨 바·타이머 카드·탭을 그리고, 가운데 Phaser 장면이 들어갈 자리를 돌려준다 */
export function createHud(
  root: HTMLElement,
  onToggle: () => void,
  onSettings: () => void,
  onMe: () => void,
  onAdventure: () => void,
  onDress: () => void,
  onSelect: (activity: ActivityId) => void,
) {
  root.innerHTML = `
    <header class="top">
      <div class="top-row">
        <span><b data-testid="level">Lv.1</b> <span data-testid="char-name">말랑이</span></span>
        <span class="exp-text" data-testid="exp-text"></span>
        <button type="button" class="gear" data-testid="open-settings" aria-label="설정">⚙</button>
      </div>
      <div class="bar"><i data-testid="exp-bar"></i></div>
    </header>
    <div class="save-warn" data-testid="save-warning" role="alert" hidden>
      <div class="save-warn-text">
        <b>⚠️ 기록이 저장되지 않고 있어요</b>
        <span>창을 닫으면 사라질 수 있어요. 백업 파일로 받아 두세요</span>
      </div>
      <button type="button" class="save-warn-action" data-testid="save-warning-backup">백업 받기</button>
    </div>
    <section class="scene" data-testid="scene">
      <div class="levelup" data-testid="levelup" role="status" hidden>
        <b>레벨 업!</b>
        <span data-testid="levelup-level"></span>
        <small class="levelup-points" data-testid="levelup-points"></small>
      </div>
      <div class="away" data-testid="away" role="status" hidden>
        <b data-testid="away-title"></b>
        <span data-testid="away-did"></span>
        <span class="away-gain" data-testid="away-gain"></span>
        <div class="away-chips" data-testid="away-chips"></div>
        <button type="button" class="toast-close" data-testid="away-close" aria-label="닫기">✕</button>
      </div>
      <div class="toast" data-testid="cap-toast" role="status" hidden>
        <b>오늘은 충분히 했어요!</b>
        <span>오늘 경험치는 다 모았어요. 내일 또 만나요</span>
        <button type="button" class="toast-close" data-testid="cap-toast-close" aria-label="닫기">✕</button>
      </div>
      <div class="toast summary" data-testid="session-summary" role="status" hidden>
        <b data-testid="session-summary-title"></b>
        <span data-testid="session-summary-detail"></span>
        <button type="button" class="toast-close" data-testid="session-summary-close" aria-label="닫기">✕</button>
      </div>
      <button type="button" class="adventure dress" data-testid="open-cosmetics">🎀 꾸미기</button>
      <button type="button" class="adventure" data-testid="open-stages">⚔️ 모험</button>
    </section>
    <section class="timer-card">
      <div class="goal" data-testid="goal">
        <span class="goal-text" data-testid="goal-text"></span>
        <span class="goal-bar"><i data-testid="goal-bar"></i></span>
      </div>
      <div class="stamp" data-testid="stamp" role="status" hidden>🌟 오늘 도장 쾅!</div>
      <div class="today" data-testid="today"></div>
      <div class="timer-label" data-testid="timer-label"></div>
      <div class="timer" data-testid="timer">00:00</div>
      <button class="toggle" data-testid="toggle" type="button">운동 시작</button>
    </section>
    <nav class="tabs">
      ${TABS.map((t) => {
        const ready = t.activity !== undefined || t.testid !== undefined
        const id = t.activity ? `tab-${t.activity}` : t.testid
        return `<button type="button" class="tab" ${ready ? '' : 'disabled'}${id ? ` data-testid="${id}"` : ''}${
          t.activity ? ` data-activity="${t.activity}"` : ''
        }>${t.label}${ready ? '' : '<small>준비 중</small>'}${
          t.activity ? `<small class="tab-live" data-testid="tab-live-${t.activity}" hidden>⏱ 켜짐</small>` : ''
        }${t.testid === 'tab-me' ? '<em class="tab-badge" data-testid="skill-badge" hidden></em>' : ''}</button>`
      }).join('')}
    </nav>`

  const q = (id: string) => root.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const level = q('level')
  const expText = q('exp-text')
  const expBar = q('exp-bar')
  const label = q('timer-label')
  const timer = q('timer')
  const toggle = q('toggle')
  const today = q('today')
  const toast = q('cap-toast')
  const levelUp = q('levelup')
  const levelUpLevel = q('levelup-level')
  const levelUpPoints = q('levelup-points')
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let levelUpTimer: ReturnType<typeof setTimeout> | undefined
  const hideToast = () => {
    toast.hidden = true
    clearTimeout(toastTimer)
  }
  const summary = q('session-summary')
  let summaryTimer: ReturnType<typeof setTimeout> | undefined
  const hideSummary = () => {
    summary.hidden = true
    clearTimeout(summaryTimer)
  }
  toggle.addEventListener('click', onToggle)
  q('cap-toast-close').addEventListener('click', hideToast)
  q('session-summary-close').addEventListener('click', hideSummary)
  q('open-settings').addEventListener('click', onSettings)
  q('save-warning-backup').addEventListener('click', onSettings)
  const saveWarning = q('save-warning')
  q('tab-me').addEventListener('click', onMe)
  q('open-stages').addEventListener('click', onAdventure)
  q('open-cosmetics').addEventListener('click', onDress)
  const skillBadge = q('skill-badge')
  const activityTabs = [...root.querySelectorAll<HTMLElement>('[data-activity]')]
  for (const tab of activityTabs) tab.addEventListener('click', () => onSelect(tab.dataset.activity as ActivityId))
  const toastDetail = toast.querySelector('span')!
  const goal = q('goal')
  const goalLabel = q('goal-text')
  const goalBar = q('goal-bar')
  const stamp = q('stamp')
  let stampTimer: ReturnType<typeof setTimeout> | undefined
  const away = q('away')
  const hideAway = () => (away.hidden = true)
  q('away-close').addEventListener('click', hideAway)

  return {
    sceneHost: q('scene'),
    render(v: HudView) {
      level.textContent = `Lv.${v.level}`
      expText.textContent = `EXP ${v.expIntoLevel} / ${v.expForNextLevel}`
      expBar.style.width = `${Math.min(100, (v.expIntoLevel / v.expForNextLevel) * 100)}%`
      today.textContent = `오늘 ${v.todayMinutes}분 / ${v.todayCap}분`
      today.classList.toggle('full', v.capReached)
      const name = ACTIVITIES[v.activity].label
      // 다른 활동 타이머가 켜져 있으면 동시에 켤 수 없어 시작 버튼을 막는다
      const busy = v.live !== null && v.live !== v.activity
      label.textContent = busy
        ? `${ACTIVITIES[v.live!].label} 중이에요 · 그만하면 ${name}${objectJosa(name)} 켤 수 있어요`
        : v.capReached
          ? '오늘은 충분히 했어요 · 경험치는 내일 다시 쌓여요'
          : v.running
            ? ACTIVITY_TEXT[v.activity].running
            : ACTIVITY_TEXT[v.activity].idle
      timer.textContent = formatElapsed(v.running ? v.elapsedMs : 0)
      toggle.textContent = v.running ? '그만하기' : `${name} 시작`
      toggle.classList.toggle('running', v.running)
      ;(toggle as HTMLButtonElement).disabled = busy
      for (const tab of activityTabs) {
        const id = tab.dataset.activity as ActivityId
        tab.classList.toggle('on', id === v.activity)
        tab.setAttribute('aria-pressed', String(id === v.activity))
        tab.querySelector<HTMLElement>('.tab-live')!.hidden = v.live !== id
      }
      skillBadge.hidden = v.skillPoints < 1
      skillBadge.textContent = String(v.skillPoints)
      saveWarning.hidden = !v.saveFailed
      goalLabel.textContent = goalText(v.goal)
      goalBar.style.width = `${Math.min(100, (v.goal.minutes / v.goal.goal) * 100)}%`
      goal.classList.toggle('done', v.goal.done)
    },
    /** 오늘 목표를 채운 순간 타이머 카드에 도장을 쾅 찍는다 */
    showStamp() {
      stamp.hidden = true
      void stamp.offsetWidth
      stamp.hidden = false
      clearTimeout(stampTimer)
      stampTimer = setTimeout(() => (stamp.hidden = true), 3500)
    },
    /** 하루 상한에 닿았다는 안내를 잠깐 띄운다 */
    showCapToast(activity: ActivityId) {
      hideSummary()
      // 한 줄에 들어가게 짧게 쓴다(두 줄이면 카드가 말랑이를 가린다)
      const name = ACTIVITIES[activity].label
      toastDetail.textContent = `오늘 ${name}${topicJosa(name)} 여기까지! 내일 또 만나요`
      toast.hidden = false
      clearTimeout(toastTimer)
      toastTimer = setTimeout(hideToast, 6000)
    },
    /** 활동을 그만둔 순간 이번에 얻은 것을 잠깐 띄운다(상한 안내와 같은 자리라 그건 닫는다) */
    showSessionSummary(s: { title: string; detail: string }) {
      hideToast()
      q('session-summary-title').textContent = s.title
      q('session-summary-detail').textContent = s.detail
      summary.hidden = true
      void summary.offsetWidth
      summary.hidden = false
      clearTimeout(summaryTimer)
      summaryTimer = setTimeout(hideSummary, 6000)
    },
    /** 운동을 다시 시작하면 지난 요약은 닫는다 */
    hideSessionSummary: hideSummary,
    /** 전투를 시작하면 장면 아래쪽 안내(마침 요약·상한 안내)를 닫는다. 전투 띠와 말랑이를 가리지 않게 */
    hideToasts() {
      hideSummary()
      hideToast()
      hideAway()
    },
    /** 다시 열 때 자리 비운 동안 늘어난 것을 장면 위쪽에 띄운다. 닫기 전까지 남는다(레벨업 배지 자리를 대신 쓴다) */
    showAway(c: { title: string; did: string; gain: string; chips: string[] }) {
      levelUp.hidden = true
      q('away-title').textContent = c.title
      const did = q('away-did')
      did.textContent = c.did
      did.hidden = c.did === ''
      q('away-gain').textContent = c.gain
      const chips = q('away-chips')
      chips.replaceChildren(
        ...c.chips.map((t) => {
          const chip = document.createElement('em')
          chip.textContent = t
          return chip
        }),
      )
      chips.hidden = c.chips.length === 0
      away.hidden = true
      void away.offsetWidth
      away.hidden = false
    },
    /** 레벨이 오른 순간 축하 배지를 띄우고 레벨 글자를 통통 튀게 한다. 받은 스킬 포인트는 "나" 탭으로 안내한다 */
    showLevelUp(newLevel: number, points: number) {
      // 같은 자리라 지난 자리 비운 동안 카드는 닫는다
      hideAway()
      levelUpLevel.textContent = `Lv.${newLevel} 달성!`
      levelUpPoints.textContent = `✨ 스킬 포인트 +${points} · 나 탭에서 골라요`
      // 연달아 오르면 애니메이션을 처음부터 다시 돌린다
      levelUp.hidden = true
      level.classList.remove('pop')
      void levelUp.offsetWidth
      levelUp.hidden = false
      level.classList.add('pop')
      clearTimeout(levelUpTimer)
      levelUpTimer = setTimeout(() => {
        levelUp.hidden = true
        level.classList.remove('pop')
      }, 3500)
    },
  }
}
