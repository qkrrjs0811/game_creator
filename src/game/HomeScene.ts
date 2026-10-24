import Phaser from 'phaser'
import type { ReplayStep, Timeline } from '../core/replay'

const MASCOT = 0xffd7a8
const MASCOT_SHADE = 0xf7b97a
const MONSTER = 0xc9a7ff
const MONSTER_SHADE = 0xa985ea
const INK = 0x5a4636
const HP_PLAYER = 0x7fd8b0
const HP_ENEMY = 0xff9fbf
const BAR_W = 78
const FONT = 'Segoe UI, Malgun Gothic, sans-serif'
const CONFETTI = [0xff8a5b, 0xffd36b, 0x9be3c4, 0xa8d4ff, 0xffa8c8, 0xc9a7ff]

/** 홈 장면: 둥근 마스코트와 몬스터가 마주 보고, 마스코트가 숨 쉬듯 움직인다 */
export class HomeScene extends Phaser.Scene {
  private mascot!: Phaser.GameObjects.Container
  private monster!: Phaser.GameObjects.Container
  private bubble!: Phaser.GameObjects.Container
  private jump?: Phaser.Tweens.Tween
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
    this.mascot = this.add.container(0, 0, [
      this.add.circle(0, 0, 38, MASCOT),
      this.add.ellipse(0, 22, 60, 20, MASCOT_SHADE).setAlpha(0.6),
      this.add.ellipse(-12, -6, 8, 11, INK),
      this.add.ellipse(12, -6, 8, 11, INK),
      this.add.ellipse(-22, 8, 10, 6, 0xffa8a8).setAlpha(0.7),
      this.add.ellipse(22, 8, 10, 6, 0xffa8a8).setAlpha(0.7),
    ])

    const body = this.add.graphics()
    body.fillStyle(MONSTER).fillRoundedRect(-34, -28, 68, 54, { tl: 32, tr: 32, bl: 16, br: 16 })
    body.fillStyle(MONSTER_SHADE).fillRoundedRect(-34, 16, 68, 10, { tl: 0, tr: 0, bl: 16, br: 16 })
    this.monster = this.add.container(0, 0, [
      body,
      this.add.circle(-11, -6, 4, 0x3d2a63),
      this.add.circle(11, -6, 4, 0x3d2a63),
    ])

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
  playBattle(timeline: Timeline, delay: number, onEnd: (win: boolean) => void) {
    this.endBattle()
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
    this.layout(this.scale.width, this.scale.height)
    this.idle()
    this.tweens.add({ targets: this.bubble, alpha: 1, duration: 300 })
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
