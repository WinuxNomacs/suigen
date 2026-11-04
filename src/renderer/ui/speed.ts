// Playback speed slider: fixed stops with even steps in between, so the slow range near 0 gets as much
// slider travel as the fast range. Slider positions are integers; each gap between stops has
// STEPS_PER_SEGMENT positions (0.05x steps between -2x and 2x).

export const SPEED_STOPS = [-10, -5, -2, -1, 0, 1, 2];
export const STEPS_PER_SEGMENT = 20;
export const SPEED_POSITION_MAX = (SPEED_STOPS.length - 1) * STEPS_PER_SEGMENT;

export function positionToSpeed(position: number): number {
  const p = Math.min(Math.max(position, 0), SPEED_POSITION_MAX);
  const seg = Math.min(Math.floor(p / STEPS_PER_SEGMENT), SPEED_STOPS.length - 2);
  const f = (p - seg * STEPS_PER_SEGMENT) / STEPS_PER_SEGMENT;
  const speed = SPEED_STOPS[seg] + f * (SPEED_STOPS[seg + 1] - SPEED_STOPS[seg]);
  return Math.round(speed * 1000) / 1000; // drop float noise such as 0.30000000000000004
}

export function speedToPosition(speed: number): number {
  const s = Math.min(Math.max(speed, SPEED_STOPS[0]), SPEED_STOPS[SPEED_STOPS.length - 1]);
  for (let seg = 0; seg < SPEED_STOPS.length - 1; seg++) {
    const a = SPEED_STOPS[seg];
    const b = SPEED_STOPS[seg + 1];
    if (s <= b) return Math.round((seg + (s - a) / (b - a)) * STEPS_PER_SEGMENT);
  }
  return SPEED_POSITION_MAX;
}

export function formatSpeed(speed: number): string {
  return `${+speed.toFixed(2)}x`;
}
