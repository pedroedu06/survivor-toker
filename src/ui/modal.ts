import { button, el } from './dom'

export type TextModalOptions = {
  title: string
  hint?: string
  text?: string
  /** true = user types/pastes into it. */
  editable?: boolean
  actionLabel?: string
  onAction?(text: string): void
}

export type TextModal = {
  open(options: TextModalOptions): void
  close(): void
}

/** Modal with a big textarea: used to show a run to copy, or to paste one. */
export function createTextModal(parent: HTMLElement, closeLabel: string): TextModal {
  const overlay = el('div', 'modal', parent)
  const card = el('div', 'modal-card', overlay)
  const title = el('h2', 'modal-title', card)
  const hint = el('p', 'modal-hint', card)
  const area = el('textarea', 'modal-text', card)
  area.spellcheck = false
  const row = el('div', 'hud-row modal-row', card)
  const action = button('hud-button', row, '', () => current?.onAction?.(area.value))
  button('hud-button hud-button--ghost', row, closeLabel, () => close())

  let current: TextModalOptions | null = null

  function close() {
    current = null
    overlay.classList.remove('open')
  }

  return {
    open(options) {
      current = options
      title.textContent = options.title
      hint.textContent = options.hint ?? ''
      area.value = options.text ?? ''
      area.readOnly = !options.editable
      action.hidden = !options.actionLabel
      action.textContent = options.actionLabel ?? ''
      overlay.classList.add('open')
      if (options.editable) area.focus()
      else area.select()
    },
    close,
  }
}

/**
 * Copies text to the clipboard. On plain http (phone over LAN) the Clipboard API does not
 * exist, so it falls back to execCommand. Returns false if both fail (show it in a modal).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  const tmp = document.createElement('textarea')
  tmp.value = text
  tmp.style.position = 'fixed'
  tmp.style.opacity = '0'
  document.body.appendChild(tmp)
  tmp.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  tmp.remove()
  return ok
}
