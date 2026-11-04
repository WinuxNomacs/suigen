import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { FileDeps, openScenarioFile, registerScenarioFileHandlers, saveScenarioFile } from './scenarioFiles';
import { MAX_SCENARIO_BYTES, SCENARIO_OPEN_CHANNEL, SCENARIO_SAVE_CHANNEL, safeFileName } from '../shared/files';

const win = {} as BrowserWindow;

function deps(over: Partial<FileDeps> = {}): FileDeps & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    showSaveDialog: async () => ({ canceled: false, filePath: '/tmp/out/my scene.json' }),
    showOpenDialog: async () => ({ canceled: false, filePaths: ['/tmp/in/scene.json'] }),
    writeFile: async (p, t) => { written.set(p, t); },
    readFile: async () => '{"x":1}',
    fileSize: async () => 7,
    ...over,
  };
}

describe('safe file names', () => {
  it('keep letters, digits, spaces, dots and dashes; no folders; end in .json', () => {
    expect(safeFileName('My Scene')).toBe('My Scene.json');
    expect(safeFileName('../../etc/passwd')).toBe('etc passwd.json');
    expect(safeFileName('C:\\Users\\x\\a<b>|c?')).toBe('C Users x a b c.json');
    expect(safeFileName('  ')).toBe('scenario.json');
    expect(safeFileName('Deuterium.JSON')).toBe('Deuterium.json');
    expect(safeFileName('Ünïcode ok')).toBe('Ünïcode ok.json');
    expect(safeFileName('x'.repeat(200)).length).toBe(80 + '.json'.length);
  });
});

describe('saving', () => {
  it('writes the chosen file and returns only its name', async () => {
    const d = deps();
    const save = vi.spyOn(d, 'showSaveDialog');
    expect(await saveScenarioFile(d, win, '{}', '../My Scene')).toEqual({ ok: true, fileName: 'my scene.json' });
    expect(d.written.get('/tmp/out/my scene.json')).toBe('{}');
    expect(save.mock.calls[0][1].defaultPath).toBe('My Scene.json');
  });

  it('adds .json when the user typed a name without it', async () => {
    const d = deps({ showSaveDialog: async () => ({ canceled: false, filePath: '/tmp/out/plain' }) });
    expect(await saveScenarioFile(d, win, '{}', 'x')).toEqual({ ok: true, fileName: 'plain.json' });
  });

  it('refuses non-text arguments, oversized text, and reports cancel and write errors', async () => {
    expect(await saveScenarioFile(deps(), win, 42, 'x')).toEqual({ ok: false, reason: 'invalid' });
    expect(await saveScenarioFile(deps(), win, 'a'.repeat(MAX_SCENARIO_BYTES + 1), 'x')).toEqual({ ok: false, reason: 'too-large' });
    expect(await saveScenarioFile(deps({ showSaveDialog: async () => ({ canceled: true }) }), win, '{}', 'x')).toEqual({ ok: false, reason: 'canceled' });
    const failing = deps({ writeFile: async () => { throw new Error('disk full'); } });
    expect(await saveScenarioFile(failing, win, '{}', 'x')).toEqual({ ok: false, reason: 'error', message: 'disk full' });
  });
});

describe('opening', () => {
  it('reads the chosen file', async () => {
    expect(await openScenarioFile(deps(), win)).toEqual({ ok: true, fileName: 'scene.json', text: '{"x":1}' });
  });

  it('refuses files over the limit without reading them, and reports cancel', async () => {
    const read = vi.fn(async () => '');
    expect(await openScenarioFile(deps({ fileSize: async () => MAX_SCENARIO_BYTES + 1, readFile: read }), win)).toEqual({ ok: false, reason: 'too-large' });
    expect(read).not.toHaveBeenCalled();
    expect(await openScenarioFile(deps({ showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }), win)).toEqual({ ok: false, reason: 'canceled' });
  });
});

describe('IPC handlers', () => {
  const setup = () => {
    const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
    const ipc = { handle: (ch: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => { handlers.set(ch, fn); } };
    const mainFrame = {};
    const sender = { mainFrame };
    registerScenarioFileHandlers(ipc as never, wc => (wc === (sender as never) ? win : null), deps());
    return { handlers, sender, mainFrame };
  };

  it('registers exactly the two channels', () => {
    expect([...setup().handlers.keys()].sort()).toEqual([SCENARIO_OPEN_CHANNEL, SCENARIO_SAVE_CHANNEL].sort());
  });

  it('answers the app window top frame and refuses subframes and unknown senders', async () => {
    const { handlers, sender, mainFrame } = setup();
    const save = handlers.get(SCENARIO_SAVE_CHANNEL)!;
    expect(await save({ sender, senderFrame: mainFrame } as never, '{}', 'x')).toMatchObject({ ok: true });
    expect(await save({ sender, senderFrame: {} } as never, '{}', 'x')).toMatchObject({ ok: false, reason: 'error' });
    const stranger = { mainFrame: {} };
    expect(await save({ sender: stranger, senderFrame: stranger.mainFrame } as never, '{}', 'x')).toMatchObject({ ok: false, reason: 'error' });
  });
});
