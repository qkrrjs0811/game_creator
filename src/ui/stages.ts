import { stageList } from '../core/stages'
import { stageMonster } from '../core/monsters'

/** 스테이지 창: 스테이지 목록과 깸·도전 가능·잠김 상태 */
export function createStages(root: HTMLElement, h: { progress(): number; onChallenge(no: number): void }) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'stages'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="stages-title">
      <h2 id="stages-title">모험 지도</h2>
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
    list.innerHTML = stageList(h.progress())
      .map((s) => {
        // 잠긴 곳의 몬스터는 열릴 때까지 비밀로 둔다
        const foe = stageMonster(s.no).name
        const tag = s.state === 'cleared' ? `${foe} · 깼어요 ⭐` : s.state === 'open' ? `${foe} · 도전!` : '앞 스테이지를 깨면 열려요'
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
              <b>${s.boss ? '보스' : `${s.no}스테이지`} · ${s.name}</b>
              <span>${tag}</span>
            </span>
            ${btn}
          </li>`
      })
      .join('')
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
    },
    close,
    say(text: string) {
      msg.textContent = text
    },
  }
}
