import { soundRecipe, type SoundName } from '../core/sound'

let on = true
let ctx: AudioContext | null = null

export function setSoundOn(value: boolean) {
  on = value
}

export function soundOn() {
  return on
}

/** 효과음을 낸다. 꺼 두었거나 소리를 못 내는 환경이면 조용히 넘어간다 */
export function playSound(name: SoundName) {
  if (!on) return
  // e2e가 어떤 소리를 냈는지 볼 수 있게 최근 것만 남긴다
  const el = document.documentElement
  el.dataset.sounds = [...(el.dataset.sounds ?? '').split(' ').filter(Boolean), name].slice(-12).join(' ')
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime + 0.01
    for (const t of soundRecipe(name)) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = t.wave
      osc.frequency.setValueAtTime(t.freq, t0 + t.at)
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.at + t.dur)
      // 톡 튀지 않게 아주 짧게 커졌다가 부드럽게 줄어든다
      gain.gain.setValueAtTime(0.0001, t0 + t.at)
      gain.gain.exponentialRampToValueAtTime(t.gain, t0 + t.at + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + t.at)
      osc.stop(t0 + t.at + t.dur + 0.02)
    }
  } catch {
    // 소리를 못 내도 게임은 그대로 간다
  }
}
