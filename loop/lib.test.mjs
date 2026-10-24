import { test, expect } from 'vitest'
import { parseRateLimit, decideNext, shouldPush } from './lib.mjs'

const ev = (fu, fs, su, ss) =>
  JSON.stringify({
    type: 'rate_limit_event',
    rate_limit_info: {
      unifiedWindows: {
        five_hour: { utilization: fu, resetsAt: 1000, status: fs },
        seven_day: { utilization: su, resetsAt: 2000, status: ss },
      },
    },
  })
const base = { stopFile: false, idleFile: false, rate: null, iteration: 0, maxIterations: null, consecutiveFailures: 0, maxConsecutiveFailures: 3, weeklyStopAt: 0.9 }

test('parseRateLimit: 마지막 이벤트 사용, 다른 줄 무시', () => {
  const text = ['{"type":"system"}', ev(0.1, 'allowed', 0.2, 'allowed'), 'not json', ev(0.3, 'allowed', 0.5, 'allowed')].join('\n')
  expect(parseRateLimit(text)).toEqual({
    fiveHour: { utilization: 0.3, resetsAt: 1000, status: 'allowed' },
    sevenDay: { utilization: 0.5, resetsAt: 2000, status: 'allowed' },
  })
  expect(parseRateLimit('{"type":"result"}')).toBeNull()
})

test('decideNext 순서', () => {
  const r = (fu, fs, su, ss) => parseRateLimit(ev(fu, fs, su, ss))
  expect(decideNext({ ...base, stopFile: true, idleFile: true })).toEqual({ action: 'stop', reason: 'STOP 파일' })
  expect(decideNext({ ...base, idleFile: true })).toEqual({ action: 'stop', reason: '할 일 없음' })
  expect(decideNext({ ...base, iteration: 5, maxIterations: 5 })).toEqual({ action: 'stop', reason: '최대 바퀴' })
  expect(decideNext({ ...base, consecutiveFailures: 3 })).toEqual({ action: 'stop', reason: '연속 실패' })
  expect(decideNext({ ...base, rate: r(0.1, 'allowed', 0.9, 'allowed') })).toEqual({ action: 'stop', reason: '주간 사용량' })
  expect(decideNext({ ...base, rate: r(0.1, 'allowed', 0.5, 'rejected') })).toEqual({ action: 'stop', reason: '주간 사용량' })
  expect(decideNext({ ...base, rate: r(1, 'rejected', 0.5, 'allowed') })).toEqual({ action: 'wait', untilMs: 1_060_000, reason: '5시간 한도' })
  expect(decideNext({ ...base, rate: r(0.5, 'allowed', 0.89, 'allowed') })).toEqual({ action: 'run' })
  expect(decideNext(base)).toEqual({ action: 'run' })
})

test('shouldPush', () => {
  expect(shouldPush(null, 0, 60)).toBe(true)
  expect(shouldPush(0, 59 * 60_000, 60)).toBe(false)
  expect(shouldPush(0, 60 * 60_000, 60)).toBe(true)
})

import { moveFeedback, leftoverPaths } from './lib.mjs'

const FB = (newItems, done = '') => `# 피드백\n\n> 안내\n\n## 새 피드백\n${newItems}\n## 처리됨\n${done}`

test('moveFeedback: 새 피드백을 원문 그대로 할일 맨 위로, 피드백은 처리됨으로', () => {
  const todo = '# 할 일\n\n> 안내\n\n- [ ] 기존 일\n'
  const r = moveFeedback(FB('- 버튼이 너무 작아\n보스가 너무 세\n\n'), todo, '2026-10-25')
  expect(r.moved).toBe(2)
  expect(r.todo).toBe('# 할 일\n\n> 안내\n\n- [ ] (피드백 2026-10-25) 버튼이 너무 작아\n- [ ] (피드백 2026-10-25) 보스가 너무 세\n- [ ] 기존 일\n')
  expect(r.feedback).toBe('# 피드백\n\n> 안내\n\n## 새 피드백\n\n## 처리됨\n- (2026-10-25) 버튼이 너무 작아\n- (2026-10-25) 보스가 너무 세\n')
})

test('moveFeedback: 새 피드백이 없으면 그대로', () => {
  const fb = FB('\n')
  const r = moveFeedback(fb, '# 할 일\n', '2026-10-25')
  expect(r).toEqual({ moved: 0, feedback: fb, todo: '# 할 일\n' })
})

test('moveFeedback: 할일에 목록이 비어 있으면 끝에 붙임', () => {
  const r = moveFeedback(FB('- 하나\n'), '# 할 일\n\n> 안내\n', '2026-10-25')
  expect(r.todo).toBe('# 할 일\n\n> 안내\n- [ ] (피드백 2026-10-25) 하나\n')
})

test('leftoverPaths: 사용자 파일과 무시할 경로를 뺀 변경만', () => {
  const z = [' M 피드백.md', ' M 기획서.md', ' M src/a.ts', '?? loop/new.txt', 'R  b.ts', 'old.ts', ''].join('\0')
  expect(leftoverPaths(z, ['피드백.md', '기획서.md'])).toEqual(['src/a.ts', 'loop/new.txt', 'b.ts'])
})

test('decideNext: 푸시가 연속으로 실패하면 멈춤', () => {
  expect(decideNext({ ...base, consecutivePushFailures: 3, maxConsecutivePushFailures: 3 })).toEqual({ action: 'stop', reason: '푸시 연속 실패' })
  expect(decideNext({ ...base, consecutivePushFailures: 2, maxConsecutivePushFailures: 3 })).toEqual({ action: 'run' })
})
