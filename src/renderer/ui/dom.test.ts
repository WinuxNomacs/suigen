// @vitest-environment node
import { describe, expect, it } from 'vitest';

// Minimal element stand-in: h() must set data-* attributes with setAttribute (dataset rejects
// hyphenated names such as "user-scenario").
class FakeEl {
  attrs = new Map<string, string>();
  className = '';
  children: unknown[] = [];
  dataset = new Proxy({}, { set: (_t, k) => { if (String(k).includes('-')) throw new SyntaxError('invalid'); return true; } });
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  append(c: unknown) { this.children.push(c); }
}

describe('h()', () => {
  it('sets hyphenated data attributes', async () => {
    (globalThis as { document?: unknown }).document = { createElement: () => new FakeEl() };
    const { h } = await import('./dom');
    const el = h('div', { class: 'c', 'data-user-scenario': 'x', title: 't' }, 'text') as unknown as FakeEl;
    expect(el.attrs.get('data-user-scenario')).toBe('x');
    expect(el.className).toBe('c');
    expect(el.children).toEqual(['text']);
    delete (globalThis as { document?: unknown }).document;
  });
});
