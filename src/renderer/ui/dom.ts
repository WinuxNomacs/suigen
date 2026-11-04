// DOM builder: text is always set as text, never parsed as HTML (lint rejects innerHTML).

export type Child = Node | string | null | undefined | false;

/** Builds an element. Text is always set as text, never parsed as HTML. */
export function h(tag: string, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('data-')) el.dataset[k.slice(5)] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (c) el.append(c);
  }
  return el;
}
