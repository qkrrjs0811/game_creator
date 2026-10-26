/** 모음 창 칸: 꾸미기·도감을 한 창에서 오간다 */
export type CollectionTab = 'cosmetics' | 'dex'

const TABS: { tab: CollectionTab; label: string }[] = [
  { tab: 'cosmetics', label: '🎀 꾸미기' },
  { tab: 'dex', label: '📚 도감' },
]

/** 모음 창 맨 위 제목과 칸 고르기 줄. 꾸미기 창과 도감 창이 같은 줄을 쓴다 */
export function collectionHead(active: CollectionTab, titleId: string): string {
  const tabs = TABS.map(({ tab, label }) => {
    const on = tab === active
    return `<button type="button" role="tab" class="collect-tab${on ? ' on' : ''}" aria-selected="${on}" data-tab="${tab}" data-testid="collect-tab-${tab}">${label}</button>`
  }).join('')
  return `<h2 id="${titleId}" class="collect-title">🎁 모음</h2><div class="collect-tabs" role="tablist" data-testid="collect-tabs">${tabs}</div>`
}

/** 칸 고르기 줄을 누르면 다른 칸으로 간다(지금 칸은 그대로) */
export function bindCollectionTabs(wrap: HTMLElement, active: CollectionTab, onPick: (tab: CollectionTab) => void) {
  wrap.querySelector('.collect-tabs')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.collect-tab')
    const tab = btn?.dataset.tab as CollectionTab | undefined
    if (tab && tab !== active) onPick(tab)
  })
}
