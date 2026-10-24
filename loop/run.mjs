// 루프 실행기: claude -p 를 한 바퀴씩 반복 실행한다.
// 사용법: npm run loop | npm run loop:once | node loop/run.mjs --cleanup-only
// 멈춤: 저장소 루트에 STOP 파일을 만든다.
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideNext, parseRateLimit, shouldPush } from './lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOGS = join(ROOT, 'loop', 'logs')
const STOP = join(ROOT, 'STOP')
const IDLE = join(ROOT, 'loop', 'IDLE')
const FEEDBACK = '피드백.md'
const config = JSON.parse(readFileSync(join(ROOT, 'loop', 'config.json'), 'utf8'))
const args = new Set(process.argv.slice(2))

mkdirSync(LOGS, { recursive: true })

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')
const log = (msg) => console.log(`[${new Date().toLocaleString('ko-KR')}] ${msg}`)
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim()

/** prompt 를 stdin 으로 넣고 stream-json 출력을 모은다. 시간 초과면 프로세스를 끝낸다 */
function runClaude({ model, prompt, timeoutMs, logPath, permissionMode }) {
  return new Promise((resolve) => {
    const cli = ['-p', '--model', model, '--output-format', 'stream-json', '--verbose']
    if (permissionMode) cli.push('--permission-mode', permissionMode)
    const child = spawn('claude', cli, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
    const file = logPath ? createWriteStream(logPath) : null
    let text = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    child.stdout.on('data', (d) => {
      text += d
      file?.write(d)
    })
    child.stderr.on('data', (d) => file?.write(d))
    child.on('close', (code) => {
      clearTimeout(timer)
      file?.end()
      resolve({ text, code, timedOut })
    })
    child.stdin.end(prompt)
  })
}

/** 피드백.md 를 뺀 남은 변경을 stash 로 치운다(되살릴 수 있게). reset·clean 은 쓰지 않는다 */
function cleanup() {
  const dirty = git('status', '--porcelain')
    .split('\n')
    .filter((l) => l && !l.slice(3).replace(/"/g, '').endsWith(FEEDBACK))
  if (dirty.length === 0) return false
  git('stash', 'push', '-u', '-m', `loop-leftover-${stamp()}`, '--', '.', `:(exclude)${FEEDBACK}`)
  log(`남은 변경 ${dirty.length}개를 stash 로 치움`)
  return true
}

function check(logPath) {
  const r = spawnSync('npm', ['run', 'check'], { cwd: ROOT, encoding: 'utf8', shell: true })
  appendFileSync(logPath, `\n--- npm run check (exit ${r.status}) ---\n${r.stdout}\n${r.stderr}`)
  return r.status === 0
}

function unpushedCount() {
  try {
    return Number(git('rev-list', '--count', 'origin/main..HEAD'))
  } catch {
    return Number(git('rev-list', '--count', 'HEAD'))
  }
}

function push() {
  try {
    git('push', 'origin', 'main')
    log('원격에 푸시함')
    return true
  } catch (e) {
    log(`푸시 실패: ${e.message.split('\n')[0]}`)
    return false
  }
}

async function sleepUntil(untilMs) {
  while (Date.now() < untilMs && !existsSync(STOP)) await new Promise((r) => setTimeout(r, 60_000))
}

function record(entry) {
  appendFileSync(join(LOGS, 'runs.jsonl'), JSON.stringify(entry) + '\n')
}

async function main() {
  if (args.has('--cleanup-only')) {
    cleanup()
    return
  }

  if (existsSync(STOP)) {
    record({ event: 'stop', at: new Date().toISOString(), reason: 'STOP 파일', iteration: 0 })
    log('멈춤: STOP 파일')
    return
  }
  // 다시 시작했다는 건 할 일이 생겼다는 뜻이다(예: 기획서를 고침)
  if (existsSync(IDLE)) {
    unlinkSync(IDLE)
    log('지난번 "할 일 없음" 표시를 지우고 시작')
  }

  log('사용량 확인 중')
  const probe = await runClaude({ model: 'haiku', prompt: 'OK라고만 답해', timeoutMs: 120_000 })
  let rate = parseRateLimit(probe.text)
  log(`주간 사용률 ${rate ? Math.round(rate.sevenDay.utilization * 100) + '%' : '알 수 없음'}`)

  let iteration = 0
  let consecutiveFailures = 0
  let lastPushMs = null

  for (;;) {
    const decision = decideNext({
      stopFile: existsSync(STOP),
      idleFile: existsSync(IDLE),
      rate,
      iteration,
      maxIterations: args.has('--once') ? 1 : config.maxIterations,
      consecutiveFailures,
      maxConsecutiveFailures: config.maxConsecutiveFailures,
      weeklyStopAt: config.weeklyStopAt,
    })

    if (decision.action === 'stop') {
      if (unpushedCount() > 0) push()
      record({ event: 'stop', at: new Date().toISOString(), reason: decision.reason, iteration })
      log(`멈춤: ${decision.reason}`)
      return
    }
    if (decision.action === 'wait') {
      log(`대기: ${decision.reason}, ${new Date(decision.untilMs).toLocaleString('ko-KR')}까지`)
      await sleepUntil(decision.untilMs)
      rate = null // 다음 바퀴 출력에서 다시 읽는다
      continue
    }

    iteration++
    const startedAt = new Date().toISOString()
    const logPath = join(LOGS, `${stamp()}.jsonl`)
    const prevHead = git('rev-parse', 'HEAD')
    log(`${iteration}바퀴 시작`)

    const out = await runClaude({
      model: config.model,
      prompt: readFileSync(join(ROOT, 'loop', 'PROMPT.md'), 'utf8'),
      timeoutMs: config.iterationTimeoutMinutes * 60_000,
      logPath,
      permissionMode: 'acceptEdits',
    })
    rate = parseRateLimit(out.text) ?? rate

    cleanup()
    const head = git('rev-parse', 'HEAD')
    let result
    if (head !== prevHead) {
      if (check(logPath)) {
        result = 'committed'
        consecutiveFailures = 0
      } else {
        git('revert', '--no-edit', `${prevHead}..HEAD`)
        result = 'check-failed-reverted'
        consecutiveFailures++
      }
    } else if (existsSync(IDLE)) {
      result = 'idle'
    } else {
      result = out.timedOut ? 'timeout' : 'no-commit'
      consecutiveFailures++
    }

    if (unpushedCount() > 0 && shouldPush(lastPushMs, Date.now(), config.pushIntervalMinutes) && push()) lastPushMs = Date.now()

    record({
      iteration,
      startedAt,
      endedAt: new Date().toISOString(),
      prevHead,
      head: git('rev-parse', 'HEAD'),
      result,
      exitCode: out.code,
      fiveHour: rate?.fiveHour ?? null,
      sevenDay: rate?.sevenDay ?? null,
      log: logPath,
    })
    log(`${iteration}바퀴 끝: ${result}`)
  }
}

main().catch((e) => {
  record({ event: 'crash', at: new Date().toISOString(), error: String(e?.stack ?? e) })
  console.error(e)
  process.exit(1)
})
