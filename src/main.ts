import Phaser from 'phaser'
import './style.css'
import { HomeScene, HOME_READY } from './game/HomeScene'
import { computeProgress, dayKey, todayStatus } from './core/progression'
import { goalStreak, stampCalendar, stampCount, todayGoal } from './core/goal'
import { weekGoal } from './core/week'
import { missionStars, todayMission } from './core/mission'
import { historyPage, recordSummary } from './core/history'
import { levelUpPoints, levelUpTo, restoreShownLevel } from './core/levelup'
import { liveRecords, startSession, stopSession } from './core/session'
import { backupFileName, exportBackup, importLosesProgress } from './core/backup'
import { canPersist, loadSave, syncSave, writeSave, SAVE_KEY, type KV } from './core/storage'
import type { ActivityId, SaveData } from './core/types'
import { ACTIVITIES } from './core/activities'
import { createHud } from './ui/hud'
import { createSettings } from './ui/settings'
import { createSkills } from './ui/skills'
import { learnSkill, remainingSkillPoints, skillRanks } from './core/skills'
import { endlessStage, homeMonster, STAGES_PER_CHAPTER } from './core/endless'
import { createStages, stageLabel } from './ui/stages'
import { createDex } from './ui/dex'
import { dexShadows, monsterDex, newDexMonsters } from './core/dex'
import { createBattleBar } from './ui/battle'
import { enemyDamagePercent, playerFighter, simulateBattle } from './core/battle'
import { AUTO_RUN_GAP, autoStepDelay, battleTimeline, stepDelay } from './core/replay'
import { applyBattleResult, type BattleOutcome } from './core/result'
import { cosmeticCatalog, ownedCosmetics, toggleWear, wornCosmetics } from './core/cosmetics'
import { createCosmetics } from './ui/cosmetics'
import { statRows } from './core/stats'
import { nextStageAdvice, stageMinutesToWin, winnableStages } from './core/coach'
import { autoRunCard, awayAdventure, awayCard, dexNewText, formatMinutes, sessionSummary } from './ui/format'
import { autoRun } from './core/autorun'
import { awaySummary, shouldShowAway } from './core/away'
import { sessionGain } from './core/gain'

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

// 고른 활동 탭. 켜져 있는 타이머가 있으면 그 활동으로 연다
let selected: ActivityId = save.active?.activity ?? 'exercise'

const hud = createHud(
  app,
  () => {
    pullSave()
    const now = Date.now()
    // 동시에 두 활동 타이머를 켤 수 없다(버튼도 막혀 있다)
    if (save.active && save.active.activity !== selected) return render()
    // 그만둘 때 이번에 얻은 것을 보여 줘 성장을 느끼게 한다(화면에 보여 줄 값일 뿐)
    const gain = sessionGain(save, now)
    const done = save.active?.activity ?? selected
    save = save.active ? stopSession(save, now) : startSession(save, selected, now)
    persist()
    if (gain) hud.showSessionSummary(sessionSummary(gain, todayStatus(save.records, done, now).reached, done))
    else hud.hideSessionSummary()
    render()
  },
  () => settings.open(),
  () => skills.open(),
  () => stages.open(),
  () => cosmetics.open(),
  (activity) => {
    selected = activity
    render()
  },
  () => startAutoRun(),
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
    return `Lv.${p.level} · 활동 기록 ${s.records.length}개`
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
    const now = Date.now()
    const records = liveRecords(save, now)
    const p = computeProgress(records)
    // 오늘 상한을 채운 활동은 능력치 칸에 "내일" 이어서 오른다고 알려 준다
    const capped = (Object.keys(ACTIVITIES) as ActivityId[]).filter((id) => todayStatus(records, id, now).reached)
    const stats = statRows(p, capped)
    // 도장판은 홈의 오늘 목표처럼 켜 둔 타이머의 지금까지도 센다
    const board = {
      calendar: stampCalendar(records, now),
      stamps: stampCount(records),
      streak: goalStreak(records, now),
      week: weekGoal(records, now),
      missions: missionStars(records),
    }
    return {
      points: remainingSkillPoints(p.level, save.skills),
      ranks: skillRanks(save.skills),
      stats,
      board,
      history: recordSummary(records, now),
      historyPage: (page: number) => historyPage(records, now, page),
    }
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

/** 꾸미기용: 도장 모자는 켜 둔 타이머로 오늘 찍은 도장도 센다 */
const lookSave = () => ({ ...save, records: liveRecords(save, Date.now()) })

// 꾸미기는 모습만 바꾼다(입은 꾸미기 저장만 바뀜)
const cosmetics = createCosmetics(app, {
  view: () => {
    const s = lookSave()
    return { catalog: cosmeticCatalog(s), owned: ownedCosmetics(s), worn: wornCosmetics(s) }
  },
  onWear(id) {
    pullSave()
    const s = lookSave()
    const next = toggleWear(s, id)
    if (next === s) return
    save = { ...save, worn: next.worn }
    persist()
    render()
  },
})

const homeScene = () => {
  const scene = game.scene.getScene('home') as HomeScene | null
  return scene?.sys.isActive() ? scene : null
}

/** toWin = 운동 몇 분 더 하면 이길 만한지(minutesToWin). 졌을 때만 쓴다 */
function resultNote(o: BattleOutcome, win: boolean, toWin: number | null): string {
  if (!win) {
    if (toWin === null) return '💪 운동으로 더 키워서 다시 와요'
    if (toWin === 0) return '🍀 지금도 이길 만해요 · 다시 도전해 봐요'
    return `💪 운동 ${formatMinutes(toWin)} 더 하면 이길 만해요`
  }
  if (o.unlocked !== null) {
    const next = endlessStage(o.unlocked)
    if (o.newChapter !== null) return `🎉 새 장이 열렸어요 · ${next.chapter}장 ${next.chapterName}`
    return next.boss ? `🔓 보스 스테이지가 열렸어요 · ${next.name}` : `🔓 ${next.no}스테이지가 열렸어요 · ${next.name}`
  }
  return '⭐ 이미 깬 스테이지예요'
}

// 전투가 바꾸는 저장은 깬 스테이지 수와 꾸미기뿐이다(applyBattleResult)
// 자동 진행 연출 중이면 건너뛰기가 남은 판을 모두 건너뛴다
let skipAutoRun: (() => void) | null = null
const battleBar = createBattleBar(hud.sceneHost, {
  onSkip: () => (skipAutoRun ? skipAutoRun() : homeScene()?.skipBattle()),
  onLeave() {
    homeScene()?.endBattle()
    battleBar.hide()
  },
})

// 다음 스테이지부터 처음 질 때까지(최대 10판) 이어 싸운다. 바뀌는 건 깬 스테이지 수와 꾸미기뿐이다(autoRun)
// 모험 지도와 자리 비운 동안 카드의 "⏩ 자동 진행"이 함께 쓴다
function startAutoRun() {
  pullSave()
  const p = currentProgress()
  const run = autoRun(save, p.stats, save.skills)
  if (run.save !== save) {
    save = run.save
    persist()
  }
  const lost = run.stoppedAt === null ? null : run.battles[run.battles.length - 1]
  const toWin = run.stoppedAt === null ? null : stageMinutesToWin(p.creditedMinutes, save.skills, run.stoppedAt)
  const card = autoRunCard(run, toWin)
  // 장 보스를 넘었으면 마지막으로 열린 장을 배지로 알린다
  const chapter = Math.floor(run.to / STAGES_PER_CHAPTER) > Math.floor(run.from / STAGES_PER_CHAPTER)
    ? Math.floor(run.to / STAGES_PER_CHAPTER) + 1
    : null
  const foe = lost ? endlessStage(lost.no) : null
  stages.close()
  hud.hideToasts()
  render()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    skipAutoRun = null
    battleBar.end({
      ...card,
      rounds: 0,
      status: `${run.battles.filter((b) => b.win).length}판 이겼어요`,
      heading: '⏩ 자동 진행',
      // 한 판도 못 깼으면 진 상대를 얼마나 깎았는지 보여 준다
      foe: foe?.monster.name ?? '',
      damage: foe && lost ? enemyDamagePercent(foe.enemy, lost.result) : 0,
      chapter,
      dex: dexNewText(newDexMonsters(run.from, run.to)),
    })
    if (chapter !== null) homeScene()?.celebrateChapter()
  }
  // 결과는 이미 저장했고, 장면에서는 판마다 빠르게 이어 싸우는 모습만 보여 준다(연출일 뿐)
  const me = playerFighter(p.stats, save.skills)
  const total = run.battles.length
  const play = (i: number) => {
    if (done) return
    const b = run.battles[i]
    const s = endlessStage(b.no)
    battleBar.start(`자동 진행 ${i + 1}/${total} · ${stageLabel(s)}`, s.monster.name)
    const scene = homeScene()
    if (!scene) return finish()
    const timeline = battleTimeline(me, s.enemy, b.result)
    scene.playBattle(timeline, autoStepDelay(timeline.steps.length), s.monster, () => {
      if (i + 1 < total) setTimeout(() => play(i + 1), AUTO_RUN_GAP)
      else finish()
    })
  }
  // "건너뛰기"는 남은 판을 모두 건너뛰고 바로 결과 카드를 띄운다
  skipAutoRun = () => {
    homeScene()?.skipBattle()
    finish()
  }
  play(0)
}

const stages = createStages(app, {
  progress: () => save.stageProgress,
  // 다음 스테이지를 운동 몇 분 더 하면 이길 만한지(화면에 보여 줄 값일 뿐)
  advice: () => nextStageAdvice(currentProgress().creditedMinutes, save.skills, save.stageProgress),
  winnable: () => winnableStages(currentProgress().creditedMinutes, save.skills, save.stageProgress),
  onAutoRun: () => startAutoRun(),
  // 도감은 모험 지도 위에 띄우고, 닫으면 지도로 돌아온다
  onDex: () => {
    pullSave()
    dex.open()
  },
  onChallenge(no) {
    pullSave()
    const s = endlessStage(no)
    const p = computeProgress(liveRecords(save, Date.now()))
    const me = playerFighter(p.stats, save.skills)
    const enemy = s.enemy
    const result = simulateBattle(me, enemy, Date.now())
    const timeline = battleTimeline(me, enemy, result)
    const foe = s.monster
    // 결과는 재생 전에 저장한다(재생 중 앱을 닫아도 깬 스테이지가 남게). 바뀌는 건 깬 스테이지 수와 꾸미기뿐이다
    const outcome = applyBattleResult(save, no, result.win)
    // 처음 보는 몬스터를 이겼으면 결과 카드에 도감 알림을 단다(보여 줄 값일 뿐)
    const dexNew = newDexMonsters(save.stageProgress, outcome.save.stageProgress)
    if (outcome.save !== save) {
      save = outcome.save
      persist()
    }
    const reward = outcome.reward ? `🎁 새 꾸미기 · ${outcome.reward.icon} ${outcome.reward.name}` : null
    const view = {
      win: result.win,
      rounds: result.rounds,
      // 지면 얼마나 더 키우면 되는지 알려 다시 운동하러 가게 한다(화면에 보여 줄 값일 뿐)
      note: resultNote(outcome, result.win, result.win ? null : stageMinutesToWin(p.creditedMinutes, save.skills, no)),
      reward,
      foe: foe.name,
      damage: enemyDamagePercent(enemy, result),
      chapter: outcome.newChapter,
      dex: dexNewText(dexNew),
    }
    stages.close()
    hud.hideToasts()
    battleBar.start(`${stageLabel(s)} · ${s.name}`, foe.name)
    // 장 보스를 처음 깼으면 결과 카드에 배지를 달고 장면에서 색종이가 터진다(연출일 뿐)
    const end = () => {
      battleBar.end(view)
      if (outcome.newChapter !== null) homeScene()?.celebrateChapter()
    }
    const scene = homeScene()
    if (scene) scene.playBattle(timeline, stepDelay(timeline.steps.length), foe, end)
    else end()
  },
})

// 모험 지도보다 나중에 붙여 지도 위에 뜨게 한다. 깬 스테이지에서 계산만 하고 저장은 바꾸지 않는다
const dex = createDex(app, {
  progress: () => save.stageProgress,
  count: () => monsterDex(save.stageProgress).count,
  shadows: () => dexShadows(currentProgress().creditedMinutes, save.skills, save.stageProgress),
})

// 상한 안내는 운동 중에 닿았을 때 하루 한 번만 띄운다
let capToastDay = ''
// 마지막으로 그린 레벨. 백업을 가져온 직후에는 비워 두어 축하하지 않는다.
// 처음 열 때는 지난번 창에서 본 레벨을 되살려, 앱을 닫아 둔 사이 오른 레벨도 축하한다
const SEEN_LEVEL_KEY = `${SAVE_KEY}:seen-level`
let shownLevel = restoreShownLevel(readKey(SEEN_LEVEL_KEY), currentLevel())
// 축하 배지는 띄웠지만 장면이 아직 준비되지 않아 폴짝·색종이를 미뤄 둔 상태
let celebratePending = false

function readKey(key: string): string | null {
  try {
    return kv.getItem(key)
  } catch {
    return null
  }
}

// 도장 쾅! 연출은 하루 한 번만. 닫아 둔 사이 채웠으면 다시 열 때 보여 준다
const STAMP_DAY_KEY = `${SAVE_KEY}:stamp-day`
let stampDay = readKey(STAMP_DAY_KEY)

function rememberStampDay(day: string) {
  stampDay = day
  try {
    kv.setItem(STAMP_DAY_KEY, day)
  } catch {
    // 못 남기면 다시 열 때 한 번 더 찍을 뿐이다
  }
}

// 이번 주 목표 달성 연출도 주마다 한 번만(그 주 월요일 키를 남긴다)
const WEEK_DONE_KEY = `${SAVE_KEY}:week-done`
let weekDone = readKey(WEEK_DONE_KEY)

function rememberWeekDone(week: string) {
  weekDone = week
  try {
    kv.setItem(WEEK_DONE_KEY, week)
  } catch {
    // 못 남기면 다시 열 때 한 번 더 축하할 뿐이다
  }
}

// 오늘의 미션 완료 연출도 하루 한 번만
const MISSION_DAY_KEY = `${SAVE_KEY}:mission-day`
let missionDay = readKey(MISSION_DAY_KEY)

function rememberMissionDay(day: string) {
  missionDay = day
  try {
    kv.setItem(MISSION_DAY_KEY, day)
  } catch {
    // 못 남기면 다시 열 때 한 번 더 찍을 뿐이다
  }
}

// 마지막으로 화면을 본 시각. 한동안 닫아 뒀다가 다시 열면 그 사이 늘어난 것을 한 번 보여 준다
const LAST_SEEN_KEY = `${SAVE_KEY}:last-seen`
const storedSeen = Number(readKey(LAST_SEEN_KEY))
let lastSeen: number | null = Number.isFinite(storedSeen) && storedSeen > 0 ? storedSeen : null
// 자리 비운 동안 카드에 레벨업을 함께 띄웠으면 그 레벨은 따로 배지를 띄우지 않는다(같은 자리)
let awayLevel: number | null = null

function rememberLastSeen(now: number) {
  lastSeen = now
  try {
    kv.setItem(LAST_SEEN_KEY, String(now))
  } catch {
    // 못 남기면 다음에 열 때 요약을 건너뛸 뿐이다
  }
}

/** 다시 열거나 다시 돌아왔을 때 자리 비운 동안 늘어난 게 있으면 카드를 띄운다(화면에 보여 줄 값일 뿐) */
function checkAway(now: number) {
  if (lastSeen === null) return
  const a = awaySummary(save, lastSeen, now)
  if (!shouldShowAway(a)) return
  // 지금 이길 만한 스테이지가 있으면 바로 모험 가자고, 없으면 다음 스테이지까지 운동 몇 분 더인지 알려 준다
  const minutes = computeProgress(liveRecords(save, now)).creditedMinutes
  const winnable = winnableStages(minutes, save.skills, save.stageProgress)
  const toWin = winnable > 0 ? 0 : nextStageAdvice(minutes, save.skills, save.stageProgress)!.toWin
  hud.showAway({ ...awayCard(a), adventure: awayAdventure(winnable, toWin), canGo: winnable > 0 })
  if (a.levelAfter > a.levelBefore) awayLevel = a.levelAfter
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
  const live = save.active?.activity ?? null
  const today = todayStatus(records, selected, now)
  // 상한 안내는 켜져 있는 활동이 상한에 닿았을 때 활동마다 하루 한 번
  const liveFull = live !== null && todayStatus(records, live, now).reached
  const day = `${new Date(now).toDateString()}:${live}`
  if (liveFull && capToastDay !== day) {
    capToastDay = day
    hud.showCapToast(live!)
  }
  const up = levelUpTo(shownLevel, p.level)
  const points = levelUpPoints(shownLevel, p.level)
  if (shownLevel !== p.level) rememberShownLevel(p.level)
  shownLevel = p.level
  if (up !== null) {
    if (up !== awayLevel) hud.showLevelUp(up, points)
    celebratePending = true
  }
  awayLevel = null
  // 보고 있는 동안만 마지막으로 본 시각을 남긴다(뒤로 가 있는 동안 도는 타이머는 세지 않는다)
  if (document.visibilityState === 'visible') rememberLastSeen(now)
  // 처음 열 때는 장면이 아직 준비 중일 수 있어, 준비되면 그때 말랑이가 폴짝 뛴다
  if (celebratePending && homeScene()) {
    celebratePending = false
    homeScene()?.celebrate()
  }
  // 하루 목표는 모든 활동을 합쳐 센다(켜 둔 타이머의 지금까지 포함, 상한 넘긴 시간은 빼고)
  const goal = todayGoal(records, now)
  if (goal.done && stampDay !== dayKey(now)) {
    rememberStampDay(dayKey(now))
    hud.showStamp()
  }
  const week = weekGoal(records, now)
  if (week.done && weekDone !== week.week) {
    rememberWeekDone(week.week)
    hud.showWeekDone()
  }
  const mission = todayMission(records, now)
  if (mission.done && missionDay !== dayKey(now)) {
    rememberMissionDay(dayKey(now))
    hud.showMissionDone()
  }
  hud.render({
    level: p.level,
    expIntoLevel: p.expIntoLevel,
    expForNextLevel: p.expForNextLevel,
    activity: selected,
    live,
    running: live === selected,
    elapsedMs: save.active ? now - save.active.startedAt : 0,
    todayMinutes: today.minutes,
    todayCap: today.cap,
    capReached: today.reached,
    skillPoints: remainingSkillPoints(p.level, save.skills),
    saveFailed: !saveOk,
    goal,
    week,
    mission,
  })
  skills.refresh()
  homeScene()?.showHomeMonster(homeMonster(save.stageProgress))
  homeScene()?.dress(wornCosmetics({ ...save, records }))
  // 상한을 채운 뒤에도 타이머가 켜져 있으면 말랑이가 그만 쉬자고 한다(모습만 바뀜)
  homeScene()?.setMood(live === null ? 'rest' : liveFull ? 'full' : live)
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: hud.sceneHost,
  transparent: true,
  banner: false,
  scale: { mode: Phaser.Scale.RESIZE },
  scene: HomeScene,
})
// 장면이 준비되면 바로 다시 그려 몬스터·꾸미기·기분과 밀린 축하를 맞춘다
game.events.on(HOME_READY, render)
// 장면 칸 크기가 창 크기와 상관없이 바뀌어도(아래 카드 글자가 들어설 때 등) 캔버스를 칸에 맞춘다.
// 맞추지 않으면 캔버스가 칸보다 커서 아래쪽이 잘리고 말랑이가 실제보다 아래에 놓인다
new ResizeObserver(() => {
  if (game.scale.getParentBounds()) game.scale.refresh()
}).observe(hud.sceneHost)

checkAway(Date.now())
render()
setInterval(render, 1000)
// 설치한 앱과 브라우저 탭을 함께 열어도 오래된 창이 새 기록을 덮어쓰지 않게 저장을 따라간다
window.addEventListener('storage', (e) => {
  if (e.key === SAVE_KEY && pullSave()) render()
})
document.addEventListener('visibilitychange', () => {
  pullSave()
  // 앱을 끄지 않고 뒤로 보냈다가 돌아와도 자리 비운 동안을 보여 준다
  if (document.visibilityState === 'visible') checkAway(Date.now())
  render()
})
window.__debug = { getSave: () => save }
