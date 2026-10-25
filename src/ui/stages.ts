import { chapterStages } from '../core/endless'
import { formatMinutes } from './format'

/** 다음에 깰 스테이지를 운동 몇 분 더 하면 이길 만한지(nextStageAdvice). 0이면 지금도 이길 만하다 */
export type StageAdvice = { no: number; toWin: number | null } | null

function adviceText(toWin: number | null): string {
  if (toWin === null) return '💪 운동으로 더 키워서 와요'
  if (toWin === 0) return '🍀 지금도 이길 만해요'
  return `💪 운동 ${formatMinutes(toWin)} 더 하면 이길 만해요`
}

/** 스테이지 이름 앞에 붙는 말: 장 보스는 "보스", 나머지는 "N스테이지" */
export const stageLabel = (s: { no: number; boss: boolean }) => (s.boss ? '보스' : `${s.no}스테이지`)

/** 스테이지 창: 지금 장의 스테이지 10칸과 깸·도전 가능·잠김 상태 */
export function createStages(
  root: HTMLElement,
  h: { progress(): number; advice(): StageAdvice; onChallenge(no: number): void },
) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'stages'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="stages-title">
      <h2 id="stages-title">모험 지도</h2>
      <p class="stage-chapter" data-testid="stage-chapter"></p>
      <p class="sheet-desc">이기면 다음 스테이지가 열려요.<br />깬 곳도 언제든 다시 도전할 수 있어요.</p>
      <ul class="stage-list" data-testid="stage-list"></ul>
      <p class="sheet-msg" data-testid="stage-msg" role="status"></p>
      <button type="button" class="sheet-close" data-testid="stages-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const list = q('stage-list')
  const msg = q('stage-msg')

  const draw = () => {
    const advice = h.advice()
    const stages = chapterStages(h.progress())
    q('stage-chapter').textContent = `${stages[0].chapter}장 · ${stages[0].chapterName}`
    list.innerHTML = stages
      .map((s) => {
        // 잠긴 곳의 몬스터는 열릴 때까지 비밀로 둔다
        const foe = s.monster.name
        const tag = s.state === 'cleared' ? `${foe} · 깼어요 ⭐` : s.state === 'open' ? `${foe} · 도전!` : '앞 스테이지를 깨면 열려요'
        // 아직 못 깬 다음 스테이지에는 얼마나 더 키우면 이길 만한지 알려 준다(도전은 언제든 할 수 있다)
        const hint =
          advice && advice.no === s.no
            ? `<span class="stage-hint" data-testid="stage-hint">${adviceText(advice.toWin)}</span>`
            : ''
        const btn =
          s.state === 'locked'
            ? `<span class="stage-lock" aria-label="잠김">🔒</span>`
            : `<button type="button" class="stage-go" data-no="${s.no}" data-testid="stage-go-${s.no}">${
                s.state === 'cleared' ? '다시' : '도전'
              }</button>`
        return `
          <li class="stage ${s.state}${s.boss ? ' boss' : ''}" data-testid="stage-${s.no}" data-state="${s.state}">
            <span class="stage-icon" aria-hidden="true">${s.icon}</span>
            <span class="stage-text">
              <b>${stageLabel(s)} · ${s.name}</b>
              <span>${tag}</span>${hint}
            </span>
            ${btn}
          </li>`
      })
      .join('')
  }

  /** 열 때 다음에 깰 스테이지가 목록 안에 보이게 한다 */
  const showOpen = () => {
    const open = list.querySelector<HTMLElement>('.stage.open')
    list.scrollTop = open ? Math.max(0, open.offsetTop - list.clientHeight / 2 + open.offsetHeight / 2) : 0
  }

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.stage-go')
    if (btn) h.onChallenge(Number(btn.dataset.no))
  })
  const close = () => (wrap.hidden = true)
  q('stages-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      msg.textContent = ''
      draw()
      wrap.hidden = false
      showOpen()
    },
    close,
    say(text: string) {
      msg.textContent = text
    },
  }
}
