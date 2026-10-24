import { COSMETICS, type Cosmetic, type Worn } from '../core/cosmetics'
import { STAGES } from '../core/stages'

export interface CosmeticsView {
  owned: Cosmetic[]
  worn: Worn
}

const stageLabel = (no: number) => (STAGES[no - 1]?.boss ? '보스' : `${no}스테이지`)

/** 꾸미기 창: 가진 모자·색을 골라 말랑이에게 입힌다. 아직 없는 건 얻는 곳을 알려 준다 */
export function createCosmetics(root: HTMLElement, h: { view(): CosmeticsView; onWear(id: string): void }) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'cosmetics'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="cosmetics-title">
      <h2 id="cosmetics-title">말랑이 꾸미기</h2>
      <p class="sheet-desc" data-testid="cosmetics-desc"></p>
      <ul class="cosmetic-grid" data-testid="cosmetic-grid"></ul>
      <p class="sheet-desc cosmetic-note">꾸미기는 모습만 바꿔요. 힘은 운동으로 키워요!</p>
      <button type="button" class="sheet-close" data-testid="cosmetics-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const grid = q('cosmetic-grid')

  const draw = () => {
    const v = h.view()
    const wornIds = [v.worn.hat?.id, v.worn.color?.id]
    q('cosmetics-desc').textContent =
      v.owned.length > 0 ? `모자 하나, 색 하나를 골라 입혀요 · ${v.owned.length} / ${COSMETICS.length}개 모았어요` : '스테이지를 처음 깨면 꾸미기를 받아요.'
    grid.innerHTML = COSMETICS.map((c) => {
      const owned = v.owned.some((o) => o.id === c.id)
      const worn = wornIds.includes(c.id)
      const state = worn ? 'worn' : owned ? 'owned' : 'locked'
      const kind = c.kind === 'hat' ? '모자' : '색'
      const btn = owned
        ? `<button type="button" class="cosmetic-wear" data-id="${c.id}" data-testid="wear-${c.id}">${worn ? '벗기' : '입기'}</button>`
        : `<span class="cosmetic-lock">🔒 ${stageLabel(c.stage)}</span>`
      return `
        <li class="cosmetic ${state}" data-testid="cosmetic-${c.id}" data-state="${state}">
          <span class="cosmetic-icon" aria-hidden="true">${owned ? c.icon : '❔'}</span>
          <b>${owned ? c.name : '???'}</b>
          <small>${worn ? `${kind} · 입는 중` : kind}</small>
          ${btn}
        </li>`
    }).join('')
  }

  grid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cosmetic-wear')
    if (!btn) return
    h.onWear(btn.dataset.id!)
    draw()
  })
  const close = () => (wrap.hidden = true)
  q('cosmetics-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      draw()
      wrap.hidden = false
    },
  }
}
