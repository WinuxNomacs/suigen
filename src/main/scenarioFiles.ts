// Main-process side of saving and opening scenario files. The page can only ask for these two
// operations; the user picks the file in the system dialog, and only .json files up to
// MAX_SCENARIO_BYTES are written or read. Dependencies are injected so the logic is unit-tested.
import path from 'node:path';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  MAX_SCENARIO_BYTES, OpenResult, SaveResult, SCENARIO_OPEN_CHANNEL, SCENARIO_SAVE_CHANNEL, safeFileName, utf8Bytes,
} from '../shared/files';

export interface FileDeps {
  showSaveDialog(win: BrowserWindow, options: Electron.SaveDialogOptions): Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog(win: BrowserWindow, options: Electron.OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }>;
  writeFile(filePath: string, text: string): Promise<void>;
  readFile(filePath: string): Promise<string>;
  fileSize(filePath: string): Promise<number>;
}

const FILTERS = [{ name: 'Suigen scenario', extensions: ['json'] }];

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function saveScenarioFile(deps: FileDeps, win: BrowserWindow, text: unknown, suggestedName: unknown): Promise<SaveResult> {
  if (typeof text !== 'string' || typeof suggestedName !== 'string') return { ok: false, reason: 'invalid' };
  if (utf8Bytes(text) > MAX_SCENARIO_BYTES) return { ok: false, reason: 'too-large' };
  const choice = await deps.showSaveDialog(win, { title: 'Save scenario', defaultPath: safeFileName(suggestedName), filters: FILTERS });
  if (choice.canceled || !choice.filePath) return { ok: false, reason: 'canceled' };
  const filePath = /\.json$/i.test(choice.filePath) ? choice.filePath : `${choice.filePath}.json`;
  try {
    await deps.writeFile(filePath, text);
    return { ok: true, fileName: path.basename(filePath) };
  } catch (e) {
    return { ok: false, reason: 'error', message: errorMessage(e) };
  }
}

export async function openScenarioFile(deps: FileDeps, win: BrowserWindow): Promise<OpenResult> {
  const choice = await deps.showOpenDialog(win, { title: 'Open scenario', properties: ['openFile'], filters: FILTERS });
  const filePath = choice.filePaths[0];
  if (choice.canceled || !filePath) return { ok: false, reason: 'canceled' };
  try {
    if ((await deps.fileSize(filePath)) > MAX_SCENARIO_BYTES) return { ok: false, reason: 'too-large' };
    return { ok: true, fileName: path.basename(filePath), text: await deps.readFile(filePath) };
  } catch (e) {
    return { ok: false, reason: 'error', message: errorMessage(e) };
  }
}

/** Only the top frame of one of the app's own windows may ask. */
function senderWindow(event: IpcMainInvokeEvent, fromWebContents: (wc: Electron.WebContents) => BrowserWindow | null): BrowserWindow | null {
  if (event.senderFrame !== event.sender.mainFrame) return null;
  return fromWebContents(event.sender);
}

export function registerScenarioFileHandlers(
  ipcMain: Pick<IpcMain, 'handle'>,
  fromWebContents: (wc: Electron.WebContents) => BrowserWindow | null,
  deps: FileDeps,
): void {
  ipcMain.handle(SCENARIO_SAVE_CHANNEL, (event, text: unknown, suggestedName: unknown) => {
    const win = senderWindow(event, fromWebContents);
    return win ? saveScenarioFile(deps, win, text, suggestedName) : { ok: false, reason: 'error', message: 'Not allowed from this page' };
  });
  ipcMain.handle(SCENARIO_OPEN_CHANNEL, event => {
    const win = senderWindow(event, fromWebContents);
    return win ? openScenarioFile(deps, win) : { ok: false, reason: 'error', message: 'Not allowed from this page' };
  });
}
