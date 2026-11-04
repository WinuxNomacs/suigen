// The page's only bridge to the main process: save and open a scenario file through the system dialog.
import { contextBridge, ipcRenderer } from 'electron';
import { SCENARIO_OPEN_CHANNEL, SCENARIO_SAVE_CHANNEL, SuigenFilesApi } from '../shared/files';

const api: SuigenFilesApi = {
  saveScenario: (text, suggestedName) => ipcRenderer.invoke(SCENARIO_SAVE_CHANNEL, String(text), String(suggestedName)),
  openScenario: () => ipcRenderer.invoke(SCENARIO_OPEN_CHANNEL),
};

contextBridge.exposeInMainWorld('suigenFiles', api);
