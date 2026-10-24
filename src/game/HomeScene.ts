import Phaser from 'phaser'

const MASCOT = 0xffd7a8
const MASCOT_SHADE = 0xf7b97a
const MONSTER = 0xc9a7ff
const MONSTER_SHADE = 0xa985ea
const INK = 0x5a4636
const CONFETTI = [0xff8a5b, 0xffd36b, 0x9be3c4, 0xa8d4ff, 0xffa8c8, 0xc9a7ff]

/** 홈 장면: 둥근 마스코트와 몬스터가 마주 보고, 마스코트가 숨 쉬듯 움직인다 */
export class HomeScene extends Phaser.Scene {
  private mascot!: Phaser.GameObjects.Container
  private monster!: Phaser.GameObjects.Container
  private bubble!: Phaser.GameObjects.Container
  private jump?: Phaser.Tweens.Tween

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

    this.tweens.add({ targets: this.mascot, scaleY: 0.94, scaleX: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: this.monster, y: '-=6', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  /** 레벨업: 마스코트가 폴짝 뛰고 파스텔 색종이가 터진다. 말풍선은 축하 배지에 자리를 비켜 준다 */
  celebrate() {
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

  private layout(w: number, h: number) {
    const ground = h * 0.68
    this.mascot.setPosition(w * 0.3, ground)
    this.monster.setPosition(w * 0.72, ground + 6)
    this.bubble.setPosition(w / 2, Math.max(28, h * 0.16))
  }
}
