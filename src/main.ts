import Phaser from 'phaser'
import './style.css'
import { HomeScene } from './game/HomeScene'
import { computeProgress } from './core/progression'
import { liveRecords, startSession, stopSession } from './core/session'
import { loadSave, writeSave, type KV } from './core/storage'
import type { SaveData } from './core/types'
import { createHud } from './ui/hud'

declare global {
  interface Window {
    __debug: { getSave(): SaveData }
  }
}

/** 브라우저 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 메모리에만 둔다 */
function openStorage(): KV {
  try {
    const s = window.localStorage
    s.getItem('probe')
    return s
  } catch {
    const m = new Map<string, string>()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
  }
}

const kv = openStorage()
let save = loadSave(kv, Date.now())

const hud = createHud(document.querySelector<HTMLElement>('#app')!, () => {
  const now = Date.now()
  save = save.active ? stopSession(save, now) : startSession(save, 'exercise', now)
  writeSave(kv, save)
  render()
})

function render() {
  const now = Date.now()
  const p = computeProgress(liveRecords(save, now))
  hud.render({
    level: p.level,
    expIntoLevel: p.expIntoLevel,
    expForNextLevel: p.expForNextLevel,
    running: save.active !== null,
    elapsedMs: save.active ? now - save.active.startedAt : 0,
  })
}

render()
setInterval(render, 1000)
document.addEventListener('visibilitychange', render)
window.__debug = { getSave: () => save }

new Phaser.Game({
  type: Phaser.AUTO,
  parent: hud.sceneHost,
  transparent: true,
  banner: false,
  scale: { mode: Phaser.Scale.RESIZE },
  scene: HomeScene,
})
