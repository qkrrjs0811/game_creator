import { chapterBrowse, chapterStages } from '../core/endless'
import { WINNABLE_MAX } from '../core/coach'
import { stageTrait, traitLabel } from '../core/traits'
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

/** 스테이지 창: 지금 장의 스테이지 10칸과 깸·도전 가능·잠김 상태. 앞 장들과 바로 다음 장도 넘겨 볼 수 있다 */
export function createStages(
  root: HTMLElement,
  h: {
    progress(): number
    advice(): StageAdvice
    /** 다음 스테이지부터 줄줄이 이길 만한 수(winnableStages). 1 이상이면 자동 진행 버튼을 보여 준다 */
    winnable(): number
    onChallenge(no: number): void
    onAutoRun(): void
    onDex(): void
  },
) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'stages'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="stages-title">
      <h2 id="stages-title">모험 지도</h2>
      <div class="chapter-nav">
        <button type="button" class="chapter-step" data-testid="chapter-prev" aria-label="앞 장">◀</button>
        <p class="stage-chapter" data-testid="stage-chapter"></p>
        <button type="button" class="chapter-step" data-testid="chapter-next" aria-label="다음 장">▶</button>
      </div>
      <p class="sheet-desc">이기면 다음 스테이지가 열려요.<br />깬 곳도 언제든 다시 도전할 수 있어요.</p>
      <button type="button" class="auto-run" data-testid="auto-run" hidden></button>
      <ul class="stage-list" data-testid="stage-list"></ul>
      <p class="sheet-msg" data-testid="stage-msg" role="status"></p>
      <div class="sheet-foot">
        <button type="button" class="dex-open" data-testid="open-dex">📚 도감</button>
        <button type="button" class="sheet-close" data-testid="stages-close">닫기</button>
      </div>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const list = q('stage-list')
  const msg = q('stage-msg')

  const prev = q('chapter-prev') as HTMLButtonElement
  const next = q('chapter-next') as HTMLButtonElement
  /** 보고 있는 장. 열 때마다 지금 장으로 돌아온다 */
  let viewing: number | undefined

  const autoBtn = q('auto-run') as HTMLButtonElement

  const draw = () => {
    const advice = h.advice()
    const winnable = h.winnable()
    autoBtn.hidden = winnable === 0
    autoBtn.textContent = `⏩ 자동 진행 · 이길 만한 ${winnable >= WINNABLE_MAX ? `${WINNABLE_MAX}개 이상` : `${winnable}개`}`
    const view = chapterBrowse(h.progress(), viewing)
    viewing = view.chapter
    prev.disabled = !view.prev
    next.disabled = !view.next
    const stages = chapterStages(h.progress(), view.chapter)
    // 아직 안 열린 장은 장 이름과 그 장 스테이지 이름을 비밀로 둔다(스테이지 이름에 장 이름이 들어 있다)
    const chip = q('stage-chapter')
    chip.textContent = `${view.chapter}장 · ${view.revealed ? stages[0].chapterName : '???'}`
    chip.classList.toggle('secret', !view.revealed)
    const locked = view.revealed ? '앞 스테이지를 깨면 열려요' : '앞 장 보스를 깨면 열려요'
    list.innerHTML = stages
      .map((s) => {
        // 잠긴 곳의 몬스터는 열릴 때까지 비밀로 둔다
        const foe = s.monster.name
        const tag = s.state === 'cleared' ? `${foe} · 깼어요 ⭐` : s.state === 'open' ? `${foe} · 도전!` : locked
        // 아직 못 깬 다음 스테이지에는 얼마나 더 키우면 이길 만한지 알려 준다(도전은 언제든 할 수 있다)
        const hint =
          advice && advice.no === s.no
            ? `<span class="stage-hint" data-testid="stage-hint">${adviceText(advice.toWin)}</span>`
            : ''
        // 열린 곳에는 몬스터 성격과 약점을 붙여, 어떤 활동이 잘 통할지 미리 보여 준다
        const label = s.state === 'locked' ? null : traitLabel(stageTrait(s.no))
        const trait = label ? `<span class="stage-trait" data-testid="stage-trait-${s.no}">${label}</span>` : ''
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
              <b>${stageLabel(s)} · ${view.revealed ? s.name : '???'}</b>
              <span>${tag}</span>${trait}${hint}
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

  const turn = (step: number) => {
    viewing = (viewing ?? chapterBrowse(h.progress()).chapter) + step
    draw()
    showOpen()
  }
  autoBtn.addEventListener('click', () => h.onAutoRun())
  q('open-dex').addEventListener('click', () => h.onDex())
  prev.addEventListener('click', () => turn(-1))
  next.addEventListener('click', () => turn(1))

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
      viewing = undefined
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
