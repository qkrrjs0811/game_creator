import type { Cosmetic, CosmeticKind, Worn } from '../core/cosmetics'
import { endlessStage } from '../core/endless'
import { stageLabel } from './stages'

export interface CosmeticsView {
  /** 보여 줄 꾸미기(가진 것과 다음에 얻을 것) */
  catalog: Cosmetic[]
  owned: Cosmetic[]
  worn: Worn
}

const KINDS: { kind: CosmeticKind; name: string; icon: string }[] = [
  { kind: 'hat', name: '모자', icon: '🎩' },
  { kind: 'color', name: '색', icon: '🎨' },
]

/** 아직 없는 꾸미기를 얻는 곳. 장 모자는 "1장 보스", 도장 모자는 "도장 7개" */
function where(c: Cosmetic): string {
  if (c.stamps !== undefined) return `도장 ${c.stamps}개`
  return c.chapter ? `${c.chapter}장 보스` : stageLabel(endlessStage(c.stage ?? 1))
}

/** 장 모자는 같은 그림이 여러 색으로 나와서 아이콘 바탕을 모자 색으로 칠한다 */
function tint(c: Cosmetic): string {
  return c.hat ? ` style="background:${c.hat.color}"` : ''
}

/**
 * 꾸미기 창: 가진 모자·색을 골라 말랑이에게 입힌다. 아직 없는 건 얻는 곳을 알려 준다.
 * 꾸미기가 많아도 고르기 쉽게 모자·색 칸으로 나눠 보고, 지금 입은 것을 위에 보여 준다.
 */
export function createCosmetics(root: HTMLElement, h: { view(): CosmeticsView; onWear(id: string): void }) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'cosmetics'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="cosmetics-title">
      <h2 id="cosmetics-title">말랑이 꾸미기</h2>
      <p class="sheet-desc" data-testid="cosmetics-desc"></p>
      <div class="cosmetic-worn" data-testid="cosmetic-worn"></div>
      <div class="cosmetic-tabs" role="tablist" data-testid="cosmetic-tabs"></div>
      <ul class="cosmetic-grid" data-testid="cosmetic-grid"></ul>
      <p class="sheet-desc cosmetic-note">꾸미기는 모습만 바꿔요. 힘은 운동으로 키워요!</p>
      <button type="button" class="sheet-close" data-testid="cosmetics-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const grid = q('cosmetic-grid')
  const tabs = q('cosmetic-tabs')
  const wornBar = q('cosmetic-worn')
  let shown: CosmeticKind = 'hat'

  const draw = () => {
    const v = h.view()
    const wornIds = [v.worn.hat?.id, v.worn.color?.id]
    q('cosmetics-desc').textContent =
      v.owned.length > 0 ? `모자 하나, 색 하나를 골라 입혀요 · ${v.owned.length}개 모았어요` : '스테이지를 처음 깨거나 도장을 모으면 꾸미기를 받아요.'

    // 지금 입은 것: 누르면 그 칸으로 가서 보여 준다
    wornBar.hidden = v.owned.length === 0
    wornBar.innerHTML = KINDS.map(({ kind, name }) => {
      const c = v.worn[kind]
      return `
        <button type="button" class="cosmetic-worn-chip${c ? '' : ' none'}" data-kind="${kind}" data-testid="worn-${kind}">
          <span class="cosmetic-worn-icon" aria-hidden="true"${c ? tint(c) : ''}>${c ? c.icon : '·'}</span>
          <span class="cosmetic-worn-text"><small>${name}</small><b>${c ? c.name : '안 입었어요'}</b></span>
        </button>`
    }).join('')

    tabs.innerHTML = KINDS.map(({ kind, name, icon }) => {
      const n = v.owned.filter((c) => c.kind === kind).length
      const on = kind === shown
      return `<button type="button" role="tab" class="cosmetic-tab${on ? ' on' : ''}" aria-selected="${on}" data-kind="${kind}" data-testid="cosmetic-tab-${kind}">${icon} ${name} <small>${n}</small></button>`
    }).join('')

    grid.dataset.kind = shown
    grid.innerHTML = v.catalog.filter((c) => c.kind === shown).map((c) => {
      const owned = v.owned.some((o) => o.id === c.id)
      const worn = wornIds.includes(c.id)
      const state = worn ? 'worn' : owned ? 'owned' : 'locked'
      const kind = c.kind === 'hat' ? '모자' : '색'
      const btn = owned
        ? `<button type="button" class="cosmetic-wear" data-id="${c.id}" data-testid="wear-${c.id}">${worn ? '벗기' : '입기'}</button>`
        : `<span class="cosmetic-lock">🔒 ${where(c)}</span>`
      return `
        <li class="cosmetic ${state}" data-testid="cosmetic-${c.id}" data-state="${state}">
          <span class="cosmetic-icon" aria-hidden="true"${owned ? tint(c) : ''}>${owned ? c.icon : '❔'}</span>
          <b>${owned ? c.name : '???'}</b>
          <small>${worn ? `${kind} · 입는 중` : kind}</small>
          ${btn}
        </li>`
    }).join('')
  }

  /** 입은 꾸미기가 목록 안에 보이게 넘긴다(목록만 넘기고 창은 그대로) */
  const showWorn = () => {
    const card = grid.querySelector<HTMLElement>('.cosmetic.worn')
    if (!card) {
      grid.scrollTop = 0
      return
    }
    // 목록이 position: relative라 칸의 offsetTop은 목록 안 위치다
    const top = card.offsetTop
    if (top < grid.scrollTop || top + card.offsetHeight > grid.scrollTop + grid.clientHeight) {
      grid.scrollTop = Math.max(0, top - (grid.clientHeight - card.offsetHeight) / 2)
    }
  }

  const pick = (kind: CosmeticKind) => {
    shown = kind
    draw()
    showWorn()
  }

  grid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cosmetic-wear')
    if (!btn) return
    h.onWear(btn.dataset.id!)
    const top = grid.scrollTop
    draw()
    grid.scrollTop = top
  })
  tabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cosmetic-tab')
    if (btn) pick(btn.dataset.kind as CosmeticKind)
  })
  wornBar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cosmetic-worn-chip')
    if (btn) pick(btn.dataset.kind as CosmeticKind)
  })
  const close = () => (wrap.hidden = true)
  q('cosmetics-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      wrap.hidden = false
      pick(shown)
    },
  }
}
