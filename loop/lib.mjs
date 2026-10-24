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
  if (s.consecutivePushFailures >= s.maxConsecutivePushFailures) return { action: 'stop', reason: '푸시 연속 실패' }
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

/**
 * 피드백.md 의 "## 새 피드백" 항목을 원문 그대로 할일.md 목록 맨 위로 옮기고,
 * 피드백.md 에서는 "## 처리됨" 맨 위로 내린다. 세션이 아니라 실행기가 결정적으로 한다
 */
export function moveFeedback(feedbackText, todoText, date) {
  const lines = feedbackText.split('\n')
  const start = lines.findIndex((l) => l.trim() === '## 새 피드백')
  const done = lines.findIndex((l) => l.trim() === '## 처리됨')
  if (start < 0 || done < start) return { moved: 0, feedback: feedbackText, todo: todoText }
  const items = lines
    .slice(start + 1, done)
    .map((l) => l.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
  if (items.length === 0) return { moved: 0, feedback: feedbackText, todo: todoText }

  const feedback = [...lines.slice(0, start + 1), '', lines[done], ...items.map((t) => `- (${date}) ${t}`), ...lines.slice(done + 1)].join('\n')

  const todoLines = todoText.split('\n')
  const added = items.map((t) => `- [ ] (피드백 ${date}) ${t}`)
  const first = todoLines.findIndex((l) => l.startsWith('- ['))
  let todo
  if (first >= 0) todo = [...todoLines.slice(0, first), ...added, ...todoLines.slice(first)].join('\n')
  else todo = (todoText.endsWith('\n') ? todoText : todoText + '\n') + added.join('\n') + '\n'
  return { moved: items.length, feedback, todo }
}

/** `git status --porcelain -z` 출력에서 보호할 파일을 뺀 변경 경로 목록 */
export function leftoverPaths(porcelainZ, protectedPaths) {
  const entries = porcelainZ.split('\0')
  const out = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e.length < 4) continue
    const status = e.slice(0, 2)
    const path = e.slice(3)
    if (/[RC]/.test(status)) i++ // 이름 바꾸기는 다음 칸이 원래 이름
    if (!protectedPaths.includes(path)) out.push(path)
  }
  return out
}
