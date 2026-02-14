import { Scenario } from '../../shared/types';

import hydrogenGroundState from '../../../scenarios/hydrogen-ground-state.json';
import photonAbsorption from '../../../scenarios/photon-absorption.json';
import photonEmission from '../../../scenarios/photon-emission.json';
import heliumAtom from '../../../scenarios/helium-atom.json';

const PRESETS: Record<string, Scenario> = {
  'hydrogen-ground-state': hydrogenGroundState as unknown as Scenario,
  'photon-absorption': photonAbsorption as unknown as Scenario,
  'photon-emission': photonEmission as unknown as Scenario,
  'helium-atom': heliumAtom as unknown as Scenario,
};

export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

export function loadPreset(name: string): Scenario | undefined {
  return PRESETS[name];
}
