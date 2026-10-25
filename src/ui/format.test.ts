import { test, expect } from 'vitest'
import { WINNABLE_MAX } from '../core/coach'
import { autoRunCard, awayAdventure, awayCard, formatElapsed, formatMinutes, goalText, objectJosa, weekChip, weekDoneText, weekGoalText, sessionSummary, topicJosa, weekTotalText, bestDayText, dayDetail, pageRangeText, dexShadowText, dexNewText, missionChip, achievementValueText, farAchievementIds, achievementToast, focusText, focusChipLabel, focusDoneText, letterCard, bestBrokenText, newPropText } from './format'
import { ACHIEVEMENTS, achievementProgress } from '../core/achievements'
import { AUTO_RUN_MAX } from '../core/autorun'
import type { Cosmetic } from '../core/cosmetics'
import type { AwaySummary } from '../core/away'

test('한 시간 미만은 MM:SS', () => {
  expect(formatElapsed(0)).toBe('00:00')
  expect(formatElapsed(30 * 60_000)).toBe('30:00')
  expect(formatElapsed(65_999)).toBe('01:05')
})

test('한 시간 이상은 H:MM:SS', () => {
  expect(formatElapsed(3_600_000 + 61_000)).toBe('1:01:01')
})

test('음수는 00:00', () => {
  expect(formatElapsed(-5000)).toBe('00:00')
})

test('분은 한 시간 미만이면 N분, 이상이면 N시간 M분', () => {
  expect(formatMinutes(40)).toBe('40분')
  expect(formatMinutes(60)).toBe('1시간')
  expect(formatMinutes(130)).toBe('2시간 10분')
})

test('운동 마침 요약은 한 시간·얻은 경험치·오른 능력치를 보여 줌', () => {
  const g = { minutes: 32, exp: 320, stats: { str: 3, vit: 3, int: 0, focus: 0 } }
  expect(sessionSummary(g, false)).toEqual({ title: '🎉 운동 32분 했어요!', detail: 'EXP +320 · 💪 힘 +3 · ❤️ 체력 +3' })
  expect(sessionSummary({ ...g, exp: 40, stats: { str: 0, vit: 0, int: 0, focus: 0 } }, false).detail).toBe('EXP +40')
})

test('공부 마침 요약은 공부 이름과 오른 지능을 보여 줌', () => {
  const g = { minutes: 25, exp: 250, stats: { str: 0, vit: 0, int: 5, focus: 0 } }
  expect(sessionSummary(g, false, 'study')).toEqual({ title: '🎉 공부 25분 했어요!', detail: 'EXP +250 · 🧠 지능 +5' })
  expect(sessionSummary({ ...g, minutes: 0, exp: 0 }, false, 'study').title).toBe('🎉 공부를 마쳤어요!')
})

test('독서 마침 요약은 독서 이름과 오른 집중을 보여 줌', () => {
  const g = { minutes: 15, exp: 150, stats: { str: 0, vit: 0, int: 0, focus: 3 } }
  expect(sessionSummary(g, false, 'reading')).toEqual({ title: '🎉 독서 15분 했어요!', detail: 'EXP +150 · 🎯 집중 +3' })
  expect(sessionSummary({ ...g, minutes: 0, exp: 0 }, false, 'reading').title).toBe('🎉 독서를 마쳤어요!')
})

test('휴식 마침 요약은 휴식 이름과 오른 체력을 보여 줌', () => {
  const g = { minutes: 30, exp: 300, stats: { str: 0, vit: 2, int: 0, focus: 0 } }
  expect(sessionSummary(g, true, 'relax')).toEqual({ title: '🎉 휴식 30분 했어요!', detail: 'EXP +300 · ❤️ 체력 +2' })
})

test('마침 요약에 집중 목표: 채웠으면 ✓, 못 채웠으면 몇 분까지 했는지', () => {
  const g = { minutes: 32, exp: 320, stats: { str: 3, vit: 3, int: 0, focus: 0 } }
  const done = { target: 25, elapsedMinutes: 32, remainingMinutes: 0, ratio: 1, reached: true }
  const short = { target: 25, elapsedMinutes: 18, remainingMinutes: 7, ratio: 0.72, reached: false }
  expect(sessionSummary(g, false, 'exercise', done)).toEqual({ title: '🎉 운동 32분!', detail: 'EXP +320 · 💪 힘 +3 · ❤️ 체력 +3', goal: '🎯 25분 ✓' })
  expect(sessionSummary({ ...g, minutes: 18 }, false, 'exercise', short).goal).toBe('🎯 25분 중 18분')
  expect(sessionSummary({ ...g, minutes: 0, exp: 0 }, true, 'study', { ...short, elapsedMinutes: 0 }).goal).toBe('🎯 25분 중 0분')
  expect(sessionSummary(g, false, 'exercise', null).goal).toBeUndefined()
})

test('받침에 맞춰 을/를, 은/는을 고른다', () => {
  expect(['운동', '공부', '독서', '휴식'].map(objectJosa)).toEqual(['을', '를', '를', '을'])
  expect(['운동', '공부', '독서', '휴식'].map(topicJosa)).toEqual(['은', '는', '는', '은'])
})

test('경험치를 못 얻었으면 까닭을 알려 줌', () => {
  const none = { str: 0, vit: 0, int: 0, focus: 0 }
  expect(sessionSummary({ minutes: 20, exp: 0, stats: none }, true)).toEqual({
    title: '🎉 운동 20분 했어요!',
    detail: '상한을 채워서 경험치는 내일 쌓여요',
  })
  expect(sessionSummary({ minutes: 0, exp: 0, stats: none }, false)).toEqual({
    title: '🎉 운동을 마쳤어요!',
    detail: '1분 넘게 하면 경험치가 쌓여요',
  })
})

test('오늘 목표 글자: 채우기 전엔 🎯, 채우면 🌟 달성(넘친 분도 보임)', () => {
  expect(goalText({ minutes: 0, goal: 30, done: false })).toBe('🎯 오늘 목표 0 / 30분')
  expect(goalText({ minutes: 12, goal: 30, done: false })).toBe('🎯 오늘 목표 12 / 30분')
  expect(goalText({ minutes: 30, goal: 30, done: true })).toBe('🌟 오늘 목표 달성 30 / 30분')
  expect(goalText({ minutes: 45, goal: 30, done: true })).toBe('🌟 오늘 목표 달성 45 / 30분')
})

test('이번 주 목표 글자: 도장판 제목·홈 작은 칩·채운 주 수', () => {
  expect(weekGoalText({ stamped: 3, goal: 5, done: false })).toBe('📅 이번 주 3 / 5일')
  expect(weekGoalText({ stamped: 5, goal: 5, done: true })).toBe('🏅 이번 주 목표 달성 5 / 5일')
  expect(weekGoalText({ stamped: 7, goal: 5, done: true })).toBe('🏅 이번 주 목표 달성 7 / 5일')
  expect(weekChip({ stamped: 0, goal: 5, done: false })).toBe('📅 0/5')
  expect(weekChip({ stamped: 3, goal: 5, done: false })).toBe('📅 3/5')
  expect(weekChip({ stamped: 6, goal: 5, done: true })).toBe('🏅 6/5')
  expect(weekDoneText(0)).toBe('🏅 채운 주 아직 없어요')
  expect(weekDoneText(4)).toBe('🏅 채운 주 4번')
})

const away = (over: Partial<AwaySummary> = {}): AwaySummary => ({
  awayMs: 125 * 60_000,
  minutes: { exercise: 30, study: 0, reading: 10, relax: 0 },
  exp: 400,
  stats: { str: 3, vit: 3, int: 0, focus: 2 },
  levelBefore: 1,
  levelAfter: 3,
  stampsBefore: 0,
  stampsAfter: 1,
  gained: true,
  ...over,
})

test('자리 비운 동안 카드: 흐른 시간, 한 활동, 얻은 것, 레벨·스킬 포인트·도장', () => {
  expect(awayCard(away())).toEqual({
    title: '🌙 자리 비운 동안 · 2시간 5분',
    did: '운동 30분 · 독서 10분 했어요',
    gain: 'EXP +400 · 💪 힘 +3 · ❤️ 체력 +3 · 🎯 집중 +2',
    chips: ['⬆️ Lv.1 → Lv.3', '✨ 스킬 포인트 +2', '🌟 도장 +1'],
  })
})

test('자리 비운 동안 카드: 레벨·도장이 그대로면 칩 없음, 하루 넘게 비우면 N일', () => {
  const c = awayCard(away({ awayMs: (2 * 1440 + 3 * 60 + 20) * 60_000, levelAfter: 1, stampsAfter: 0 }))
  expect(c.title).toBe('🌙 자리 비운 동안 · 2일 3시간')
  expect(c.chips).toEqual([])
  expect(awayCard(away({ awayMs: 1440 * 60_000 })).title).toBe('🌙 자리 비운 동안 · 1일')
  expect(awayCard(away({ awayMs: 11 * 60_000 + 59_000 })).title).toBe('🌙 자리 비운 동안 · 11분')
})

test('자리 비운 동안 카드의 모험 안내: 이길 만한 스테이지 수, 없으면 다음 스테이지까지 운동 N분', () => {
  // 버튼 두 개 옆에 들어가게 짧게 쓴다
  expect(awayAdventure(1, 0)).toBe('🍀 이길 만한 곳 1개')
  expect(awayAdventure(3, 0)).toBe('🍀 이길 만한 곳 3개')
  expect(awayAdventure(WINNABLE_MAX, 0)).toBe(`🍀 이길 만한 곳 ${WINNABLE_MAX}개 이상`)
  expect(awayAdventure(0, 70)).toBe('💪 다음 스테이지까지 운동 1시간 10분 더')
  expect(awayAdventure(0, null)).toBe('💪 운동으로 더 키워서 와요')
})

test('자동 진행 결과 카드: 깬 만큼·얻은 모자·멈춘 곳의 운동 N분 더', () => {
  const hat: Cosmetic = { id: 'chapter-hat-1', icon: '🎩', name: '말랑 나라 모자', kind: 'hat' }
  expect(autoRunCard({ from: 3, to: 8, stoppedAt: 9, rewards: [] }, 90)).toEqual({
    win: true,
    title: '🏁 자동 진행 끝!',
    detail: '3 → 8스테이지까지 깼어요',
    note: '💪 다음은 운동 1시간 30분 더 하면 이길 만해요',
    reward: null,
  })
  // 처음부터 깨면 "N스테이지까지", 모자를 얻으면 보상 줄을 붙인다
  expect(autoRunCard({ from: 0, to: 10, stoppedAt: null, rewards: [hat] }, null)).toMatchObject({
    detail: '10스테이지까지 깼어요',
    note: `⏩ ${AUTO_RUN_MAX}판 다 이겼어요!`,
    reward: '🎁 새 꾸미기 · 🎩 말랑 나라 모자',
  })
  // 여러 개면 아이콘만 늘어놓는다
  const bow: Cosmetic = { id: 'hat-bow', icon: '🎀', name: '노을 리본', kind: 'hat' }
  expect(autoRunCard({ from: 3, to: 10, stoppedAt: null, rewards: [bow, hat] }, null).reward).toBe('🎁 새 꾸미기 2개 · 🎀 🎩')
  // 한 판도 못 깨면 아쉬워요
  expect(autoRunCard({ from: 4, to: 4, stoppedAt: 5, rewards: [] }, 0)).toMatchObject({
    win: false,
    title: '💧 아쉬워요',
    detail: '5스테이지에서 아쉽게 졌어요',
    note: '🍀 지금도 이길 만해요 · 다시 도전해 봐요',
  })
  expect(autoRunCard({ from: 4, to: 6, stoppedAt: 7, rewards: [] }, null).note).toBe('💪 운동으로 더 키워서 다시 와요')
})

test('내 기록의 이번 주 합계는 지난주와 견준다', () => {
  expect(weekTotalText({ thisWeek: 190, lastWeek: 150, diff: 40 })).toBe('이번 주 3시간 10분 · 지난주보다 +40분')
  expect(weekTotalText({ thisWeek: 60, lastWeek: 60, diff: 0 })).toBe('이번 주 1시간 · 지난주와 같아요')
  expect(weekTotalText({ thisWeek: 20, lastWeek: 90, diff: -70 })).toBe('이번 주 20분 · 지난주까지 1시간 10분 더')
  // 지난주가 비었으면 견주지 않는다
  expect(weekTotalText({ thisWeek: 45, lastWeek: 0, diff: 45 })).toBe('이번 주 45분')
})

test('가장 많이 한 날은 월·일과 시간', () => {
  expect(bestDayText({ key: '2026-10-21', minutes: 130 })).toBe('🏆 가장 많이 한 날 · 10월 21일 2시간 10분')
})

const day = (over: object) => ({
  key: '2026-10-21',
  weekday: 3,
  today: false,
  stamped: false,
  minutes: { exercise: 0, study: 0, reading: 0, relax: 0 },
  total: 0,
  ...over,
})

test('막대를 누르면 그날 활동별 분과 도장', () => {
  expect(
    dayDetail(day({ stamped: true, minutes: { exercise: 60, study: 0, reading: 50, relax: 20 }, total: 130 })),
  ).toEqual({ title: '10월 21일 수요일 · 2시간 10분', parts: ['운동 1시간', '독서 50분', '휴식 20분'], stamp: '🌟 도장 찍은 날' })
  expect(dayDetail(day({ minutes: { exercise: 0, study: 15, reading: 0, relax: 0 }, total: 15 })).stamp).toBe('도장은 30분부터')
  expect(dayDetail(day({ today: true, minutes: { exercise: 0, study: 12, reading: 0, relax: 0 }, total: 12 }))).toEqual({
    title: '오늘 10월 21일 · 12분',
    parts: ['공부 12분'],
    stamp: '🎯 도장까지 18분 더',
  })
  expect(dayDetail(day({}))).toEqual({ title: '10월 21일 수요일 · 0분', parts: [], stamp: '😴 쉬어 간 날' })
  expect(dayDetail(day({ today: true })).stamp).toBe('🎯 도장까지 30분 더')
})

test('넘겨 보는 7일 쪽 이름', () => {
  expect(pageRangeText(['2026-10-19', '2026-10-25'], 0)).toBe('최근 7일')
  expect(pageRangeText(['2026-10-12', '2026-10-18'], 1)).toBe('10월 12일 ~ 18일')
  expect(pageRangeText(['2026-09-28', '2026-10-04'], 4)).toBe('9월 28일 ~ 10월 4일')
})

test('도감 그림자 칸 글자', () => {
  expect(dexShadowText(0)).toBe('🍀 지금 만나요')
  expect(dexShadowText(45)).toBe('운동 45분 더')
  expect(dexShadowText(130)).toBe('운동 2시간 10분 더')
  expect(dexShadowText(null)).toBe('더 키워서 만나요')
})

test('결과 카드 새 몬스터 알림 글자', () => {
  expect(dexNewText(0)).toBeNull()
  expect(dexNewText(1)).toBe('📚 도감에 새 몬스터 +1')
  expect(dexNewText(3)).toBe('📚 도감에 새 몬스터 +3')
})

test('홈의 오늘의 미션 칩은 활동과 분, 채우면 완료', () => {
  expect(missionChip({ activity: 'reading', goal: 15, minutes: 5, done: false })).toBe('📜 독서 5 / 15분')
  expect(missionChip({ activity: 'relax', goal: 10, minutes: 12, done: true })).toBe('📜 휴식 완료!')
})

test('업적 진행 글자: 활동 시간은 시간(한 시간 전엔 분), 나머지는 개·일·가지, 목표를 넘어도 목표에서 멈춘다', () => {
  const a = (id: string, value: number) => ({ ...ACHIEVEMENTS.find((x) => x.id === id)!, value, done: false })
  expect(achievementValueText(a('exercise-10', 7 * 60 + 30))).toBe('운동 7 / 10시간')
  expect(achievementValueText(a('reading-1', 42))).toBe('독서 42분 / 1시간')
  expect(achievementValueText(a('study-10', 0))).toBe('공부 0 / 10시간')
  expect(achievementValueText(a('exercise-1', 500))).toBe('운동 1 / 1시간')
  expect(achievementValueText(a('stamps-10', 7))).toBe('도장 7 / 10개')
  expect(achievementValueText(a('streak-7', 9))).toBe('가장 길게 7 / 7일')
  expect(achievementValueText(a('variety-4', 2))).toBe('해 본 활동 2 / 4가지')
})

test('먼 업적: 같은 줄(활동·종류)에서 아직 못 닿은 첫 업적 뒤의 것만 흐리게', () => {
  const list = achievementProgress([])
  const far = farAchievementIds(list)
  expect(far.has('exercise-1')).toBe(false)
  expect(far.has('exercise-10')).toBe(true)
  expect(far.has('stamps-10')).toBe(false)
  expect(far.has('stamps-50')).toBe(true)
  expect(far.has('variety-4')).toBe(false)
  const done = list.map((x) => (x.id === 'exercise-1' ? { ...x, done: true } : x))
  const far2 = farAchievementIds(done)
  expect(far2.has('exercise-1')).toBe(false)
  expect(far2.has('exercise-10')).toBe(false)
  expect(far2.has('exercise-50')).toBe(true)
})

test('업적 달성 알림: 하나면 업적 이름과 칭호, 여럿이면 묶어서 하나만', () => {
  expect(achievementToast(['exercise-1'])).toEqual({ title: '🏆 업적 달성!', detail: '운동 1시간 · 🏅 땀방울 새싹' })
  expect(achievementToast(['exercise-1', 'study-1', 'stamps-10'])).toEqual({
    title: '🏆 업적 3개 달성!',
    detail: '🏅 땀방울 새싹 외 칭호 2개',
  })
  expect(achievementToast(['nope'])).toBeNull()
  expect(achievementToast([])).toBeNull()
})

test('집중 목표 진행 글자: 지난 분·남은 분, 닿으면 채웠다고', () => {
  expect(focusText({ target: 25, elapsedMinutes: 12, remainingMinutes: 13, ratio: 0.5, reached: false })).toBe('🎯 25분 중 12분 · 13분 남음')
  expect(focusText({ target: 25, elapsedMinutes: 25, remainingMinutes: 0, ratio: 1, reached: true })).toBe('⏰ 목표 25분 채웠어요 · 25분째')
  expect(focusText({ target: 60, elapsedMinutes: 72, remainingMinutes: 0, ratio: 1, reached: true })).toBe('⏰ 목표 60분 채웠어요 · 1시간 12분째')
})

test('집중 목표 칩 글자는 없음 또는 N분', () => {
  expect(focusChipLabel(0)).toBe('없음')
  expect(focusChipLabel(25)).toBe('25분')
})

test('집중 목표 달성 배지 글자', () => {
  expect(focusDoneText(25)).toBe('⏰ 목표 25분 채웠어요!')
  expect(focusDoneText(60)).toBe('⏰ 목표 60분 채웠어요!')
})

const letter = (over: object = {}) => ({
  week: '2026-10-19',
  total: 250,
  prevTotal: 210,
  diff: 40,
  stamped: 5,
  goal: 5,
  goalDone: true,
  minutes: { exercise: 150, study: 60, reading: 0, relax: 40 },
  top: 'exercise' as const,
  best: { key: '2026-10-21', minutes: 90 },
  suggest: 'reading' as const,
  suggestText: '이번 주엔 📚 독서도 해 볼까?',
  ...over,
})

test('지난주 편지 카드: 합계와 지난번 차이, 도장, 가장 많이 한 활동·날, 권하는 한 줄', () => {
  expect(letterCard(letter())).toEqual({
    title: '💌 지난주 편지',
    total: '지난주 4시간 10분 했어! · 지난번보다 +40분',
    chips: ['🏅 도장 5일 · 목표 달성', '🏃 운동 2시간 30분', '📆 수요일 1시간 30분'],
    suggest: '이번 주엔 📚 독서도 해 볼까?',
  })
})

test('지난주 편지 카드: 그 전 주가 비면 견주지 않고, 줄었으면 나무라지 않음', () => {
  expect(letterCard(letter({ prevTotal: 0, diff: 250 })).total).toBe('지난주 4시간 10분 했어!')
  expect(letterCard(letter({ prevTotal: 250, diff: 0 })).total).toBe('지난주 4시간 10분 했어! · 지난번과 똑같아')
  expect(letterCard(letter({ prevTotal: 300, diff: -50 })).total).toBe('지난주 4시간 10분 했어! · 수고했어')
  expect(letterCard(letter({ stamped: 2, goalDone: false })).chips[0]).toBe('🌟 도장 2 / 5일')
})

test('최고 기록 갱신 배지는 하루 → 주 → 활동 한 번 → 이어 온 날 순으로 하나만 알려 줌', () => {
  const v = { session: { exercise: 50, study: 40, reading: 0, relax: 0 }, day: 95, week: 300, streak: 12 }
  expect(bestBrokenText(['exercise', 'day', 'week'], v)).toBe('🥇 최고 기록 갱신! · 하루 1시간 35분')
  expect(bestBrokenText(['study', 'week', 'streak'], v)).toBe('🥇 최고 기록 갱신! · 한 주 5시간')
  expect(bestBrokenText(['streak', 'study'], v)).toBe('🥇 최고 기록 갱신! · 공부 한 번 40분')
  expect(bestBrokenText(['streak'], v)).toBe('🥇 최고 기록 갱신! · 12일 이어 옴')
  expect(bestBrokenText([], v)).toBe('🥇 최고 기록 갱신!')
})

test('새 소품 배지는 이름, 여럿이면 외 N개', () => {
  const c = (name: string) => ({ id: name, name, icon: '✏️', kind: 'prop' }) as Cosmetic
  expect(newPropText([])).toBeNull()
  expect(newPropText([c('연필꽂이')])).toBe('🎁 새 소품: 연필꽂이')
  expect(newPropText([c('연필꽂이'), c('찻잔'), c('아령')])).toBe('🎁 새 소품: 연필꽂이 외 2개')
})
