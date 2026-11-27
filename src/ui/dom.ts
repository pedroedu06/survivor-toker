/** Creates an element with a class and appends it to `parent`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  parent.appendChild(node)
  return node
}

/** Creates a button that calls `onClick`. */
export function button(
  className: string,
  parent: HTMLElement,
  text: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = el('button', className, parent)
  b.type = 'button'
  b.textContent = text
  b.addEventListener('click', onClick)
  return b
}

/** Small gold coin drawn in CSS (placeholder until there is real art). */
export function coinIcon(parent: HTMLElement): HTMLElement {
  const icon = el('span', 'coin-icon', parent)
  icon.setAttribute('aria-hidden', 'true')
  return icon
}

/** Sets text only when it changed (avoids DOM writes every frame). */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}
