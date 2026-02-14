import { loadPreset } from '../scenarios/ScenarioLoader';
import { SimulationEngine } from '../physics/SimulationEngine';

export class ScenarioMenu {
  constructor(engine: SimulationEngine) {
    const select = document.getElementById('scenario-select') as HTMLSelectElement;
    select.addEventListener('change', () => {
      const name = select.value;
      if (!name) return;
      const scenario = loadPreset(name);
      if (scenario) {
        engine.loadScenario(scenario.particles, scenario.events);
      }
      select.value = '';
    });
  }
}
