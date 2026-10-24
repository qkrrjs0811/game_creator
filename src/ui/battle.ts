/** 전투 중 장면 위쪽 알림 띠: 어느 스테이지인지, 건너뛰기·돌아가기 버튼 */
export function createBattleBar(scene: HTMLElement, h: { onSkip(): void; onLeave(): void }) {
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
  scene.append(bar)

  const q = (id: string) => bar.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const title = q('battle-title')
  const status = q('battle-status')
  const action = q('battle-action')
  action.addEventListener('click', () => (bar.dataset.state === 'playing' ? h.onSkip() : h.onLeave()))

  return {
    start(name: string) {
      title.textContent = `⚔️ ${name}`
      status.textContent = '말랑이가 싸우는 중…'
      action.textContent = '건너뛰기'
      bar.dataset.state = 'playing'
      delete bar.dataset.win
      bar.hidden = false
      scene.classList.add('in-battle')
    },
    end(win: boolean) {
      status.textContent = win ? '이겼어요! 🎉' : '아쉽게 졌어요. 더 키워서 다시 와요'
      action.textContent = '돌아가기'
      bar.dataset.state = 'done'
      bar.dataset.win = String(win)
      bar.classList.toggle('won', win)
    },
    hide() {
      bar.hidden = true
      bar.dataset.state = ''
      scene.classList.remove('in-battle')
    },
  }
}
