import { dexPage, type DexEntry, type MonsterLook } from '../core/dex'
import { chapterName } from '../core/endless'
import type { MonsterShape } from '../core/monsters'
import { dexShadowText } from './format'

const INK = '#3d2a63'
const CROWN = '#ffd36b'
const CHEEK = '#ff8fa8'
/** 그림자 칸은 모양만 보이게 한 가지 색으로 칠한다 */
const SHADOW = { color: '#e6d8ca', shade: '#d8c7b6' }

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

/** 모서리마다 둥근 정도가 다른 네모(Phaser fillRoundedRect 와 같은 모양) */
function rrect(x: number, y: number, w: number, h: number, r: { tl: number; tr: number; bl: number; br: number } | number, fill: string) {
  const { tl, tr, bl, br } = typeof r === 'number' ? { tl: r, tr: r, bl: r, br: r } : r
  const d = `M${x + tl},${y}H${x + w - tr}Q${x + w},${y} ${x + w},${y + tr}V${y + h - br}Q${x + w},${y + h} ${x + w - br},${y + h}H${x + bl}Q${x},${y + h} ${x},${y + h - bl}V${y + tl}Q${x},${y} ${x + tl},${y}Z`
  return `<path d="${d}" fill="${fill}"/>`
}
const circle = (x: number, y: number, r: number, fill: string, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra}/>`
const ellipse = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${extra}/>`
const tri = (pts: number[], fill: string) => `<polygon points="${pts.join(',')}" fill="${fill}"/>`

/** 장면(HomeScene.monsterParts)과 같은 몬스터 모양을 SVG 로 그린다. 그림자면 얼굴 없이 모양만 */
function monsterSvg(shape: MonsterShape, color: string, shade: string, shadow: boolean): string {
  const face = (eyeY: number, gap: number, cheekY: number, cheekGap: number) =>
    shadow
      ? ''
      : circle(-gap, eyeY, 4, INK) + circle(gap, eyeY, 4, INK) + [-cheekGap, cheekGap].map((x) => ellipse(x, cheekY, 9, 5, CHEEK, ' opacity="0.55"')).join('')
  const sprout = shadow ? SHADOW.shade : '#7cc576'
  const white = shadow ? SHADOW.shade : '#ffffff'
  const crown = shadow ? SHADOW.shade : CROWN
  let body = ''
  switch (shape) {
    case 'slime':
      body = rrect(-34, -28, 68, 54, { tl: 32, tr: 32, bl: 16, br: 16 }, color) + rrect(-34, 16, 68, 10, { tl: 0, tr: 0, bl: 16, br: 16 }, shade)
      body += ellipse(-7, -32, 14, 8, sprout) + ellipse(7, -34, 14, 8, sprout) + face(-6, 11, 6, 20)
      break
    case 'mushroom':
      body = rrect(-20, -6, 40, 32, 14, shadow ? SHADOW.shade : '#fff1dc')
      body += rrect(-38, -36, 76, 36, { tl: 36, tr: 36, bl: 12, br: 12 }, color) + rrect(-38, -8, 76, 8, { tl: 0, tr: 0, bl: 12, br: 12 }, shade)
      body += shadow ? '' : circle(-18, -22, 6, white) + circle(8, -28, 5, white) + circle(22, -16, 4, white)
      body += face(10, 8, 18, 14)
      break
    case 'drop':
      body = tri([-20, -8, 20, -8, 0, -42], color) + circle(0, 2, 26, color) + ellipse(0, 22, 40, 8, shade)
      body += shadow ? '' : ellipse(-12, -10, 7, 12, white, ' opacity="0.8"')
      body += face(2, 9, 12, 17)
      break
    case 'cloud':
      body = circle(-20, -2, 17, color) + circle(2, -14, 22, color) + circle(22, -2, 16, color) + rrect(-38, -4, 76, 30, 15, color)
      body += rrect(-34, 18, 68, 8, 4, shade) + face(4, 11, 14, 22)
      break
    case 'rock':
      body = rrect(-36, -22, 72, 48, { tl: 24, tr: 16, bl: 14, br: 14 }, color) + rrect(-36, 16, 72, 10, { tl: 0, tr: 0, bl: 14, br: 14 }, shade)
      body += circle(18, -10, 5, shade) + circle(-20, 4, 3, shade)
      // 졸린 듯 가는 눈
      body += shadow ? '' : ellipse(-11, -2, 10, 4, INK) + ellipse(11, -2, 10, 4, INK) + [-20, 20].map((x) => ellipse(x, 8, 9, 5, CHEEK, ' opacity="0.55"')).join('')
      break
    case 'king':
      body = rrect(-42, -30, 84, 56, { tl: 38, tr: 38, bl: 18, br: 18 }, color) + rrect(-42, 15, 84, 11, { tl: 0, tr: 0, bl: 18, br: 18 }, shade)
      body += rrect(-18, -36, 36, 10, 3, crown) + tri([-18, -34, -10, -34, -16, -46], crown) + tri([-6, -34, 6, -34, 0, -50], crown) + tri([10, -34, 18, -34, 16, -46], crown)
      body += shadow ? '' : circle(0, -31, 3, CHEEK)
      body += face(-6, 13, 8, 25)
      break
  }
  return `<svg class="dex-pic" viewBox="-46 -54 92 84" aria-hidden="true">${body}</svg>`
}

const pic = (m: MonsterLook) => monsterSvg(m.shape, hex(m.color), hex(m.shade), false)

function entryCell(e: DexEntry): string {
  return `
    <li class="dex-cell${e.boss ? ' boss' : ''}" data-testid="dex-entry" data-key="${e.key}">
      ${pic(e.monster)}
      <b>${e.boss ? '👑 ' : ''}${e.monster.name}</b>
      <span>${e.firstStage}스테이지에서 만남</span>
    </li>`
}

function shadowCell(e: DexEntry & { toWin: number | null }): string {
  return `
    <li class="dex-cell shadow" data-testid="dex-shadow">
      <span class="dex-pic-wrap">${monsterSvg(e.monster.shape, SHADOW.color, SHADOW.shade, true)}<i aria-hidden="true">❔</i></span>
      <b>${e.firstStage}스테이지</b>
      <span>${dexShadowText(e.toWin)}</span>
    </li>`
}

/** 몬스터 도감 창: 모은 몬스터를 장별로 둥근 칸 격자로, 지금 장 끝에는 다음에 만날 그림자 칸 */
export function createDex(
  root: HTMLElement,
  h: {
    progress(): number
    count(): number
    /** 다음에 만날 새 몬스터와 운동 몇 분 더 하면 이길 만한지(dexShadows) */
    shadows(): (DexEntry & { toWin: number | null })[]
  },
) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'dex'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dex-title">
      <h2 id="dex-title">몬스터 도감</h2>
      <p class="dex-count" data-testid="dex-count"></p>
      <div class="chapter-nav">
        <button type="button" class="chapter-step" data-testid="dex-prev" aria-label="앞 장">◀</button>
        <p class="stage-chapter" data-testid="dex-chapter"></p>
        <button type="button" class="chapter-step" data-testid="dex-next" aria-label="다음 장">▶</button>
      </div>
      <ul class="dex-grid" data-testid="dex-grid"></ul>
      <p class="dex-empty" data-testid="dex-empty" hidden></p>
      <button type="button" class="sheet-close" data-testid="dex-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = (id: string) => wrap.querySelector<HTMLElement>(`[data-testid=${id}]`)!
  const grid = q('dex-grid')
  const empty = q('dex-empty')
  const prev = q('dex-prev') as HTMLButtonElement
  const next = q('dex-next') as HTMLButtonElement
  /** 보고 있는 장. 열 때마다 지금 장으로 돌아온다 */
  let viewing: number | undefined
  /** 그림자 칸 값은 전투 계산이 들어가 무거워서 열 때 한 번만 구한다 */
  let shadows: (DexEntry & { toWin: number | null })[] = []

  const draw = () => {
    const page = dexPage(h.progress(), viewing)
    viewing = page.chapter
    prev.disabled = !page.prev
    next.disabled = !page.next
    q('dex-count').textContent = `📚 모은 몬스터 ${h.count()}`
    q('dex-chapter').textContent = `${page.chapter}장 · ${chapterName(page.chapter)}`
    // 다음에 만날 몬스터는 지금 장 쪽 끝에만 그림자로 보여 준다
    const tail = page.chapter === page.current ? shadows : []
    grid.innerHTML = page.entries.map(entryCell).join('') + tail.map(shadowCell).join('')
    empty.hidden = page.entries.length > 0
    empty.textContent =
      page.chapter === page.current ? '이 장에서는 아직 만난 몬스터가 없어요 · 스테이지를 깨면 여기에 모여요' : '이 장에서 처음 만난 몬스터는 없어요'
    grid.scrollTop = 0
  }

  const turn = (step: number) => {
    viewing = (viewing ?? dexPage(h.progress()).chapter) + step
    draw()
  }
  prev.addEventListener('click', () => turn(-1))
  next.addEventListener('click', () => turn(1))
  const close = () => (wrap.hidden = true)
  q('dex-close').addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      viewing = undefined
      shadows = h.shadows()
      draw()
      wrap.hidden = false
    },
    close,
  }
}
