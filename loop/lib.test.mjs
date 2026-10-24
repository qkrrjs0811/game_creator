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
