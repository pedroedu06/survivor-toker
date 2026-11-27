import { button, el, setText } from '../ui/dom'
import { strings } from '../ui/strings'

const MAX_RECENT = 5

export type ErrorLog = {
  /** Last few distinct problems (JS errors, broken invariants), newest last. Goes into the run text. */
  readonly recent: readonly string[]
  /** Records a problem; shows a red toast when toasts are on (debug). */
  report(message: string): void
  clear(): void
}

/**
 * Catches JS errors and unhandled promise rejections, and receives invariant failures.
 * Always records (so "Copiar run" includes them); the toast only shows in debug.
 */
export function createErrorLog(
  parent: HTMLElement,
  showToasts: boolean,
  onCopyRun: () => void,
): ErrorLog {
  const recent: string[] = []
  const seen = new Set<string>()

  const toast = el('div', 'bug-toast', parent)
  const title = el('strong', '', toast)
  title.textContent = `🐞 ${strings.bugDetected}`
  const text = el('div', 'bug-toast-text', toast)
  const row = el('div', 'hud-row', toast)
  button('hud-button', row, strings.copyRun, () => onCopyRun())
  button('hud-button hud-button--ghost', row, '✕', () => toast.classList.remove('open'))

  const log: ErrorLog = {
    recent,
    report(message) {
      if (seen.has(message)) return
      seen.add(message)
      recent.push(message)
      if (recent.length > MAX_RECENT) recent.shift()
      console.error(`[bug] ${message}`)
      if (showToasts) {
        setText(text, message)
        toast.classList.add('open')
      }
    },
    clear() {
      recent.length = 0
      seen.clear()
      toast.classList.remove('open')
    },
  }

  window.addEventListener('error', (e) => {
    log.report(`JS error: ${e.message} (${e.filename?.split('/').pop() ?? '?'}:${e.lineno})`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    log.report(`Unhandled promise: ${String(e.reason)}`)
  })
  return log
}
