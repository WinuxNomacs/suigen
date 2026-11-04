// Saving and opening scenario files from the page. The desktop app goes through the preload bridge
// (system dialogs in the main process); the browser build downloads and uses a file picker instead.
import { MAX_SCENARIO_BYTES, OpenResult, SaveResult, SuigenFilesApi, safeFileName } from '../shared/files';

declare global {
  interface Window {
    suigenFiles?: SuigenFilesApi;
  }
}

export async function saveScenarioFile(text: string, name: string): Promise<SaveResult> {
  if (window.suigenFiles) return window.suigenFiles.saveScenario(text, name);
  const fileName = safeFileName(name);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { ok: true, fileName };
}

export function openScenarioFile(): Promise<OpenResult> {
  if (window.suigenFiles) return window.suigenFiles.openScenario();
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('cancel', () => resolve({ ok: false, reason: 'canceled' }));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve({ ok: false, reason: 'canceled' });
      if (file.size > MAX_SCENARIO_BYTES) return resolve({ ok: false, reason: 'too-large' });
      try {
        resolve({ ok: true, fileName: file.name, text: await file.text() });
      } catch (e) {
        resolve({ ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    });
    input.click();
  });
}
