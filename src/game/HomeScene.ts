import Phaser from 'phaser'
import type { ReplayStep, Timeline } from '../core/replay'
import { MONSTERS, type Monster } from '../core/monsters'
import type { Worn } from '../core/cosmetics'

const MASCOT = 0xffd7a8
const MASCOT_SHADE = 0xf7b97a
const INK = 0x5a4636
const MONSTER_INK = 0x3d2a63
const CROWN = 0xffd36b
const HP_PLAYER = 0x7fd8b0
const HP_ENEMY = 0xff9fbf
const BAR_W = 78
const FONT = 'Segoe UI, Malgun Gothic, sans-serif'
/** 색 꾸미기의 [몸, 아래 그늘] 색 */
const BODY_COLORS: Record<string, [number, number]> = {
  'color-sky': [0xb5dcff, 0x8fc2f0],
  'color-cotton': [0xffc6de, 0xf5a3c6],
}
const CONFETTI =[0xff8a5b, 0xffd36b, 0x9be3c4, 0xa8d4ff, 0xffa8c8, 0xc9a7ff]

/** 홈 장면: 둥근 마스코트와 몬스터가 마주 보고, 마스코트가 숨 쉬듯 움직인다 */
export class HomeScene extends Phaser.Scene {
  private mascot!: Phaser.GameObjects.Container
  private monster!: Phaser.GameObjects.Container
  private bubble!: Phaser.GameObjects.Container
  private jump?: Phaser.Tweens.Tween
  /** 홈에서 보여 줄 몬스터(다음에 도전할 스테이지)와 지금 그려진 몬스터 */
  private homeLook?: Monster
  private shownMonster = ''
  /** 입은 꾸미기와 지금 그려진 모습 */
  private look: Worn = { hat: null, color: null }
  private shownLook?: string
  private battle?: {
    steps: ReplayStep[]
    win: boolean
    next: number
    timer?: Phaser.Time.TimerEvent
    bars: Phaser.GameObjects.Graphics
    /** 지금 보이는 HP 비율 [말랑이, 몬스터] */
    hp: [number, number]
    onEnd: (win: boolean) => void
    ended: boolean
  }

  constructor() {
    super('home')
  }

  create() {
    this.mascot = this.add.container(0, 0)
    this.shownLook = undefined
    this.dress(this.look)

    this.monster = this.add.container(0, 0)
    this.setMonster(this.homeLook ?? MONSTERS[0])

    const text = this.add
      .text(0, 0, '💪 오늘도 같이 크는 중!', { fontFamily: 'Segoe UI, Malgun Gothic, sans-serif', fontSize: '14px', color: '#5a4636', fontStyle: 'bold' })
      .setOrigin(0.5)
    const bg = this.add.graphics()
    bg.fillStyle(0xffffff).fillRoundedRect(-text.width / 2 - 12, -15, text.width + 24, 30, 15)
    this.bubble = this.add.container(0, 0, [bg, text])

    this.layout(this.scale.width, this.scale.height)
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.layout(size.width, size.height))

    this.idle()
  }

  /** 레벨업: 마스코트가 폴짝 뛰고 파스텔 색종이가 터진다. 말풍선은 축하 배지에 자리를 비켜 준다 */
  celebrate() {
    // 전투 중에는 자리를 흔들지 않는다(축하 배지는 화면에 그대로 뜬다)
    if (this.battle) return
    // 뛰는 중에 또 오르면 땅으로 돌려놓고 다시 뛴다
    this.jump?.stop()
    this.layout(this.scale.width, this.scale.height)
    const { x, y } = this.mascot
    this.jump = this.tweens.add({ targets: this.mascot, y: y - 46, duration: 260, yoyo: true, repeat: 1, ease: 'Quad.easeOut' })

    this.tweens.killTweensOf(this.bubble)
    this.bubble.setAlpha(0)
    this.tweens.add({ targets: this.bubble, alpha: 1, delay: 3300, duration: 300 })

    for (let i = 0; i < 26; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05)
      const dist = Phaser.Math.Between(70, 150)
      const bit =
        i % 3 === 0
          ? this.add.star(x, y - 20, 5, 4, 9, Phaser.Utils.Array.GetRandom(CONFETTI))
          : this.add.circle(x, y - 20, Phaser.Math.Between(4, 7), Phaser.Utils.Array.GetRandom(CONFETTI))
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * dist,
        y: y - 20 + Math.sin(angle) * dist,
        angle: Phaser.Math.Between(-180, 180),
        duration: 650,
        ease: 'Cubic.easeOut',
        onComplete: () =>
          this.tweens.add({ targets: bit, y: '+=60', alpha: 0, duration: 900, ease: 'Sine.easeIn', onComplete: () => bit.destroy() }),
      })
    }
  }

  /** 전투 기록을 한 걸음씩 재생한다. 끝나면 onEnd(이겼는지)를 부른다 */
  playBattle(timeline: Timeline, delay: number, foe: Monster, onEnd: (win: boolean) => void) {
    this.endBattle()
    this.setMonster(foe)
    this.jump?.stop()
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who)
    this.tweens.killTweensOf(this.bubble)
    this.bubble.setAlpha(0)
    this.battle = { steps: timeline.steps, win: timeline.win, next: 0, bars: this.add.graphics(), hp: [1, 1], onEnd, ended: false }
    this.layout(this.scale.width, this.scale.height)
    this.battle.timer = this.time.addEvent({ delay, loop: true, startAt: delay * 0.4, callback: () => this.playStep() })
  }

  /** 남은 걸음을 건너뛰고 결과로 간다 */
  skipBattle() {
    const b = this.battle
    if (!b || b.ended) return
    const last = b.steps[b.steps.length - 1]
    if (last) this.drawBars(last.playerHp, last.enemyHp)
    b.next = b.steps.length
    this.finish()
  }

  /** 전투를 정리하고 홈 장면으로 돌아간다 */
  endBattle() {
    const b = this.battle
    if (!b) return
    b.timer?.remove()
    b.bars.destroy()
    this.battle = undefined
    for (const who of [this.mascot, this.monster]) {
      this.tweens.killTweensOf(who)
      who.setAlpha(1).setScale(1).setAngle(0)
    }
    if (this.homeLook) this.setMonster(this.homeLook)
    this.layout(this.scale.width, this.scale.height)
    this.idle()
    this.tweens.add({ targets: this.bubble, alpha: 1, duration: 300 })
  }

  /** 말랑이에게 입은 꾸미기(모자·색)를 입힌다. 모습만 바뀐다 */
  dress(worn: Worn) {
    this.look = worn
    if (!this.mascot) return
    const key = [worn.hat?.id, worn.color?.id].filter(Boolean).join(' ')
    if (this.shownLook === key) return
    this.shownLook = key
    this.mascot.removeAll(true)
    this.mascot.add(this.mascotParts(worn))
    // e2e가 지금 입은 꾸미기를 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-look', key)
  }

  /** 둥근 말랑이. 색 꾸미기는 몸 색을, 모자 꾸미기는 머리 위(y≈-38)를 꾸민다 */
  private mascotParts(worn: Worn): Phaser.GameObjects.GameObject[] {
    const [body, shade] = BODY_COLORS[worn.color?.id ?? ''] ?? [MASCOT, MASCOT_SHADE]
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.circle(0, 0, 38, body),
      this.add.ellipse(0, 22, 60, 20, shade).setAlpha(0.6),
      this.add.ellipse(-12, -6, 8, 11, INK),
      this.add.ellipse(12, -6, 8, 11, INK),
      this.add.ellipse(-22, 8, 10, 6, 0xffa8a8).setAlpha(0.7),
      this.add.ellipse(22, 8, 10, 6, 0xffa8a8).setAlpha(0.7),
    ]
    const g = this.add.graphics()
    switch (worn.hat?.id) {
      case 'hat-sprout':
        g.fillStyle(0x7cc576).fillRoundedRect(-2, -50, 4, 14, 2)
        g.fillEllipse(-9, -50, 16, 9).fillEllipse(9, -53, 16, 9)
        break
      case 'hat-mushroom':
        g.fillStyle(0xff9f9f).fillRoundedRect(-30, -58, 60, 30, { tl: 30, tr: 30, bl: 8, br: 8 })
        g.fillStyle(0xf28888).fillRoundedRect(-30, -34, 60, 6, { tl: 0, tr: 0, bl: 8, br: 8 })
        g.fillStyle(0xffffff).fillCircle(-14, -46, 5).fillCircle(6, -52, 4).fillCircle(17, -41, 4)
        break
      case 'hat-ribbon':
        g.fillStyle(0xffa8c8).fillTriangle(14, -34, 34, -48, 34, -24).fillTriangle(14, -34, -6, -48, -6, -24)
        g.fillStyle(0xff8fb4).fillCircle(14, -36, 6)
        break
      case 'hat-crown':
        g.fillStyle(CROWN).fillRoundedRect(-16, -44, 32, 9, 3)
        g.fillTriangle(-16, -42, -8, -42, -14, -54).fillTriangle(-5, -42, 5, -42, 0, -58).fillTriangle(8, -42, 16, -42, 14, -54)
        g.fillStyle(0xff8fa8).fillCircle(0, -39, 3)
        break
    }
    return [...parts, g]
  }

  /** 홈에서 기다리는 몬스터를 정한다. 전투 중이면 끝난 뒤에 바뀐다 */
  showHomeMonster(m: Monster) {
    this.homeLook = m
    if (!this.battle && this.monster) this.setMonster(m)
  }

  private setMonster(m: Monster) {
    if (this.shownMonster === m.id) return
    this.shownMonster = m.id
    this.monster.removeAll(true)
    this.monster.add(this.monsterParts(m))
    // e2e가 지금 어떤 몬스터가 나와 있는지 볼 수 있게 남긴다
    this.game.canvas.parentElement?.setAttribute('data-monster', m.id)
  }

  /** 몬스터 모양. 모두 아래쪽(y≈26)이 땅에 닿는 둥근 도형이다 */
  private monsterParts(m: Monster): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics()
    const eyes = (y: number, gap = 11) => [this.add.circle(-gap, y, 4, MONSTER_INK), this.add.circle(gap, y, 4, MONSTER_INK)]
    const cheeks = (y: number, gap = 20) =>
      [-gap, gap].map((x) => this.add.ellipse(x, y, 9, 5, 0xff8fa8).setAlpha(0.55))
    switch (m.shape) {
      case 'slime':
        g.fillStyle(m.color).fillRoundedRect(-34, -28, 68, 54, { tl: 32, tr: 32, bl: 16, br: 16 })
        g.fillStyle(m.shade).fillRoundedRect(-34, 16, 68, 10, { tl: 0, tr: 0, bl: 16, br: 16 })
        // 머리 위 새싹 두 장
        g.fillStyle(0x7cc576).fillEllipse(-7, -32, 14, 8).fillEllipse(7, -34, 14, 8)
        return [g, ...eyes(-6), ...cheeks(6)]
      case 'mushroom':
        g.fillStyle(0xfff1dc).fillRoundedRect(-20, -6, 40, 32, 14)
        g.fillStyle(m.color).fillRoundedRect(-38, -36, 76, 36, { tl: 36, tr: 36, bl: 12, br: 12 })
        g.fillStyle(m.shade).fillRoundedRect(-38, -8, 76, 8, { tl: 0, tr: 0, bl: 12, br: 12 })
        g.fillStyle(0xffffff).fillCircle(-18, -22, 6).fillCircle(8, -28, 5).fillCircle(22, -16, 4)
        return [g, ...eyes(10, 8), ...cheeks(18, 14)]
      case 'drop':
        g.fillStyle(m.color).fillTriangle(-20, -8, 20, -8, 0, -42).fillCircle(0, 2, 26)
        g.fillStyle(m.shade).fillEllipse(0, 22, 40, 8)
        g.fillStyle(0xffffff, 0.8).fillEllipse(-12, -10, 7, 12)
        return [g, ...eyes(2, 9), ...cheeks(12, 17)]
      case 'cloud':
        g.fillStyle(m.color).fillCircle(-20, -2, 17).fillCircle(2, -14, 22).fillCircle(22, -2, 16)
        g.fillRoundedRect(-38, -4, 76, 30, 15)
        g.fillStyle(m.shade).fillRoundedRect(-34, 18, 68, 8, 4)
        return [g, ...eyes(4), ...cheeks(14, 22)]
      case 'rock':
        g.fillStyle(m.color).fillRoundedRect(-36, -22, 72, 48, { tl: 24, tr: 16, bl: 14, br: 14 })
        g.fillStyle(m.shade).fillRoundedRect(-36, 16, 72, 10, { tl: 0, tr: 0, bl: 14, br: 14 })
        g.fillCircle(18, -10, 5).fillCircle(-20, 4, 3)
        // 졸린 듯 가는 눈
        return [g, this.add.ellipse(-11, -2, 10, 4, MONSTER_INK), this.add.ellipse(11, -2, 10, 4, MONSTER_INK), ...cheeks(8)]
      case 'king':
        g.fillStyle(m.color).fillRoundedRect(-42, -30, 84, 56, { tl: 38, tr: 38, bl: 18, br: 18 })
        g.fillStyle(m.shade).fillRoundedRect(-42, 15, 84, 11, { tl: 0, tr: 0, bl: 18, br: 18 })
        // 왕관
        g.fillStyle(CROWN).fillRoundedRect(-18, -36, 36, 10, 3)
        g.fillTriangle(-18, -34, -10, -34, -16, -46).fillTriangle(-6, -34, 6, -34, 0, -50).fillTriangle(10, -34, 18, -34, 16, -46)
        g.fillStyle(0xff8fa8).fillCircle(0, -31, 3)
        return [g, ...eyes(-6, 13), ...cheeks(8, 25)]
    }
  }

  private idle() {
    this.tweens.add({ targets: this.mascot, scaleY: 0.94, scaleX: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: this.monster, y: '-=6', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  private playStep() {
    const b = this.battle
    if (!b || b.ended) return
    const s = b.steps[b.next++]
    if (!s) return this.finish()
    const attacker = s.actor === 'player' ? this.mascot : this.monster
    const target = s.actor === 'player' ? this.monster : this.mascot
    const dir = s.actor === 'player' ? 1 : -1
    this.layout(this.scale.width, this.scale.height)
    this.tweens.add({ targets: attacker, x: attacker.x + 34 * dir, duration: 120, yoyo: true, ease: 'Quad.easeOut' })
    this.time.delayedCall(120, () => {
      if (this.battle !== b || b.ended) return
      if (s.kind === 'miss') {
        this.tweens.add({ targets: target, x: target.x + 22 * dir, duration: 110, yoyo: true, ease: 'Sine.easeOut' })
        this.floatText(target.x, target.y - 58, '휙! 피했다', '#6f93c4')
      } else {
        this.tweens.add({ targets: target, alpha: 0.35, duration: 70, yoyo: true, repeat: 1 })
        this.tweens.add({ targets: target, angle: 8 * dir, duration: 80, yoyo: true, ease: 'Sine.easeOut' })
        this.floatText(target.x, target.y - 58, `-${s.damage}`, s.actor === 'player' ? '#ff8a5b' : '#e0607e')
      }
      this.drawBars(s.playerHp, s.enemyHp)
    })
    if (b.next >= b.steps.length) {
      b.timer?.remove()
      this.time.delayedCall(700, () => this.battle === b && this.finish())
    }
  }

  private finish() {
    const b = this.battle
    if (!b || b.ended) return
    b.ended = true
    b.timer?.remove()
    for (const who of [this.mascot, this.monster]) this.tweens.killTweensOf(who)
    this.layout(this.scale.width, this.scale.height)
    const winner = b.win ? this.mascot : this.monster
    const loser = b.win ? this.monster : this.mascot
    this.tweens.add({ targets: loser, scaleY: 0.6, scaleX: 1.2, alpha: 0.55, duration: 380, ease: 'Back.easeIn' })
    this.tweens.add({ targets: winner, y: winner.y - 36, duration: 240, yoyo: true, repeat: 2, ease: 'Quad.easeOut' })
    b.onEnd(b.win)
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '20px', color, fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 })
      .setOrigin(0.5)
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() })
  }

  /** 두 캐릭터 머리 위의 둥근 HP 바 */
  private drawBars(playerHp: number, enemyHp: number) {
    const b = this.battle
    if (!b) return
    const g = b.bars.clear()
    const bar = (cx: number, cy: number, ratio: number, color: number) => {
      g.fillStyle(0xffffff).fillRoundedRect(cx - BAR_W / 2 - 3, cy - 3, BAR_W + 6, 16, 8)
      g.fillStyle(0xf3e3d3).fillRoundedRect(cx - BAR_W / 2, cy, BAR_W, 10, 5)
      if (ratio > 0) g.fillStyle(color).fillRoundedRect(cx - BAR_W / 2, cy, Math.max(10, BAR_W * ratio), 10, 5)
    }
    const { width: w, height: h } = this.scale
    bar(w * 0.3, h * 0.68 - 72, playerHp, HP_PLAYER)
    bar(w * 0.72, h * 0.68 - 72, enemyHp, HP_ENEMY)
    b.hp = [playerHp, enemyHp]
  }

  private layout(w: number, h: number) {
    const ground = h * 0.68
    this.mascot.setPosition(w * 0.3, ground)
    this.monster.setPosition(w * 0.72, ground + 6)
    this.bubble.setPosition(w / 2, Math.max(28, h * 0.16))
    if (this.battle) this.drawBars(...this.battle.hp)
  }
}
