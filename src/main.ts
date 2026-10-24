import Phaser from 'phaser'
import './style.css'
import { HomeScene } from './game/HomeScene'
import { computeProgress, todayStatus } from './core/progression'
import { levelUpTo } from './core/levelup'
import { liveRecords, startSession, stopSession } from './core/session'
import { backupFileName, exportBackup } from './core/backup'
import { loadSave, writeSave, SAVE_KEY, type KV } from './core/storage'
import type { SaveData } from './core/types'
import { createHud } from './ui/hud'
import { createSettings } from './ui/settings'
import { createSkills } from './ui/skills'
import { learnSkill, remainingSkillPoints, skillRanks } from './core/skills'
import { STAGES } from './core/stages'
import { createStages } from './ui/stages'

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
  () => skills.open(),
  () => stages.open(),
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
    shownLevel = undefined
    render()
  },
})

const currentLevel = () => computeProgress(liveRecords(save, Date.now())).level

const skills = createSkills(app, {
  view: () => ({ points: remainingSkillPoints(currentLevel(), save.skills), ranks: skillRanks(save.skills) }),
  onLearn(id) {
    const next = learnSkill(save, currentLevel(), id)
    if (!next) return
    save = next
    writeSave(kv, save)
    render()
  },
})

// 전투는 "자동 전투 계산"·"전투 장면 연출"에서 붙인다. 지금은 고른 스테이지만 알려 준다
const stages = createStages(app, {
  progress: () => save.stageProgress,
  onChallenge(no) {
    const s = STAGES[no - 1]
    stages.say(`${s.boss ? '보스' : `${no}스테이지`} 전투는 곧 열려요. 조금만 기다려 주세요!`)
  },
})

// 상한 안내는 운동 중에 닿았을 때 하루 한 번만 띄운다
let capToastDay = ''
// 마지막으로 그린 레벨. 처음 열 때와 백업을 가져온 직후에는 비워 두어 축하하지 않는다
let shownLevel: number | undefined

function render() {
  const now = Date.now()
  const records = liveRecords(save, now)
  const p = computeProgress(records)
  const today = todayStatus(records, 'exercise', now)
  const day = new Date(now).toDateString()
  if (today.reached && save.active && capToastDay !== day) {
    capToastDay = day
    hud.showCapToast()
  }
  const up = levelUpTo(shownLevel, p.level)
  shownLevel = p.level
  if (up !== null) {
    hud.showLevelUp(up)
    const scene = game.scene.getScene('home') as HomeScene | null
    if (scene?.sys.isActive()) scene.celebrate()
  }
  hud.render({
    level: p.level,
    expIntoLevel: p.expIntoLevel,
    expForNextLevel: p.expForNextLevel,
    running: save.active !== null,
    elapsedMs: save.active ? now - save.active.startedAt : 0,
    todayMinutes: today.minutes,
    todayCap: today.cap,
    capReached: today.reached,
    skillPoints: remainingSkillPoints(p.level, save.skills),
  })
  skills.refresh()
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: hud.sceneHost,
  transparent: true,
  banner: false,
  scale: { mode: Phaser.Scale.RESIZE },
  scene: HomeScene,
})

render()
setInterval(render, 1000)
document.addEventListener('visibilitychange', render)
window.__debug = { getSave: () => save }
