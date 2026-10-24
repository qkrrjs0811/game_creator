/** 전투가 끝나면 장면 위쪽에 띄우는 결과 카드 내용 */
export interface BattleResultView {
  win: boolean
  rounds: number
  /** 결과 아래에 덧붙이는 한 줄(새로 열린 스테이지, 다시 오라는 말 등) */
  note: string
  /** 처음 깨서 받은 꾸미기 한 줄. 없으면 숨긴다 */
  reward: string | null
}

/** 전투 중 장면 아래쪽 알림 띠(어느 스테이지인지, 건너뛰기·돌아가기 버튼)와 끝난 뒤 결과 카드 */
export function createBattleBar(scene: HTMLElement, h: { onSkip(): void; onLeave(): void }) {
  const card = document.createElement('div')
  card.className = 'battle-result'
  card.dataset.testid = 'battle-result'
  card.hidden = true
  card.innerHTML = `
    <b data-testid="battle-result-title"></b>
    <span data-testid="battle-result-detail"></span>
    <span class="battle-result-note" data-testid="battle-result-note"></span>
    <span class="battle-result-reward" data-testid="battle-result-reward"></span>`

  const bar = document.createElement('div')
  bar.className = 'battle-bar'
  bar.dataset.testid = 'battle'
  bar.hidden = true
  bar.setAttribute('role', 'status')
  bar.innerHTML = `
    <span class="battle-text">
      <b data-testid="battle-title"></b>
      <span data-testid="battle-status"></span>
    </span>
    <button type="button" class="battle-action" data-testid="battle-action"></button>`
  scene.append(card, bar)

  const q = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const title = q(bar, 'battle-title')
  const status = q(bar, 'battle-status')
  const action = q(bar, 'battle-action')
  action.addEventListener('click', () => (bar.dataset.state === 'playing' ? h.onSkip() : h.onLeave()))

  return {
    start(name: string, foe: string) {
      title.textContent = `⚔️ ${name}`
      status.textContent = `말랑이 vs ${foe}`
      action.textContent = '건너뛰기'
      bar.dataset.state = 'playing'
      delete bar.dataset.win
      bar.classList.remove('won')
      bar.hidden = false
      card.hidden = true
      scene.classList.add('in-battle')
    },
    end(r: BattleResultView) {
      const { win } = r
      q(card, 'battle-result-title').textContent = win ? '🎉 승리!' : '💧 아쉬워요'
      q(card, 'battle-result-detail').textContent = win ? `${r.rounds}번 주고받아 이겼어요` : '말랑이가 지쳐 버렸어요'
      q(card, 'battle-result-note').textContent = r.note
      const reward = q(card, 'battle-result-reward')
      reward.textContent = r.reward ?? ''
      reward.hidden = r.reward === null
      card.dataset.win = String(win)
      card.hidden = false
      status.textContent = win ? '이겼어요! 🎉' : '아쉽게 졌어요'
      action.textContent = '돌아가기'
      bar.dataset.state = 'done'
      bar.dataset.win = String(win)
      bar.classList.toggle('won', win)
    },
    hide() {
      bar.hidden = true
      card.hidden = true
      bar.dataset.state = ''
      scene.classList.remove('in-battle')
    },
  }
}
