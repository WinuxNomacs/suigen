import { describe, expect, it } from 'vitest';
import { MAX_STORED, MyScenarios, buildScenario, parseScenarioText, serializeScenario, textOf } from './userScenarios';
import { MAX_SCENARIO_BYTES } from '../../shared/files';

const scene = { particles: [{ id: 'p', type: 'proton' as const, position: { x: 0, y: 0, z: 0 } }], events: [], extent: 1000 };

class FakeStorage {
  data = new Map<string, string>();
  full = false;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.full) throw new Error('QuotaExceededError'); this.data.set(k, v); }
}

describe('building user scenarios', () => {
  it('needs only a name and a description; empty sections are left out', () => {
    const s = buildScenario(scene, { name: ' Mine ', description: 'Test ', whatsHappening: '  ', science: '' });
    expect(s).toEqual({ name: 'Mine', description: 'Test', particles: scene.particles, events: [], extent: 1000 });
    expect(parseScenarioText(serializeScenario(s))).toMatchObject({ ok: true });
  });

  it('keeps filled sections and science notes, and round-trips through the form', () => {
    const text = { name: 'A', description: 'B', funFact: 'F', science: 'S' };
    const s = buildScenario(scene, text);
    expect(s.layman).toEqual({ title: 'A', summary: 'B', sections: { funFact: 'F' } });
    expect(s.scientific).toEqual({ narrative: 'S', equations: [], constants: [] });
    expect(textOf(s)).toEqual({ name: 'A', description: 'B', funFact: 'F', science: 'S' });
  });
});

describe('opening untrusted text', () => {
  it('reports bad JSON, oversized text, schema and physics problems', () => {
    expect(parseScenarioText('{nope')).toMatchObject({ ok: false, problems: [expect.stringMatching(/^Not valid JSON/)] });
    expect(parseScenarioText(' '.repeat(MAX_SCENARIO_BYTES + 1))).toMatchObject({ ok: false, problems: [expect.stringMatching(/larger than 1 MB/)] });
    expect(parseScenarioText('{"name":"x"}')).toMatchObject({ ok: false });
    const physics = buildScenario(scene, { name: 'x', description: 'y' });
    physics.events = [{ time: 1, action: 'remove', targetId: 'ghost' }];
    expect(parseScenarioText(serializeScenario(physics))).toMatchObject({ ok: false, problems: [expect.stringMatching(/no particle ghost/)] });
  });

  it('rejects script-looking text only by the schema rules, never by running it', () => {
    const s = buildScenario(scene, { name: '<img src=x onerror=alert(1)>', description: 'd' });
    const r = parseScenarioText(serializeScenario(s));
    expect(r).toMatchObject({ ok: true }); // shown with textContent, so it is just text
  });
});

describe('My scenarios storage', () => {
  it('adds newest first, keeps identical text once, caps the list, removes', () => {
    const store = new FakeStorage();
    const my = new MyScenarios(store);
    my.add('a', new Date(1));
    my.add('b', new Date(2));
    my.add('a', new Date(3));
    expect(my.list().map(e => e.text)).toEqual(['a', 'b']);
    for (let i = 0; i < MAX_STORED + 5; i++) my.add(`t${i}`, new Date(10 + i));
    expect(my.list()).toHaveLength(MAX_STORED);
    expect(my.list()[0].text).toBe(`t${MAX_STORED + 4}`);
    my.remove(my.list()[0].id);
    expect(my.list()[0].text).toBe(`t${MAX_STORED + 3}`);
  });

  it('copes with missing or full storage and with garbage in it', () => {
    expect(new MyScenarios(null).add('x')).toMatchObject({ ok: false });
    const full = new FakeStorage();
    full.full = true;
    expect(new MyScenarios(full).add('x')).toMatchObject({ ok: false, message: expect.stringMatching(/full/) });
    const junk = new FakeStorage();
    junk.data.set('suigen.myScenarios', '{"not":"a list"}');
    expect(new MyScenarios(junk).list()).toEqual([]);
    junk.data.set('suigen.myScenarios', '[{"id":1},{"id":"ok","savedAt":"d","text":"t"}]');
    expect(new MyScenarios(junk).list()).toEqual([{ id: 'ok', savedAt: 'd', text: 't' }]);
  });
});
