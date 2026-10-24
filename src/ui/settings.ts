import { parseBackup } from '../core/backup'
import type { SaveData } from '../core/types'

export interface SettingsHandlers {
  onExport(): void
  /** 가져오기 확인 화면에 보여 줄 한 줄 요약 */
  describe(save: SaveData): string
  /** 지금 기록의 한 줄 요약 */
  describeCurrent(): string
  /** 가져오면 지금보다 덜 자란 상태가 되는지 */
  losesProgress(save: SaveData): boolean
  onImport(save: SaveData): void
}

/** 설정 창: 백업 내려받기와, 파일을 골라 확인 후 되돌리기 */
export function createSettings(root: HTMLElement, h: SettingsHandlers) {
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.hidden = true
  wrap.dataset.testid = 'settings'
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <h2 id="settings-title">설정</h2>
      <section class="sheet-body" data-testid="backup-menu">
        <p class="sheet-desc">기록을 파일로 저장해 두면 폰을 바꾸거나 앱을 지워도 되찾을 수 있어요.</p>
        <button type="button" class="sheet-btn main" data-testid="backup-export">백업 파일 내려받기</button>
        <button type="button" class="sheet-btn" data-testid="backup-import">백업 파일 가져오기</button>
        <input type="file" accept=".json,application/json" hidden data-testid="backup-file" />
        <p class="sheet-msg" data-testid="backup-msg" aria-live="polite"></p>
      </section>
      <section class="sheet-body" data-testid="import-confirm" hidden>
        <p class="confirm-title">이 백업으로 되돌릴까요?</p>
        <p class="confirm-label">가져올 백업</p>
        <p class="confirm-summary" data-testid="import-summary"></p>
        <p class="confirm-label">지금 기록</p>
        <p class="confirm-summary now" data-testid="import-current"></p>
        <p class="confirm-warn" data-testid="import-warning" role="alert" hidden>⚠️ 백업이 지금보다 덜 자랐어요. 되돌리면 그 뒤에 쌓은 기록이 사라져요.</p>
        <p class="sheet-desc">지금 기록은 이 백업 내용으로 바뀌어요.</p>
        <button type="button" class="sheet-btn main" data-testid="import-yes">되돌리기</button>
        <button type="button" class="sheet-btn" data-testid="import-no">취소</button>
      </section>
      <button type="button" class="sheet-close" data-testid="settings-close">닫기</button>
    </div>`
  root.append(wrap)

  const q = <T extends HTMLElement>(id: string) => wrap.querySelector<T>(`[data-testid=${id}]`)!
  const menu = q('backup-menu')
  const confirmBox = q('import-confirm')
  const msg = q('backup-msg')
  const file = q<HTMLInputElement>('backup-file')
  const closeBtn = q('settings-close')
  let pending: SaveData | null = null

  const showMenu = (text = '', bad = false) => {
    pending = null
    menu.hidden = false
    confirmBox.hidden = true
    closeBtn.hidden = false
    msg.textContent = text
    msg.classList.toggle('bad', bad)
  }
  const close = () => {
    wrap.hidden = true
    showMenu()
  }

  q('backup-export').addEventListener('click', () => {
    h.onExport()
    showMenu('백업 파일을 내려받았어요. 잘 보관해 주세요!')
  })
  q('backup-import').addEventListener('click', () => {
    file.value = ''
    file.click()
  })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    if (!f) return
    const r = parseBackup(await f.text())
    if (!r.ok) {
      showMenu('이 파일은 백업 파일이 아니에요. 다른 파일을 골라 주세요.', true)
      return
    }
    pending = r.save
    q('import-summary').textContent = h.describe(r.save)
    q('import-current').textContent = h.describeCurrent()
    q('import-warning').hidden = !h.losesProgress(r.save)
    menu.hidden = true
    confirmBox.hidden = false
    // 확인 중엔 "취소"가 뒤로 가기라, 같은 자리의 "닫기"는 숨김
    closeBtn.hidden = true
  })
  q('import-yes').addEventListener('click', () => {
    if (pending) h.onImport(pending)
    showMenu('백업으로 되돌렸어요.')
  })
  q('import-no').addEventListener('click', () => showMenu())
  closeBtn.addEventListener('click', close)
  wrap.addEventListener('click', (e) => e.target === wrap && close())

  return {
    open() {
      showMenu()
      wrap.hidden = false
    },
  }
}
