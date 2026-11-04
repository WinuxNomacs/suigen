// Scenario files: what the preload exposes to the page and what the main process accepts.
// Kept to two calls; the page never sees file paths, only the chosen file's name.

export const MAX_SCENARIO_BYTES = 1_000_000;
export const SCENARIO_SAVE_CHANNEL = 'scenario:save';
export const SCENARIO_OPEN_CHANNEL = 'scenario:open';

export type SaveResult =
  | { ok: true; fileName: string }
  | { ok: false; reason: 'canceled' | 'too-large' | 'invalid' | 'error'; message?: string };

export type OpenResult =
  | { ok: true; fileName: string; text: string }
  | { ok: false; reason: 'canceled' | 'too-large' | 'error'; message?: string };

export interface SuigenFilesApi {
  saveScenario(text: string, suggestedName: string): Promise<SaveResult>;
  openScenario(): Promise<OpenResult>;
}

/** A file name from a scenario name: letters, digits, spaces, dots, dashes; no folders; ends in .json. */
export function safeFileName(name: string): string {
  const base = name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} ._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/\.json$/i, '')
    .slice(0, 80)
    .trim();
  return `${base || 'scenario'}.json`;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
