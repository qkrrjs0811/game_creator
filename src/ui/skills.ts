import { SKILLS, type SkillId } from '../core/skills'
import type { StatRow } from '../core/stats'

export interface SkillsView {
  points: number
  ranks: Record<SkillId, number>
  stats: StatRow[]
}

/** 나 창: 운동으로 오른 능력치, 남은 포인트와 스킬 3종, 골라서 배우기 */
export function createSkills(root: HTMLElement, h: { view(): SkillsView; onLearn(id: SkillId): void }) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'skills'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="skills-title">
      <h2 id="skills-title">나의 말랑이</h2>
      <ul class="stat-list" data-testid="stats"></ul>
      <h3 class="sheet-sub">스킬</h3>
      <p class="skill-points" data-testid="skill-points"></p>
      <ul class="skill-list">
        ${SKILLS.map(
          (s) => `
          <li class="skill" data-testid="skill-${s.id}">
            <span class="skill-icon" aria-hidden="true">${s.icon}</span>
            <span class="skill-text">
              <b>${s.name} <small data-testid="skill-rank-${s.id}"></small></b>
              <span>${s.desc}</span>
            </span>
            <button type="button" class="skill-learn" data-testid="learn-${s.id}">배우기</button>
          </li>`,
        ).join('')}
      </ul>
      <p class="sheet-desc" data-testid="skill-hint"></p>
      <button type="button" class="sheet-close" data-testid="skills-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!

  const draw = () => {
    const v = h.view()
    q('stats').innerHTML = v.stats
      .map(
        (s) => `
        <li class="stat${s.source ? '' : ' soon'}" data-testid="stat-${s.id}">
          <span class="stat-name"><span aria-hidden="true">${s.icon}</span> ${s.name}</span>
          <b data-testid="stat-value-${s.id}">${s.value}</b>
          <small data-testid="stat-next-${s.id}">${s.toNext === null ? '준비 중' : `${s.source} ${s.toNext}분 더`}</small>
        </li>`,
      )
      .join('')
    q('skill-points').innerHTML = `남은 포인트 <b>${v.points}</b>`
    q('skill-hint').textContent =
      v.points > 0 ? '하나를 골라 배워요. 같은 스킬을 또 배우면 더 강해져요.' : '운동해서 레벨을 올리면 포인트를 받아요.'
    for (const s of SKILLS) {
      const rank = v.ranks[s.id]
      q(`skill-rank-${s.id}`).textContent = rank > 0 ? `Lv.${rank}` : ''
      q(`skill-${s.id}`).classList.toggle('known', rank > 0)
      ;(q(`learn-${s.id}`) as HTMLButtonElement).disabled = v.points < 1
    }
  }

  for (const s of SKILLS) {
    q(`learn-${s.id}`).addEventListener('click', () => {
      h.onLearn(s.id)
      draw()
    })
  }
  const close = () => (wrap.hidden = true)
  q('skills-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      draw()
      wrap.hidden = false
    },
    /** 열려 있는 동안 레벨이 오르면 포인트를 다시 그린다 */
    refresh() {
      if (!wrap.hidden) draw()
    },
  }
}
