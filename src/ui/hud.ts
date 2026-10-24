import { formatElapsed } from './format'

export interface HudView {
  level: number
  expIntoLevel: number
  expForNextLevel: number
  running: boolean
  elapsedMs: number
  todayMinutes: number
  todayCap: number
  capReached: boolean
  skillPoints: number
  /** 브라우저 저장소에 저장하지 못했으면 true */
  saveFailed: boolean
}

const TABS = [
  { label: '운동', ready: true },
  { label: '공부', ready: false },
  { label: '독서', ready: false },
  { label: '나', ready: true },
]

/** 레벨 바·타이머 카드·탭을 그리고, 가운데 Phaser 장면이 들어갈 자리를 돌려준다 */
export function createHud(
  root: HTMLElement,
  onToggle: () => void,
  onSettings: () => void,
  onMe: () => void,
  onAdventure: () => void,
  onDress: () => void,
) {
  root.innerHTML = `
    <header class="top">
      <div class="top-row">
        <span><b data-testid="level">Lv.1</b> 말랑이</span>
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
      </div>
      <div class="toast" data-testid="cap-toast" role="status" hidden>
        <b>오늘은 충분히 했어요!</b>
        <span>오늘 경험치는 다 모았어요. 내일 또 만나요</span>
        <button type="button" class="toast-close" data-testid="cap-toast-close" aria-label="닫기">✕</button>
      </div>
      <button type="button" class="adventure dress" data-testid="open-cosmetics">🎀 꾸미기</button>
      <button type="button" class="adventure" data-testid="open-stages">⚔️ 모험</button>
    </section>
    <section class="timer-card">
      <div class="today" data-testid="today"></div>
      <div class="timer-label" data-testid="timer-label"></div>
      <div class="timer" data-testid="timer">00:00</div>
      <button class="toggle" data-testid="toggle" type="button">운동 시작</button>
    </section>
    <nav class="tabs">
      ${TABS.map(
        (t, i) =>
          `<button type="button" class="tab${i === 0 ? ' on' : ''}" ${t.ready ? '' : 'disabled'}${
            t.label === '나' ? ' data-testid="tab-me"' : ''
          }>${t.label}${t.ready ? '' : '<small>준비 중</small>'}${
            t.label === '나' ? '<em class="tab-badge" data-testid="skill-badge" hidden></em>' : ''
          }</button>`,
      ).join('')}
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
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let levelUpTimer: ReturnType<typeof setTimeout> | undefined
  const hideToast = () => {
    toast.hidden = true
    clearTimeout(toastTimer)
  }
  toggle.addEventListener('click', onToggle)
  q('cap-toast-close').addEventListener('click', hideToast)
  q('open-settings').addEventListener('click', onSettings)
  q('save-warning-backup').addEventListener('click', onSettings)
  const saveWarning = q('save-warning')
  q('tab-me').addEventListener('click', onMe)
  q('open-stages').addEventListener('click', onAdventure)
  q('open-cosmetics').addEventListener('click', onDress)
  const skillBadge = q('skill-badge')

  return {
    sceneHost: q('scene'),
    render(v: HudView) {
      level.textContent = `Lv.${v.level}`
      expText.textContent = `EXP ${v.expIntoLevel} / ${v.expForNextLevel}`
      expBar.style.width = `${Math.min(100, (v.expIntoLevel / v.expForNextLevel) * 100)}%`
      today.textContent = `오늘 ${v.todayMinutes}분 / ${v.todayCap}분`
      today.classList.toggle('full', v.capReached)
      label.textContent = v.capReached
        ? '오늘은 충분히 했어요 · 경험치는 내일 다시 쌓여요'
        : v.running
          ? '운동 중 · 경험치가 쌓이고 있어요'
          : '운동하는 동안 경험치가 쌓여요'
      timer.textContent = formatElapsed(v.running ? v.elapsedMs : 0)
      toggle.textContent = v.running ? '그만하기' : '운동 시작'
      toggle.classList.toggle('running', v.running)
      skillBadge.hidden = v.skillPoints < 1
      skillBadge.textContent = String(v.skillPoints)
      saveWarning.hidden = !v.saveFailed
    },
    /** 하루 상한에 닿았다는 안내를 잠깐 띄운다 */
    showCapToast() {
      toast.hidden = false
      clearTimeout(toastTimer)
      toastTimer = setTimeout(hideToast, 6000)
    },
    /** 레벨이 오른 순간 축하 배지를 띄우고 레벨 글자를 통통 튀게 한다 */
    showLevelUp(newLevel: number) {
      levelUpLevel.textContent = `Lv.${newLevel} 달성!`
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
