import Phaser from 'phaser'
import './style.css'
import { HomeScene } from './game/HomeScene'
import { computeProgress } from './core/progression'
import { liveRecords, startSession, stopSession } from './core/session'
import { backupFileName, exportBackup } from './core/backup'
import { loadSave, writeSave, SAVE_KEY, type KV } from './core/storage'
import type { SaveData } from './core/types'
import { createHud } from './ui/hud'
import { createSettings } from './ui/settings'

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

const app = document.querySelector<HTMLElement>('#app')!

const hud = createHud(
  app,
  () => {
    const now = Date.now()
    save = save.active ? stopSession(save, now) : startSession(save, 'exercise', now)
    writeSave(kv, save)
    render()
  },
  () => settings.open(),
)

// 설정 창은 HUD 뒤에 붙인다(HUD가 #app 내용을 새로 채우기 때문)
const settings = createSettings(app, {
  onExport() {
    const now = Date.now()
    const url = URL.createObjectURL(new Blob([exportBackup(save, now)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName(now)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  describe(s) {
    const p = computeProgress(liveRecords(s, Date.now()))
    return `Lv.${p.level} · 운동 기록 ${s.records.length}개`
  },
  onImport(s) {
    // 덮어쓰기 전 지금 저장을 따로 남겨 둔다(잘못 가져와도 기록이 사라지지 않게)
    const now = Date.now()
    try {
      kv.setItem(`${SAVE_KEY}:before-import:${now}`, JSON.stringify(save))
    } catch {
      // 남기지 못해도 가져오기는 진행한다
    }
    save = s
    writeSave(kv, save)
    render()
  },
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
