# 0단계: 게임 뼈대 + 루프 구조 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폰에 설치되는 최소 게임(운동 타이머 → 경험치 → 레벨)과, 그 위에서 Claude Code가 사람 없이 기능을 하나씩 만들어 가는 루프 실행 구조를 만든다.

**Architecture:** 게임 규칙은 Phaser와 분리된 순수 TypeScript(`src/core/`)로 두고 단위 테스트로 고정한다. 화면은 DOM으로 만든 UI(레벨 바, 타이머 카드, 탭)와 Phaser 캔버스(캐릭터·몬스터 장면)를 겹쳐 쓴다. DOM이라서 Playwright가 버튼을 누르고 글자를 확인할 수 있다. 루프는 Node 스크립트(`loop/run.mjs`)가 `claude -p`를 반복 실행하는 구조다. 판단 로직은 `loop/lib.mjs`에 순수 함수로 두고 테스트한다.

**Tech Stack:** Vite, TypeScript, Phaser 3.x, Vitest, Playwright, vite-plugin-pwa, GitHub Actions + GitHub Pages, Node 24, Claude Code CLI 2.1.x

**Spec:** `docs/superpowers/specs/2026-10-24-self-growth-game-loop-design.md`

## Global Constraints

- 작업 위치: `C:\Users\alber\Geon_Project\game_creator`에서 **새 git 저장소**를 시작한다. 원격은 `https://github.com/qkrrjs0811/game_creator`(현재 비공개, 비어 있음)이고 기본 브랜치는 `main`이다. 상위 폴더의 git 기록은 건드리지 않는다.
- 레포는 **공개로 전환**하고 GitHub Pages(GitHub Actions 배포)로 띄운다. 배포 주소는 `https://qkrrjs0811.github.io/game_creator/`이고, Vite `base`는 `'/game_creator/'`이다.
- 화면 크기 기준은 안드로이드 폰 세로(검사 뷰포트 390×844)이다.
- 분위기는 귀여운 캐주얼(둥근 마스코트, 파스텔)이다. 색 기준은 시안 B(`#fff6ec` 배경, `#5a4636` 글자, `#ff8a5b` 강조, `#ffb36b` 경험치 바)다.
- 화면 문구·문서는 한국어로 쓴다. 코드 식별자는 영어로 쓴다.
- **전투는 경험치·능력치를 주지 않는다.** 성장의 유일한 원천은 활동 기록이다.
- 저장 원본은 활동 기록이고, 레벨·능력치는 기록에서 계산한다. 루프는 기존 기록의 레벨·능력치가 내려가는 규칙 변경을 스스로 하지 않는다.
- 루프 모델: `claude-opus-5-5`(설정 한 줄로 변경 가능). 주간 사용률 `0.90` 이상이면 멈춘다. 원격 푸시는 검사를 통과한 커밋만, `60`분에 한 번 이하로 한다.
- 루프는 `--dangerously-skip-permissions`를 쓰지 않는다. 권한은 `.claude/settings.json` 허용 목록으로 묶는다.

## Review Focus

- **자정을 넘긴 세션**(23:00~01:00): 날짜별로 나눠 각 날의 하루 상한을 따로 적용해야 한다 → Task 2 테스트.
- **시계가 뒤로 간 경우**(끝 시각이 시작보다 이름): 음수 분이 생기면 안 되고 0으로 처리한다 → Task 2 테스트.
- **저장 데이터가 깨졌거나 저장소를 쓸 수 없음**: 앱이 죽지 않아야 하고, 깨진 원본은 버리지 말고 다른 키로 보존해야 한다 → Task 3 테스트.
- **세션 중에 앱을 닫았다 다시 엶**: 타이머가 이어서 흐르고 버튼이 "그만하기" 상태여야 한다 → Task 4 e2e.
- **사용자가 `피드백.md`를 쓰는 중에 루프가 실패 정리를 함**: 사용자 글이 사라지면 안 된다. 그래서 루프의 정리 동작은 `피드백.md`를 제외한 stash와 revert만 쓰고 reset이나 clean은 쓰지 않는다 → Task 8 단계에서 확인.

---

## 파일 구조

```
game_creator/
├─ .github/workflows/deploy.yml   # main 푸시 → 빌드 → Pages
├─ .claude/settings.json          # 루프 세션 권한 허용·거부 목록
├─ CLAUDE.md                      # 저장소 규칙(루프 세션이 자동으로 읽음)
├─ 기획서.md  할일.md  진행기록.md  피드백.md
├─ index.html
├─ public/icon.svg (+ 생성된 PNG 아이콘)
├─ src/
│  ├─ core/            # Phaser 없는 순수 규칙
│  │  ├─ types.ts  activities.ts  progression.ts  session.ts  storage.ts
│  │  └─ *.test.ts
│  ├─ ui/hud.ts        # DOM UI 그리기·이벤트
│  ├─ game/HomeScene.ts  # Phaser 장면(마스코트·몬스터)
│  ├─ main.ts          # 시작점: 저장 불러오기 → UI·장면 연결
│  └─ style.css
├─ e2e/home.spec.ts
├─ loop/
│  ├─ PROMPT.md  config.json  lib.mjs  lib.test.mjs  run.mjs
│  └─ logs/  (gitignore)
├─ docs/superpowers/{specs,plans}/
├─ vite.config.ts  vitest.config.ts  playwright.config.ts  tsconfig.json  package.json
```

---

### Task 1: 저장소와 프로젝트 뼈대

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/style.css`, `.gitignore`, `src/core/smoke.test.ts`

**Interfaces:**
- Produces: npm 스크립트 `dev`, `build`(`tsc --noEmit && vite build`), `preview`, `test`(`vitest run`). 이후 Task에서 `check`를 덧붙인다.

- [ ] **Step 1: git 저장소 시작**

```bash
cd /c/Users/alber/Geon_Project/game_creator
git init -b main
git config core.quotepath false
git remote add origin https://github.com/qkrrjs0811/game_creator.git
```
확인: `git rev-parse --show-toplevel`이 `.../game_creator`를 출력한다(상위 폴더가 아님).

- [ ] **Step 2: Vite + TypeScript 프로젝트를 만들고 의존성 설치**

`npm create vite@latest`의 vanilla-ts 템플릿 구성에 맞춰 직접 파일을 만들고 설치한다: `npm i phaser@3` 그리고 `npm i -D typescript vite vitest`. `vite.config.ts`에 `base: '/game_creator/'`를 넣는다. `vitest.config.ts`는 맨 위에서 `process.env.TZ = 'Asia/Seoul'`을 설정하고, `include: ['src/**/*.test.ts', 'loop/**/*.test.mjs']`로 둔다.
`.gitignore`: `node_modules/ dist/ test-results/ playwright-report/ loop/logs/ loop/IDLE STOP .superpowers/`

- [ ] **Step 3: 연기 테스트 작성 후 실행**

```ts
// src/core/smoke.test.ts
import { test, expect } from 'vitest'
test('timezone is KST', () => {
  expect(new Date(Date.parse('2026-10-24T00:30:00+09:00')).getDate()).toBe(24)
})
```
Run: `npm test` → Expected: 1 passed. Run: `npm run build` → Expected: `dist/` 생성, 오류 없음.

- [ ] **Step 4: 커밋 (설계 문서·계획서 포함)**

```bash
git add -A
git commit -m "chore: 프로젝트 뼈대와 설계·계획 문서"
```

---

### Task 2: 성장 규칙 (활동 기록 → 레벨·능력치)

**Files:**
- Create: `src/core/types.ts`, `src/core/activities.ts`, `src/core/progression.ts`
- Test: `src/core/progression.test.ts`
- Delete: `src/core/smoke.test.ts` (KST 확인은 아래 테스트가 대신함)

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type ActivityId = 'exercise'
  export type StatId = 'str' | 'vit' | 'int'
  export interface ActivityRecord { id: string; activity: ActivityId; startedAt: number; endedAt: number } // epoch ms
  export interface ActiveSession { activity: ActivityId; startedAt: number }
  export interface SaveData { version: 1; records: ActivityRecord[]; active: ActiveSession | null; skills: string[]; stageProgress: number; cosmetics: string[] }
  export interface Progress { creditedMinutes: Record<ActivityId, number>; exp: number; level: number; expIntoLevel: number; expForNextLevel: number; stats: Record<StatId, number>; skillPoints: number }
  // activities.ts
  export const ACTIVITIES: Record<ActivityId, { label: string; dailyCapMinutes: number; stats: StatId[] }>
  // progression.ts
  export const EXP_PER_MINUTE = 10
  export const BASE_STAT = 5
  export function expToNext(level: number): number          // 100 + 50 * (level - 1)
  export function creditedMinutes(records: ActivityRecord[], activity: ActivityId): number
  export function computeProgress(records: ActivityRecord[]): Progress
  ```
  값: `ACTIVITIES.exercise = { label: '운동', dailyCapMinutes: 180, stats: ['str', 'vit'] }`. 능력치는 `BASE_STAT + floor(그 능력치에 묶인 활동들의 인정 분 합 / 10)`, `skillPoints = level - 1`(사용한 스킬 포인트 차감은 스킬 도입 때 루프가 추가).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, test, expect } from 'vitest'
import { computeProgress, creditedMinutes, expToNext } from './progression'
const kst = (s: string) => Date.parse(`${s}+09:00`)
const rec = (a: string, b: string, id = a) => ({ id, activity: 'exercise' as const, startedAt: kst(a), endedAt: kst(b) })

describe('progression', () => {
  test('30분 운동 → 경험치 300, 레벨 3', () => {
    const p = computeProgress([rec('2026-10-24T19:00:00', '2026-10-24T19:30:00')])
    expect(p.creditedMinutes.exercise).toBe(30)
    expect(p.exp).toBe(300)
    expect(p.level).toBe(3)
    expect(p.expIntoLevel).toBe(50)
    expect(p.expForNextLevel).toBe(200)
    expect(p.stats).toEqual({ str: 8, vit: 8, int: 5 })
    expect(p.skillPoints).toBe(2)
  })
  test('하루 상한 180분', () => {
    expect(creditedMinutes([rec('2026-10-24T08:00:00', '2026-10-24T12:00:00')], 'exercise')).toBe(180)
  })
  test('같은 날 여러 세션은 합쳐서 상한 적용', () => {
    const rs = [rec('2026-10-24T08:00:00', '2026-10-24T10:00:00', 'a'), rec('2026-10-24T18:00:00', '2026-10-24T20:00:00', 'b')]
    expect(creditedMinutes(rs, 'exercise')).toBe(180)
  })
  test('자정을 넘긴 세션은 날짜별로 나눠 각각 상한', () => {
    expect(creditedMinutes([rec('2026-10-24T22:00:00', '2026-10-25T02:00:00')], 'exercise')).toBe(240)
    expect(creditedMinutes([rec('2026-10-24T23:00:00', '2026-10-25T01:00:00')], 'exercise')).toBe(120)
  })
  test('끝이 시작보다 이르면 0분', () => {
    expect(creditedMinutes([rec('2026-10-24T10:00:00', '2026-10-24T09:00:00')], 'exercise')).toBe(0)
  })
  test('기록 없음 → 레벨 1', () => {
    const p = computeProgress([])
    expect(p).toMatchObject({ exp: 0, level: 1, expIntoLevel: 0, expForNextLevel: 100, skillPoints: 0 })
  })
  test('expToNext', () => { expect([1, 2, 3].map(expToNext)).toEqual([100, 150, 200]) })
})
```

- [ ] **Step 2: 실행해서 실패 확인** — Run: `npx vitest run src/core/progression.test.ts` → Expected: FAIL (모듈 없음)

- [ ] **Step 3: `types.ts`, `activities.ts`, `progression.ts` 구현**

`creditedMinutes`: 기록마다 `max(startedAt, endedAt)`로 끝을 보정한 뒤 로컬 자정 경계로 잘라 날짜 키(`YYYY-MM-DD`)별 ms를 합산한다. 날짜마다 `min(floor(ms / 60000), dailyCapMinutes)`을 구해 모두 더한다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run` → Expected: 전부 PASS

- [ ] **Step 5: 커밋** — `git add -A src/core && git commit -m "feat(core): 활동 기록에서 레벨·능력치 계산, 하루 상한"`

---

### Task 3: 타이머 세션과 저장

**Files:**
- Create: `src/core/session.ts`, `src/core/storage.ts`
- Test: `src/core/session.test.ts`, `src/core/storage.test.ts`

**Interfaces:**
- Consumes: Task 2의 `SaveData`, `ActivityRecord`, `computeProgress`
- Produces:
  ```ts
  // session.ts
  export function newSave(): SaveData
  export function startSession(save: SaveData, activity: ActivityId, now: number): SaveData   // 진행 중이면 그대로 반환
  export function stopSession(save: SaveData, now: number): SaveData                          // 진행 중 아니면 그대로 반환
  export function liveRecords(save: SaveData, now: number): ActivityRecord[]                   // 진행 중 세션을 now까지의 가상 기록으로 포함
  // storage.ts
  export const SAVE_KEY = 'growth-game:save'
  export type KV = Pick<Storage, 'getItem' | 'setItem'>
  export function loadSave(kv: KV, now: number): SaveData
  export function writeSave(kv: KV, save: SaveData): boolean   // 실패해도 throw 하지 않고 false
  ```
  모든 함수는 입력을 바꾸지 않고 새 객체를 돌려준다. 기록 `id`는 `${activity}-${startedAt}`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// session.test.ts
import { test, expect } from 'vitest'
import { newSave, startSession, stopSession, liveRecords } from './session'
test('시작 → 정지하면 기록 1개, active 비움', () => {
  const s = stopSession(startSession(newSave(), 'exercise', 1000), 61_000)
  expect(s.active).toBeNull()
  expect(s.records).toEqual([{ id: 'exercise-1000', activity: 'exercise', startedAt: 1000, endedAt: 61_000 }])
})
test('진행 중에 다시 시작해도 시작 시각이 안 바뀜', () => {
  const s1 = startSession(newSave(), 'exercise', 1000)
  expect(startSession(s1, 'exercise', 5000)).toBe(s1)
})
test('진행 중 아닐 때 정지는 변화 없음', () => {
  const s = newSave(); expect(stopSession(s, 5000)).toBe(s)
})
test('liveRecords는 진행 중 세션을 now까지 포함', () => {
  const s = startSession(newSave(), 'exercise', 0)
  expect(liveRecords(s, 600_000)).toEqual([{ id: 'exercise-0', activity: 'exercise', startedAt: 0, endedAt: 600_000 }])
})
```

```ts
// storage.test.ts
import { test, expect } from 'vitest'
import { loadSave, writeSave, SAVE_KEY } from './storage'
import { newSave } from './session'
const mem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
test('저장 후 불러오면 같음', () => {
  const kv = mem(); const s = { ...newSave(), skills: ['a'] }
  expect(writeSave(kv, s)).toBe(true); expect(loadSave(kv, 0)).toEqual(s)
})
test('없으면 새 저장', () => { expect(loadSave(mem(), 0)).toEqual(newSave()) })
test('깨진 데이터는 다른 키로 보존하고 새로 시작', () => {
  const kv = mem(); kv.m.set(SAVE_KEY, '{not json')
  expect(loadSave(kv, 1234)).toEqual(newSave())
  expect(kv.m.get(`${SAVE_KEY}:corrupt:1234`)).toBe('{not json')
})
test('저장소가 예외를 던져도 죽지 않음', () => {
  const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
  expect(loadSave(bad, 0)).toEqual(newSave()); expect(writeSave(bad, newSave())).toBe(false)
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/core` → Expected: FAIL

- [ ] **Step 3: `session.ts`, `storage.ts` 구현** — `loadSave`는 JSON 파싱 후 `version === 1`이고 `records`가 배열인지까지 확인한다. 아니면 깨진 것으로 본다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run` → Expected: 전부 PASS

- [ ] **Step 5: 커밋** — `git add src/core && git commit -m "feat(core): 타이머 세션, 저장·깨진 데이터 보존"`

---

### Task 4: 홈 화면 (DOM UI + Phaser 장면) 과 `npm run check`

**Files:**
- Create: `src/ui/hud.ts`, `src/game/HomeScene.ts`, `e2e/home.spec.ts`, `playwright.config.ts`
- Modify: `src/main.ts`, `src/style.css`, `index.html`, `package.json`

**Interfaces:**
- Consumes: Task 2·3 전부
- Produces:
  - DOM 요소(테스트가 쓰는 이름): `[data-testid=level]` 내용 `Lv.{level}`, `[data-testid=exp-bar]`, `[data-testid=timer]` 내용 `MM:SS` 또는 `H:MM:SS`, `[data-testid=toggle]` 버튼 문구 `운동 시작` / `그만하기`, 탭 `운동`(활성) `공부` `독서` `나`(나머지 셋은 "준비 중" 표시, 누르면 아무 일 없음).
  - `window.__debug = { getSave(): SaveData }` (e2e 확인용)
  - npm 스크립트 `"check": "npm run build && vitest run && playwright test"`
- 화면 배치는 시안 B: 위 레벨·경험치 바 → 가운데 둥근 카드 안 Phaser 캔버스(둥근 마스코트와 보라색 몬스터, 말풍선) → 타이머 카드 → 아래 탭. 마스코트와 몬스터는 Phaser Graphics로 원·둥근 사각형만 써서 그린다. 마스코트는 숨 쉬듯 살짝 위아래로 움직인다(tween).
- 진행 중일 때 UI는 1초마다 `computeProgress(liveRecords(save, Date.now()))`로 다시 그린다. 상태가 바뀔 때마다(시작·정지) 바로 `writeSave`한다.

- [ ] **Step 1: Playwright 설치와 설정**

`npm i -D @playwright/test` 그리고 `npx playwright install chromium`. `playwright.config.ts`: `webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/game_creator/', reuseExistingServer: false }`, `use: { baseURL: 'http://localhost:4173/game_creator/', viewport: { width: 390, height: 844 } }`, `testDir: 'e2e'`.

- [ ] **Step 2: 실패하는 e2e 작성**

```ts
import { test, expect } from '@playwright/test'
test('처음 열면 Lv.1, 콘솔 오류 없음, 스크린샷 저장', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await expect(page.getByTestId('level')).toHaveText('Lv.1')
  await expect(page.getByTestId('toggle')).toHaveText('운동 시작')
  await page.screenshot({ path: 'test-results/screens/home.png' })
  expect(errors).toEqual([])
})
test('30분 운동하면 Lv.3', async ({ page }) => {
  await page.clock.install(); await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('30:00')
  await expect(page.getByTestId('timer')).toHaveText('30:00')
  await page.getByTestId('toggle').click()
  await expect(page.getByTestId('level')).toHaveText('Lv.3')
  await page.screenshot({ path: 'test-results/screens/after-30min.png' })
})
test('세션 중 새로고침해도 이어서 흐름', async ({ page }) => {
  await page.clock.install(); await page.goto('./')
  await page.getByTestId('toggle').click()
  await page.clock.fastForward('10:00'); await page.reload()
  await expect(page.getByTestId('toggle')).toHaveText('그만하기')
  await expect(page.getByTestId('timer')).toHaveText(/^10:0\d$/)
})
```

- [ ] **Step 3: 실패 확인** — Run: `npm run build && npx playwright test` → Expected: FAIL (testid 없음)

- [ ] **Step 4: `hud.ts`, `HomeScene.ts`, `main.ts`, `style.css` 구현**

- [ ] **Step 5: 통과 확인** — Run: `npm run check` → Expected: 단위·e2e 모두 PASS. `test-results/screens/home.png`를 Read로 열어 시안 B와 비슷한지(파스텔 배경, 둥근 마스코트, 타이머 카드, 하단 탭) 눈으로 확인한다.

- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 홈 화면(타이머·레벨·마스코트)과 check 스크립트"`

---

### Task 5: PWA, 배포, 폰 설치

**Files:**
- Create: `public/icon.svg`, `.github/workflows/deploy.yml`
- Modify: `vite.config.ts`, `package.json`, `e2e/home.spec.ts`

**Interfaces:**
- Produces: `https://qkrrjs0811.github.io/game_creator/`에서 열리고 설치되는 앱. 매니페스트 `name: '같이 크는 중'`(임시 이름), `short_name: '같이크기'`, `theme_color: '#ff8a5b'`, `background_color: '#fff6ec'`, `display: 'standalone'`, `orientation: 'portrait'`, `start_url`·`scope`는 `/game_creator/`.

- [ ] **Step 1: 실패하는 e2e 추가**

```ts
test('매니페스트와 서비스워커', async ({ page }) => {
  await page.goto('./')
  const href = await page.locator('link[rel=manifest]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await page.request.get(new URL(href!, page.url()).toString())
  expect((await res.json()).display).toBe('standalone')
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r))).toBe(true)
})
```
Run: `npm run check` → Expected: 새 테스트 FAIL

- [ ] **Step 2: PWA 구현** — `npm i -D vite-plugin-pwa @vite-pwa/assets-generator`. `public/icon.svg`는 파스텔 배경 위의 둥근 마스코트 얼굴로 그린다. `pwa-assets-generator --preset minimal-2023 public/icon.svg`로 PNG를 만들고 npm 스크립트 `icons`로 남긴다. `VitePWA({ registerType: 'autoUpdate', manifest: {위 값}, workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] } })`.

- [ ] **Step 3: 통과 확인** — Run: `npm run check` → Expected: 전부 PASS

- [ ] **Step 4: 배포 워크플로 작성** — `deploy.yml`: `on: push: branches: [main]` + `workflow_dispatch`. 순서는 `actions/checkout@v4` → `actions/setup-node@v4`(node 24, cache npm) → `npm ci` → `npx vitest run` → `npm run build` → `actions/upload-pages-artifact@v3`(path `dist`) → `actions/deploy-pages@v4`. 권한은 `pages: write, id-token: write`, `concurrency: pages`.

- [ ] **Step 5: 레포 공개 전환, Pages 켜기, 푸시**

```bash
git add -A && git commit -m "feat: PWA 설치와 GitHub Pages 배포"
gh repo edit qkrrjs0811/game_creator --visibility public --accept-visibility-change-consequences
git push -u origin main
gh api -X POST repos/qkrrjs0811/game_creator/pages -f build_type=workflow
gh workflow run deploy.yml && gh run watch --exit-status
```
Expected: 워크플로 성공, `curl -s -o /dev/null -w "%{http_code}" https://qkrrjs0811.github.io/game_creator/`이 `200`.

- [ ] **Step 6: 사용자 확인 (사람 체크포인트)** — 사용자에게 폰 크롬에서 위 주소를 열고 메뉴의 "홈 화면에 추가"(또는 "앱 설치")를 눌러 달라고 한다. 아이콘이 생기고, 열어서 운동 시작·그만하기가 되는 걸 사용자가 확인하면 다음으로 넘어간다.

---

### Task 6: 루프가 읽는 문서와 권한

**Files:**
- Create: `CLAUDE.md`, `기획서.md`, `할일.md`, `진행기록.md`, `피드백.md`, `loop/PROMPT.md`, `loop/config.json`, `.claude/settings.json`

**Interfaces:**
- Produces: 아래 파일 내용 규약. Task 8의 `run.mjs`는 `loop/PROMPT.md`를 stdin으로 넘기고, 세션이 할 일이 없을 때 만드는 `loop/IDLE` 파일을 감지한다.

- [ ] **Step 1: `CLAUDE.md` 작성** — 이 저장소의 규칙. 설계 문서의 Global Constraints에서 게임 규칙 불변식(전투로 성장 금지, 레벨이 내려가는 변경 금지, 새 기능은 `기획서.md`에 있는 것만), 검사 명령 `npm run check`, 깨진 상태 커밋 금지, `git push`·`reset`·`clean` 금지, 문서는 한국어로 쓸 것을 담는다. 50줄 이내로 쓴다.

- [ ] **Step 2: `기획서.md` 작성** — 설계 문서 1·3·4·7장을 사용자가 읽고 고칠 수 있는 말투로 옮긴다. 맨 위에 "이 문서는 사용자가 고친다. 루프는 읽기만 한다"를 적는다. M1 기능 목록을 포함한다.

- [ ] **Step 3: `할일.md` 작성** — M1 남은 일을 한 바퀴 크기로 쪼갠 체크리스트. 위에서부터 순서대로: 백업 내보내기·가져오기 → 하루 상한 도달 안내 → 레벨업 연출 → 스킬 포인트와 스킬 선택 화면(스킬 3종) → 스테이지 선택 화면 → 자동 전투 계산(순수 함수, 능력치·스킬 반영) → 전투 장면 연출 → 몬스터 5종 + 보스 1종 → 승패 결과와 다음 스테이지 열기 → 꾸미기 보상과 꾸미기 화면 → 오프라인 동작 확인.

- [ ] **Step 4: `진행기록.md`, `피드백.md` 작성** — `진행기록.md`는 맨 위에 "최신 기록이 위로" 규칙과 0단계 완료 기록 한 건을 둔다. `피드백.md`는 `## 새 피드백`(비어 있음, 쓰는 법 한 줄 안내)과 `## 처리됨` 두 칸으로 만든다.

- [ ] **Step 5: `loop/PROMPT.md` 작성** — 한 바퀴의 절차를 순서대로 지시한다.
  1. `피드백.md`의 "새 피드백"이 있으면 문장을 고치지 말고 그대로 `할일.md` 맨 위로 옮기고, `피드백.md`에서는 "처리됨" 아래로 내린다(날짜 표시).
  2. `진행기록.md` 최근 기록 → `할일.md` → `기획서.md` 순으로 읽는다.
  3. 할 일 **하나**를 고른다. 너무 크면 쪼개서 `할일.md`에 넣고 첫 조각만 한다.
  4. 규칙은 테스트부터 작성한다. 구현한다. `npm run check`를 돌린다. 화면이 바뀌었으면 `test-results/screens/*.png`를 Read로 직접 보고 시안 분위기에 맞는지, 겹치거나 잘린 곳이 없는지 확인한다. 필요하면 e2e에 스크린샷을 추가한다.
  5. 통과하면 `할일.md` 체크와 `진행기록.md` 기록을 같이 커밋한다. 커밋 메시지는 한국어로 쓴다. 3번 고쳐도 통과하지 않으면 변경을 `git restore`로 되돌리고(`피드백.md` 제외), 막힌 이유만 `진행기록.md`에 커밋한다.
  6. `할일.md`가 비고 새 피드백도 없으면, 기획서 범위 안의 다듬기(버그·연출·검사 보강)를 하나 한다. 그것도 없으면 `진행기록.md`에 "할 일이 없어 멈췄음"과 제안 아이디어를 적어 커밋하고 `loop/IDLE` 파일을 만든 뒤 끝낸다.
  7. 한 바퀴에서 할 일은 하나뿐이다. 끝나면 바로 종료한다.

- [ ] **Step 6: `loop/config.json`과 `.claude/settings.json` 작성**

```json
{ "model": "claude-opus-5-5", "weeklyStopAt": 0.9, "pushIntervalMinutes": 60, "iterationTimeoutMinutes": 60, "maxIterations": null, "maxConsecutiveFailures": 3 }
```
`.claude/settings.json`의 `permissions.allow`: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash(npm run *)`, `Bash(npm install *)`, `Bash(npm i *)`, `Bash(npx vitest *)`, `Bash(npx playwright test*)`, `Bash(npx tsc *)`, `Bash(git status*)`, `Bash(git diff*)`, `Bash(git log*)`, `Bash(git show*)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(git restore *)`, `Bash(ls *)`. `permissions.deny`: `Bash(git push*)`, `Bash(git reset*)`, `Bash(git clean*)`, `Bash(git checkout*)`, `Bash(rm -rf*)`, `Bash(curl *)`, `WebFetch`.

- [ ] **Step 7: 커밋** — `git add -A && git commit -m "docs: 루프용 기획서·할일·진행기록·피드백, 지시문, 권한"`

---

### Task 7: 루프 판단 로직 (`loop/lib.mjs`)

**Files:**
- Create: `loop/lib.mjs`
- Test: `loop/lib.test.mjs`

**Interfaces:**
- Produces:
  ```js
  // RateInfo = { fiveHour: { utilization: number, resetsAt: number /*epoch s*/, status: string }, sevenDay: { ...같음 } }
  export function parseRateLimit(streamJsonText) // → RateInfo | null  (마지막 type:"rate_limit_event"의 rate_limit_info.unifiedWindows 사용)
  export function decideNext(s) // s = { stopFile, idleFile, rate, iteration, maxIterations, consecutiveFailures, maxConsecutiveFailures, weeklyStopAt }
                                // → { action: 'run' } | { action: 'wait', untilMs, reason } | { action: 'stop', reason }
  export function shouldPush(lastPushMs, nowMs, intervalMinutes) // → boolean, lastPushMs가 null이면 true
  ```
  `decideNext` 판단 순서(먼저 맞는 것으로 결정): STOP 파일 → stop `'STOP 파일'` / IDLE 파일 → stop `'할 일 없음'` / `maxIterations`에 도달 → stop `'최대 바퀴'` / 연속 실패가 상한에 도달 → stop `'연속 실패'` / `sevenDay.utilization >= weeklyStopAt` 또는 `sevenDay.status === 'rejected'` → stop `'주간 사용량'` / `fiveHour.status === 'rejected'` → wait, `untilMs = fiveHour.resetsAt*1000 + 60000`, reason `'5시간 한도'` / 그 밖 → run. `rate`가 null이면 사용량 조건은 건너뛴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { test, expect } from 'vitest'
import { parseRateLimit, decideNext, shouldPush } from './lib.mjs'
const ev = (fu, fs, su, ss) => JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: {
  five_hour: { utilization: fu, resetsAt: 1000, status: fs }, seven_day: { utilization: su, resetsAt: 2000, status: ss } } } })
const base = { stopFile: false, idleFile: false, rate: null, iteration: 0, maxIterations: null, consecutiveFailures: 0, maxConsecutiveFailures: 3, weeklyStopAt: 0.9 }

test('parseRateLimit: 마지막 이벤트 사용, 다른 줄 무시', () => {
  const text = ['{"type":"system"}', ev(0.1, 'allowed', 0.2, 'allowed'), 'not json', ev(0.3, 'allowed', 0.5, 'allowed')].join('\n')
  expect(parseRateLimit(text)).toEqual({ fiveHour: { utilization: 0.3, resetsAt: 1000, status: 'allowed' }, sevenDay: { utilization: 0.5, resetsAt: 2000, status: 'allowed' } })
  expect(parseRateLimit('{"type":"result"}')).toBeNull()
})
test('decideNext 순서', () => {
  const r = (fu, fs, su, ss) => parseRateLimit(ev(fu, fs, su, ss))
  expect(decideNext({ ...base, stopFile: true, idleFile: true })).toEqual({ action: 'stop', reason: 'STOP 파일' })
  expect(decideNext({ ...base, idleFile: true })).toEqual({ action: 'stop', reason: '할 일 없음' })
  expect(decideNext({ ...base, iteration: 5, maxIterations: 5 })).toEqual({ action: 'stop', reason: '최대 바퀴' })
  expect(decideNext({ ...base, consecutiveFailures: 3 })).toEqual({ action: 'stop', reason: '연속 실패' })
  expect(decideNext({ ...base, rate: r(0.1, 'allowed', 0.9, 'allowed') })).toEqual({ action: 'stop', reason: '주간 사용량' })
  expect(decideNext({ ...base, rate: r(1, 'rejected', 0.5, 'allowed') })).toEqual({ action: 'wait', untilMs: 1_060_000, reason: '5시간 한도' })
  expect(decideNext({ ...base, rate: r(0.5, 'allowed', 0.89, 'allowed') })).toEqual({ action: 'run' })
  expect(decideNext(base)).toEqual({ action: 'run' })
})
test('shouldPush', () => {
  expect(shouldPush(null, 0, 60)).toBe(true)
  expect(shouldPush(0, 59 * 60_000, 60)).toBe(false)
  expect(shouldPush(0, 60 * 60_000, 60)).toBe(true)
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run loop` → Expected: FAIL
- [ ] **Step 3: `lib.mjs` 구현**
- [ ] **Step 4: 통과 확인** — Run: `npx vitest run` → Expected: 전부 PASS
- [ ] **Step 5: 커밋** — `git add loop && git commit -m "feat(loop): 사용량·멈춤·푸시 판단 로직"`

---

### Task 8: 루프 실행기 (`loop/run.mjs`) 와 첫 시험 운행

**Files:**
- Create: `loop/run.mjs`
- Modify: `package.json` (스크립트 `"loop": "node loop/run.mjs"`, `"loop:once": "node loop/run.mjs --once"`)

**Interfaces:**
- Consumes: Task 7의 `parseRateLimit`, `decideNext`, `shouldPush`. Task 6의 `loop/config.json`, `loop/PROMPT.md`, `loop/IDLE`, 저장소 루트의 `STOP`.
- Produces: `loop/logs/runs.jsonl`(바퀴마다 한 줄: `{ iteration, startedAt, endedAt, prevHead, head, result, reason, fiveHour, sevenDay }`), `loop/logs/<ISO시각>.jsonl`(세션 원본 출력).

- [ ] **Step 1: `claude` 실행 파일 확인** — Run: `where claude`. 결과가 `.exe`면 `spawn('claude', …)`, `.cmd`면 `spawn(..., { shell: true })`를 쓴다. 프롬프트는 인자가 아니라 **stdin으로** 넘긴다(긴 한국어 문자열이 셸에서 깨지지 않게).

- [ ] **Step 2: `run.mjs` 구현** — 흐름:
  1. 시작할 때 `claude -p --model haiku --output-format stream-json --verbose`에 "OK라고만 답해"를 넣어 사용량을 한 번 읽는다(`parseRateLimit`).
  2. 반복: `decideNext` → `stop`이면 미푸시 커밋이 있을 때 푸시하고, 기록 남기고 종료. `wait`이면 `untilMs`까지 잔다(1분마다 STOP 확인). `run`이면 다음 단계.
  3. `prevHead = git rev-parse HEAD`. `claude -p --model <config.model> --output-format stream-json --verbose --permission-mode acceptEdits`를 실행하고 `PROMPT.md`를 stdin으로 넣는다. 출력은 로그 파일에 그대로 쓰고, `iterationTimeoutMinutes`가 지나면 종료시킨다. 출력에서 `parseRateLimit`로 사용량을 갱신한다.
  4. 정리: `git status --porcelain`에 `피드백.md` 외의 변경이 남았으면 `git stash push -u -m "loop-leftover-<시각>" -- . ":(exclude)피드백.md"`(되살릴 수 있게 stash만, reset·clean 금지).
  5. HEAD가 바뀌었으면 `npm run check`를 다시 돌린다. 실패하면 `git revert --no-edit <prevHead>..HEAD`로 되돌리고 실패로 센다. 성공하면 연속 실패를 0으로 만든다. HEAD가 그대로이고 IDLE도 없으면 실패로 센다.
  6. `shouldPush`가 참이고 미푸시 커밋이 있으면 `git push origin main`.
  7. `runs.jsonl`에 한 줄 남긴다. `--once`면 여기서 종료한다.

- [ ] **Step 3: 안전장치 수동 확인**
  - `STOP` 파일을 만든 뒤 `npm run loop` → Expected: 즉시 `'STOP 파일'`로 종료, `runs.jsonl`에 기록. 확인 후 `STOP` 삭제.
  - `run.mjs`에 정리 단계만 실행하는 `--cleanup-only` 옵션을 둔다. `피드백.md`에 한 줄을 추가해 저장하고(커밋하지 않음) `src/style.css`에 주석 한 줄을 남긴 상태에서 `node loop/run.mjs --cleanup-only` → Expected: `style.css` 변경은 `git stash list`에 `loop-leftover-…`로 들어가고, `피드백.md` 변경은 작업 폴더에 그대로 남는다. 확인 후 stash를 `git stash drop`으로 지우고 `피드백.md` 추가 줄을 지운다.

- [ ] **Step 4: 첫 시험 운행 (사람이 지켜보는 상태)** — `npm run loop:once`. Expected: 세션 하나가 `할일.md` 맨 위(백업 내보내기·가져오기)를 처리해 커밋 1개 이상을 만들고, `npm run check`가 통과하고, 푸시되어 Pages 배포가 성공하고, `runs.jsonl`에 `sevenDay` 사용률이 찍힌다. 결과와 사용량 변화를 사용자에게 보여 준다.

- [ ] **Step 5: 커밋과 사용자 안내** — `git add -A && git commit -m "feat(loop): 루프 실행기"` 후 푸시한다. 사용자에게 운영법을 짧게 안내한다: 시작은 `npm run loop`, 멈춤은 `STOP` 파일, 아침 확인은 `진행기록.md`와 `loop/logs/runs.jsonl`, 피드백은 `피드백.md`.
