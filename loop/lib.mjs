// 루프 실행기의 판단 로직. 부작용 없는 순수 함수만 둔다.

const window = (w) => ({ utilization: w.utilization, resetsAt: w.resetsAt, status: w.status })

/** claude -p stream-json 출력에서 마지막 rate_limit_event 의 사용량을 읽는다 */
export function parseRateLimit(streamJsonText) {
  let found = null
  for (const line of streamJsonText.split('\n')) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    const w = msg?.type === 'rate_limit_event' ? msg.rate_limit_info?.unifiedWindows : null
    if (w?.five_hour && w?.seven_day) found = { fiveHour: window(w.five_hour), sevenDay: window(w.seven_day) }
  }
  return found
}

/** 다음 바퀴를 돌릴지, 기다릴지, 멈출지. 먼저 맞는 조건으로 정한다 */
export function decideNext(s) {
  if (s.stopFile) return { action: 'stop', reason: 'STOP 파일' }
  if (s.idleFile) return { action: 'stop', reason: '할 일 없음' }
  if (s.maxIterations != null && s.iteration >= s.maxIterations) return { action: 'stop', reason: '최대 바퀴' }
  if (s.consecutiveFailures >= s.maxConsecutiveFailures) return { action: 'stop', reason: '연속 실패' }
  if (s.rate) {
    const { fiveHour, sevenDay } = s.rate
    if (sevenDay.utilization >= s.weeklyStopAt || sevenDay.status === 'rejected') return { action: 'stop', reason: '주간 사용량' }
    if (fiveHour.status === 'rejected') return { action: 'wait', untilMs: fiveHour.resetsAt * 1000 + 60_000, reason: '5시간 한도' }
  }
  return { action: 'run' }
}

export function shouldPush(lastPushMs, nowMs, intervalMinutes) {
  return lastPushMs == null || nowMs - lastPushMs >= intervalMinutes * 60_000
}
