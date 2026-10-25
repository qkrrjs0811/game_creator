import { test, expect } from 'vitest'
import { WINNABLE_MAX } from '../core/coach'
import { autoRunCard, awayAdventure, awayCard, formatElapsed, formatMinutes, goalText, objectJosa, sessionSummary, topicJosa } from './format'
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
