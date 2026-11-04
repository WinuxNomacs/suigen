// User-made scenarios: built from the sandbox, checked like the presets, kept in "My scenarios".
import { Scenario } from '../../shared/types';
import { MAX_SCENARIO_BYTES, utf8Bytes } from '../../shared/files';
import { validateScenario, ValidationResult } from './ScenarioLoader';

/** What the user types in the save form. Only name and description are required. */
export interface ScenarioText {
  name: string;
  description: string;
  whatsHappening?: string;
  whyItMatters?: string;
  whatToWatch?: string;
  funFact?: string;
  science?: string;
}

type SceneData = Pick<Scenario, 'particles' | 'events' | 'compressions' | 'extent'>;

const clean = (s?: string) => s?.trim() || undefined;

export function buildScenario(scene: SceneData, text: ScenarioText): Scenario {
  const sections = {
    whatsHappening: clean(text.whatsHappening),
    whyItMatters: clean(text.whyItMatters),
    whatToWatch: clean(text.whatToWatch),
    funFact: clean(text.funFact),
  };
  const filled = Object.fromEntries(Object.entries(sections).filter(([, v]) => v !== undefined));
  const scenario: Scenario = {
    name: text.name.trim(),
    description: text.description.trim(),
    particles: scene.particles,
    events: scene.events,
  };
  if (Object.keys(filled).length > 0) scenario.layman = { title: scenario.name, summary: scenario.description, sections: filled };
  const science = clean(text.science);
  if (science) scenario.scientific = { narrative: science, equations: [], constants: [] };
  if (scene.compressions?.length) scenario.compressions = scene.compressions;
  if (scene.extent !== undefined) scenario.extent = scene.extent;
  return scenario;
}

/** The form's starting values when editing an existing scenario. */
export function textOf(s: Scenario | null): ScenarioText {
  if (!s) return { name: '', description: '' };
  return {
    name: s.name,
    description: s.description,
    ...s.layman?.sections,
    science: s.scientific?.narrative,
  };
}

export function serializeScenario(s: Scenario): string {
  return `${JSON.stringify(s, null, 2)}\n`;
}

/** Untrusted text (a file, browser storage): size limit, JSON, schema, then physics. */
export function parseScenarioText(text: string): ValidationResult {
  if (utf8Bytes(text) > MAX_SCENARIO_BYTES) return { ok: false, problems: [`The file is larger than ${MAX_SCENARIO_BYTES / 1e6} MB.`] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, problems: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  return validateScenario(raw);
}

// --- My scenarios (browser storage, this device only) ---

export interface StoredScenario {
  id: string;
  savedAt: string; // ISO date
  text: string;
}

const STORAGE_KEY = 'suigen.myScenarios';
export const MAX_STORED = 20;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class MyScenarios {
  constructor(private storage: StorageLike | null = defaultStorage()) {}

  available(): boolean {
    return this.storage !== null;
  }

  list(): StoredScenario[] {
    try {
      const raw: unknown = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((e): e is StoredScenario =>
        !!e && typeof e.id === 'string' && typeof e.savedAt === 'string' && typeof e.text === 'string');
    } catch {
      return [];
    }
  }

  /** Newest first; the same text is kept once; the oldest beyond MAX_STORED are dropped. */
  add(text: string, now = new Date()): { ok: true; id: string } | { ok: false; message: string } {
    if (!this.storage) return { ok: false, message: 'Browser storage is not available, so it was not kept in My scenarios.' };
    const existing = this.list().filter(e => e.text !== text);
    const entry = { id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, savedAt: now.toISOString(), text };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_STORED)));
      return { ok: true, id: entry.id };
    } catch {
      return { ok: false, message: 'Browser storage is full, so it was not kept in My scenarios.' };
    }
  }

  remove(id: string): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.list().filter(e => e.id !== id)));
    } catch {
      // Nothing more to do: the entry stays.
    }
  }
}
