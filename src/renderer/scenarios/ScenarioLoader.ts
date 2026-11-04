import { Scenario } from '../../shared/types';
import { ScenarioSchema } from '../../shared/scenarioSchema';
import { checkScenarioPhysics } from './validateScenario';

import hydrogenGroundState from '../../../scenarios/hydrogen-ground-state.json';
import photonAbsorption from '../../../scenarios/photon-absorption.json';
import photonEmission from '../../../scenarios/photon-emission.json';
import heliumAtom from '../../../scenarios/helium-atom.json';
import comptonScattering from '../../../scenarios/compton-scattering.json';
import deuteriumFormation from '../../../scenarios/deuterium-formation.json';
import hydrogenIonization from '../../../scenarios/hydrogen-ionization.json';

export const RAW_PRESETS: Record<string, unknown> = {
  'hydrogen-ground-state': hydrogenGroundState,
  'photon-absorption': photonAbsorption,
  'photon-emission': photonEmission,
  'hydrogen-ionization': hydrogenIonization,
  'helium-atom': heliumAtom,
  'compton-scattering': comptonScattering,
  'deuterium-formation': deuteriumFormation,
};

export type ValidationResult = { ok: true; scenario: Scenario } | { ok: false; problems: string[] };

/** Checks structure (zod) and then physics consistency. */
export function validateScenario(raw: unknown): ValidationResult {
  const parsed = ScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const scenario: Scenario = parsed.data;
  const problems = checkScenarioPhysics(scenario);
  return problems.length > 0 ? { ok: false, problems } : { ok: true, scenario };
}

// Invalid presets are left out of the gallery and reported in the console.
const PRESETS: Record<string, Scenario> = {};
for (const [key, raw] of Object.entries(RAW_PRESETS)) {
  const result = validateScenario(raw);
  if ('scenario' in result) {
    PRESETS[key] = result.scenario;
  } else {
    console.error(`Scenario "${key}" is invalid and was skipped:\n  ${result.problems.join('\n  ')}`);
  }
}

export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

export function getPresets(): Record<string, Scenario> {
  return { ...PRESETS };
}

export function loadPreset(name: string): Scenario | undefined {
  return PRESETS[name];
}
