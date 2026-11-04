// DOM builder: text is always set as text, never parsed as HTML (lint rejects innerHTML).

export type Child = Node | string | null | undefined | false;

/** Builds an element. Text is always set as text, never parsed as HTML. */
export function h(tag: string, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v); // includes data-* (dataset would need camelCase names)
  }
  for (const c of children) {
    if (c) el.append(c);
  }
  return el;
}
