import Phaser from 'phaser'
import './style.css'
import { HomeScene } from './game/HomeScene'
import { computeProgress, todayStatus } from './core/progression'
import { levelUpTo, restoreShownLevel } from './core/levelup'
import { liveRecords, startSession, stopSession } from './core/session'
import { backupFileName, exportBackup, importLosesProgress } from './core/backup'
import { canPersist, loadSave, syncSave, writeSave, SAVE_KEY, type KV } from './core/storage'
import type { SaveData } from './core/types'
import { createHud } from './ui/hud'
import { createSettings } from './ui/settings'
import { createSkills } from './ui/skills'
import { learnSkill, remainingSkillPoints, skillRanks } from './core/skills'
import { STAGES } from './core/stages'
import { createStages } from './ui/stages'
import { createBattleBar } from './ui/battle'
import { playerFighter, simulateBattle } from './core/battle'
import { battleTimeline, stepDelay } from './core/replay'
import { homeMonster, stageEnemy, stageMonster } from './core/monsters'
import { applyBattleResult, type BattleOutcome } from './core/result'
import { ownedCosmetics, toggleWear, wornCosmetics } from './core/cosmetics'
import { createCosmetics } from './ui/cosmetics'
import { statRows } from './core/stats'

declare global {
  interface Window {
    __debug: { getSave(): SaveData }
  }
}

/** 브라우저 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 메모리에만 둔다 */
function openStorage(): { kv: KV; persistent: boolean } {
  try {
    const s = window.localStorage
    s.getItem('probe')
    return { kv: s, persistent: canPersist(s) }
  } catch {
    const m = new Map<string, string>()
    return { kv: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }, persistent: false }
  }
}

const storage = openStorage()
const kv = storage.kv
let save = loadSave(kv, Date.now())
// 저장이 안 되면(가득 참 등) 창을 닫는 순간 기록이 사라지므로 화면에 알리고 백업을 권한다
let saveOk = storage.persistent
function persist() {
  saveOk = writeSave(kv, save) && storage.persistent
}

/** 다른 창이 저장했으면 그 내용으로 바꾼다. 바뀌었으면 true */
function pullSave(): boolean {
  const next = syncSave(kv, save)
  if (next === save) return false
  save = next
  // 다른 창에서 오른 레벨은 여기서 축하하지 않는다
  shownLevel = undefined
  return true
}

const app = document.querySelector<HTMLElement>('#app')!

const hud = createHud(
  app,
  () => {
    pullSave()
    const now = Date.now()
    save = save.active ? stopSession(save, now) : startSession(save, 'exercise', now)
    persist()
    render()
  },
  () => settings.open(),
  () => skills.open(),
  () => stages.open(),
  () => cosmetics.open(),
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
  describeCurrent() {
    pullSave()
    return this.describe(save)
  },
  // 실수로 오래된 백업을 고르면 그 뒤에 쌓은 기록이 사라지므로 미리 알린다
  losesProgress: (s) => importLosesProgress(save, s, Date.now()),
  onImport(s) {
    // 덮어쓰기 전 지금 저장을 따로 남겨 둔다(잘못 가져와도 기록이 사라지지 않게)
    const now = Date.now()
    try {
      kv.setItem(`${SAVE_KEY}:before-import:${now}`, JSON.stringify(save))
    } catch {
      // 남기지 못해도 가져오기는 진행한다
    }
    save = s
    persist()
    shownLevel = undefined
    render()
  },
})

const currentProgress = () => computeProgress(liveRecords(save, Date.now()))
const currentLevel = () => currentProgress().level

const skills = createSkills(app, {
  view: () => {
    const p = currentProgress()
    return { points: remainingSkillPoints(p.level, save.skills), ranks: skillRanks(save.skills), stats: statRows(p) }
  },
  onLearn(id) {
    pullSave()
    const next = learnSkill(save, currentLevel(), id)
    if (!next) return
    save = next
    persist()
    render()
  },
})

// 꾸미기는 모습만 바꾼다(입은 꾸미기 저장만 바뀜)
const cosmetics = createCosmetics(app, {
  view: () => ({ owned: ownedCosmetics(save), worn: wornCosmetics(save) }),
  onWear(id) {
    pullSave()
    const next = toggleWear(save, id)
    if (next === save) return
    save = next
    persist()
    render()
  },
})

const homeScene = () => {
  const scene = game.scene.getScene('home') as HomeScene | null
  return scene?.sys.isActive() ? scene : null
}

function resultNote(o: BattleOutcome, win: boolean): string {
  if (!win) return '💪 운동으로 더 키워서 다시 와요'
  if (o.allCleared) return '👑 모든 스테이지를 깼어요!'
  if (o.unlocked !== null) {
    const next = STAGES[o.unlocked - 1]
    return next.boss ? `🔓 보스 스테이지가 열렸어요 · ${next.name}` : `🔓 ${next.no}스테이지가 열렸어요 · ${next.name}`
  }
  return '⭐ 이미 깬 스테이지예요'
}

// 전투가 바꾸는 저장은 깬 스테이지 수와 꾸미기뿐이다(applyBattleResult)
const battleBar = createBattleBar(hud.sceneHost, {
  onSkip: () => homeScene()?.skipBattle(),
  onLeave() {
    homeScene()?.endBattle()
    battleBar.hide()
  },
})

const stages = createStages(app, {
  progress: () => save.stageProgress,
  onChallenge(no) {
    pullSave()
    const s = STAGES[no - 1]
    const p = computeProgress(liveRecords(save, Date.now()))
    const me = playerFighter(p.stats, save.skills)
    const enemy = stageEnemy(no)
    const result = simulateBattle(me, enemy, Date.now())
    const timeline = battleTimeline(me, enemy, result)
    const foe = stageMonster(no)
    // 결과는 재생 전에 저장한다(재생 중 앱을 닫아도 깬 스테이지가 남게). 바뀌는 건 깬 스테이지 수와 꾸미기뿐이다
    const outcome = applyBattleResult(save, no, result.win)
    if (outcome.save !== save) {
      save = outcome.save
      persist()
    }
    const reward = outcome.reward ? `🎁 새 꾸미기 · ${outcome.reward.icon} ${outcome.reward.name}` : null
    const view = { win: result.win, rounds: result.rounds, note: resultNote(outcome, result.win), reward }
    stages.close()
    battleBar.start(`${s.boss ? '보스' : `${no}스테이지`} · ${s.name}`, foe.name)
    const scene = homeScene()
    if (scene) scene.playBattle(timeline, stepDelay(timeline.steps.length), foe, () => battleBar.end(view))
    else battleBar.end(view)
  },
})

// 상한 안내는 운동 중에 닿았을 때 하루 한 번만 띄운다
let capToastDay = ''
// 마지막으로 그린 레벨. 백업을 가져온 직후에는 비워 두어 축하하지 않는다.
// 처음 열 때는 지난번 창에서 본 레벨을 되살려, 앱을 닫아 둔 사이 오른 레벨도 축하한다
const SEEN_LEVEL_KEY = `${SAVE_KEY}:seen-level`
let shownLevel = restoreShownLevel(readKey(SEEN_LEVEL_KEY), currentLevel())

function readKey(key: string): string | null {
  try {
    return kv.getItem(key)
  } catch {
    return null
  }
}

function rememberShownLevel(level: number) {
  try {
    kv.setItem(SEEN_LEVEL_KEY, String(level))
  } catch {
    // 못 남기면 다음에 열 때 축하를 건너뛸 뿐이다
  }
}

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
  if (shownLevel !== p.level) rememberShownLevel(p.level)
  shownLevel = p.level
  if (up !== null) {
    hud.showLevelUp(up)
    homeScene()?.celebrate()
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
    saveFailed: !saveOk,
  })
  skills.refresh()
  homeScene()?.showHomeMonster(homeMonster(save.stageProgress))
  homeScene()?.dress(wornCosmetics(save))
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
// 설치한 앱과 브라우저 탭을 함께 열어도 오래된 창이 새 기록을 덮어쓰지 않게 저장을 따라간다
window.addEventListener('storage', (e) => {
  if (e.key === SAVE_KEY && pullSave()) render()
})
document.addEventListener('visibilitychange', () => {
  pullSave()
  render()
})
window.__debug = { getSave: () => save }
