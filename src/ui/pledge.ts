import { ACTIVITIES } from '../core/activities'
import { topicJosa } from './format'
import { PLEDGE_MINUTES, type Pledge } from '../core/pledge'
import type { ActivityId } from '../core/types'

export interface PledgeView {
  /** 오늘 이미 정한 다짐. 없으면 null */
  pledge: Pledge | null
  /** 다짐이 없을 때 먼저 골라 둘 활동(지금 고른 탭) */
  selected: ActivityId
  /** 그 활동으로 고를 수 있는 분(상한 안이고 오늘 이미 한 분보다 긴 것) */
  options(activity: ActivityId): number[]
}

const IDS = Object.keys(ACTIVITIES) as ActivityId[]

/**
 * 오늘의 다짐 고르기 창: 활동 하나와 시간(10·20·30·60분)을 골라 다짐한다.
 * 고르기만 하고 채움은 타이머 기록으로만 센다(보상 없음)
 */
export function createPledge(root: HTMLElement, h: { view(): PledgeView; onPledge(activity: ActivityId, minutes: number): void }) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'pledge-sheet'
  wrap.innerHTML = `
    <div class="sheet pledge" role="dialog" aria-modal="true" aria-labelledby="pledge-title">
      <h2 id="pledge-title">✍️ 오늘의 다짐</h2>
      <p class="sheet-desc">오늘 할 활동과 시간을 골라요. 타이머로 채우면 지킨 거예요.</p>
      <p class="pledge-label">무엇을</p>
      <div class="pledge-row" role="group" aria-label="활동">
        ${IDS.map((id) => `<button type="button" class="pledge-pick" data-testid="pledge-activity-${id}" data-activity="${id}">${ACTIVITIES[id].label}</button>`).join('')}
      </div>
      <p class="pledge-label">얼마나</p>
      <div class="pledge-row" role="group" aria-label="시간">
        ${PLEDGE_MINUTES.map((m) => `<button type="button" class="pledge-pick" data-testid="pledge-minutes-${m}" data-minutes="${m}">${m}분</button>`).join('')}
      </div>
      <p class="sheet-desc pledge-hint" data-testid="pledge-hint"></p>
      <button type="button" class="sheet-btn main" data-testid="pledge-save">다짐하기</button>
      <button type="button" class="sheet-close" data-testid="pledge-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLButtonElement>(`[data-testid=${id}]`)!
  const activityBtns = [...wrap.querySelectorAll<HTMLButtonElement>('[data-activity]')]
  const minuteBtns = [...wrap.querySelectorAll<HTMLButtonElement>('[data-minutes]')]
  const hint = q('pledge-hint')
  const saveBtn = q('pledge-save')
  let activity: ActivityId = 'exercise'
  let minutes = 0
  let view: PledgeView | null = null

  const draw = () => {
    const opts = view!.options(activity)
    // 고른 분을 이 활동으로 못 고르면 고를 수 있는 가장 짧은 분으로 옮긴다
    if (!opts.includes(minutes)) minutes = opts[0] ?? 0
    for (const b of activityBtns) {
      const on = b.dataset.activity === activity
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', String(on))
    }
    for (const b of minuteBtns) {
      const m = Number(b.dataset.minutes)
      const on = m === minutes
      b.disabled = !opts.includes(m)
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', String(on))
    }
    const name = ACTIVITIES[activity].label
    hint.textContent = opts.length === 0 ? `오늘 ${name}${topicJosa(name)} 이미 다 채웠어요. 다른 활동을 골라요` : `오늘은 ${name} ${minutes}분!`
    saveBtn.disabled = minutes === 0
  }

  for (const b of activityBtns)
    b.addEventListener('click', () => {
      activity = b.dataset.activity as ActivityId
      draw()
    })
  for (const b of minuteBtns)
    b.addEventListener('click', () => {
      minutes = Number(b.dataset.minutes)
      draw()
    })
  const close = () => (wrap.hidden = true)
  q('pledge-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close()
  })
  saveBtn.addEventListener('click', () => {
    if (minutes === 0) return
    h.onPledge(activity, minutes)
    close()
  })

  return {
    open() {
      view = h.view()
      activity = view.pledge?.activity ?? view.selected
      minutes = view.pledge?.minutes ?? 0
      draw()
      wrap.hidden = false
    },
  }
}
