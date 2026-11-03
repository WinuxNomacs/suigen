// Structure of a scenario file. Physics consistency (energies, ids, timing) is checked separately in
// renderer/scenarios/validateScenario.ts. Objects are strict, so a misspelled key is an error.
import { z } from 'zod';

const vec3 = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });

const orbital = z
  .strictObject({ n: z.int().min(1), l: z.int().min(0), m: z.int() })
  .refine(o => o.l < o.n && Math.abs(o.m) <= o.l, { message: 'needs 0 <= l < n and |m| <= l' });

const particleType = z.enum(['electron', 'proton', 'neutron', 'photon']);

const particle = z.strictObject({
  id: z.string().min(1).optional(),
  type: particleType,
  position: vec3.optional(),
  momentum: vec3.optional(),
  spin: z.number().optional(),
  orbital: orbital.optional(),
  direction: vec3.optional(),
  speed: z.number().gt(0).max(1).optional().describe('Speed as a fraction of the speed of light'),
  energy: z.number().positive().optional().describe('Photon energy or kinetic energy, in eV'),
  effectiveCharge: z.number().positive().optional(),
});

const ticks = z.number().min(0).describe('Animation ticks (see physics/time.ts)');

const event = z.discriminatedUnion('action', [
  z.strictObject({ time: ticks, action: z.literal('spawn'), particle }),
  z.strictObject({
    time: ticks,
    action: z.literal('absorb'),
    photonId: z.string(),
    electronId: z.string(),
    targetOrbital: orbital,
  }),
  z.strictObject({
    time: ticks,
    action: z.literal('emit'),
    electronId: z.string(),
    targetOrbital: orbital,
    particle,
  }),
  z.strictObject({ time: ticks, action: z.literal('remove'), targetId: z.string() }),
]);

const compression = z
  .strictObject({
    start: ticks,
    end: ticks,
    realFs: z.number().positive().describe('Real duration in femtoseconds'),
    label: z.string().min(1),
  })
  .refine(c => c.end > c.start, { message: 'end must be after start' });

const text = z.string().min(1);

export const ScenarioSchema = z.strictObject({
  name: text,
  description: text,
  layman: z.strictObject({
    title: text,
    summary: text,
    sections: z.strictObject({
      whatsHappening: text,
      whyItMatters: text,
      whatToWatch: text,
      funFact: text,
    }),
  }),
  scientific: z.strictObject({
    narrative: text,
    equations: z.array(z.strictObject({ label: text, tex: text })),
    constants: z.array(text),
  }),
  particles: z.array(particle),
  events: z.array(event),
  compressions: z.array(compression).optional(),
  simplifications: z.array(text).optional(),
  extent: z.number().positive().optional().describe('Radius in fm the camera frames on load'),
});

export type ParsedScenario = z.infer<typeof ScenarioSchema>;
