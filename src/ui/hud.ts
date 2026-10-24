import { formatElapsed } from './format'

export interface HudView {
  level: number
  expIntoLevel: number
  expForNextLevel: number
  running: boolean
  elapsedMs: number
}

const TABS = [
  { label: '운동', ready: true },
  { label: '공부', ready: false },
  { label: '독서', ready: false },
  { label: '나', ready: false },
]

/** 레벨 바·타이머 카드·탭을 그리고, 가운데 Phaser 장면이 들어갈 자리를 돌려준다 */
export function createHud(root: HTMLElement, onToggle: () => void, onSettings: () => void) {
  root.innerHTML = `
    <header class="top">
      <div class="top-row">
        <span><b data-testid="level">Lv.1</b> 말랑이</span>
        <span class="exp-text" data-testid="exp-text"></span>
        <button type="button" class="gear" data-testid="open-settings" aria-label="설정">⚙</button>
      </div>
      <div class="bar"><i data-testid="exp-bar"></i></div>
    </header>
    <section class="scene" data-testid="scene"></section>
    <section class="timer-card">
      <div class="timer-label" data-testid="timer-label"></div>
      <div class="timer" data-testid="timer">00:00</div>
      <button class="toggle" data-testid="toggle" type="button">운동 시작</button>
    </section>
    <nav class="tabs">
      ${TABS.map(
        (t, i) =>
          `<button type="button" class="tab${i === 0 ? ' on' : ''}" ${t.ready ? '' : 'disabled'}>${t.label}${
            t.ready ? '' : '<small>준비 중</small>'
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
  toggle.addEventListener('click', onToggle)
  q('open-settings').addEventListener('click', onSettings)

  return {
    sceneHost: q('scene'),
    render(v: HudView) {
      level.textContent = `Lv.${v.level}`
      expText.textContent = `EXP ${v.expIntoLevel} / ${v.expForNextLevel}`
      expBar.style.width = `${Math.min(100, (v.expIntoLevel / v.expForNextLevel) * 100)}%`
      label.textContent = v.running ? '운동 중 · 경험치가 쌓이고 있어요' : '운동하는 동안 경험치가 쌓여요'
      timer.textContent = formatElapsed(v.running ? v.elapsedMs : 0)
      toggle.textContent = v.running ? '그만하기' : '운동 시작'
      toggle.classList.toggle('running', v.running)
    },
  }
}
