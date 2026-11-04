import { SimulationEngine } from '../physics/SimulationEngine';
import { formatDuration } from '../physics/time';
import { SPEED_POSITION_MAX, SPEED_STOPS, formatSpeed, formatStop, positionToSpeed, speedToPosition } from './speed';

const PLAY = '▶';
const PAUSE = '⏸';

export class Timeline {
  private engine: SimulationEngine;
  private btnPlay: HTMLButtonElement;
  private timeDisplay: HTMLSpanElement;
  private speedInput: HTMLInputElement;
  private speedValue: HTMLButtonElement;
  private scrubber: HTMLInputElement;
  private scrubbing = false;
  private resumeAfterScrub = false;

  constructor(engine: SimulationEngine) {
    this.engine = engine;
    this.btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    this.timeDisplay = document.getElementById('time-display') as HTMLSpanElement;
    this.speedInput = document.getElementById('speed') as HTMLInputElement;
    this.scrubber = document.getElementById('scrubber') as HTMLInputElement;

    this.btnPlay.addEventListener('click', () => engine.togglePlay());
    document.getElementById('btn-reset')!.addEventListener('click', () => engine.reset());
    document.getElementById('btn-step-back')!.addEventListener('click', () => engine.stepBack());
    document.getElementById('btn-step-fwd')!.addEventListener('click', () => engine.stepForward());

    this.speedValue = document.getElementById('speed-value') as HTMLButtonElement;
    const stops = SPEED_STOPS.map(speed => {
      const b = document.createElement('button');
      b.textContent = formatStop(speed);
      b.title = `Set speed to ${formatSpeed(speed)}`;
      b.style.left = `${(speedToPosition(speed) / SPEED_POSITION_MAX) * 100}%`;
      b.addEventListener('click', () => applySpeed(speed));
      return b;
    });
    document.getElementById('speed-stops')!.replaceChildren(...stops);
    const applySpeed = (speed: number) => {
      engine.setSpeed(speed);
      this.speedInput.value = String(speedToPosition(speed));
      this.speedValue.textContent = formatSpeed(speed);
      stops.forEach((b, i) => b.classList.toggle('active', SPEED_STOPS[i] === speed));
    };
    this.speedInput.addEventListener('input', () => applySpeed(positionToSpeed(Number(this.speedInput.value))));
    this.speedValue.addEventListener('click', () => applySpeed(1));
    applySpeed(engine.state.speed);

    // Dragging the scrubber pauses playback and resumes it on release.
    this.scrubber.addEventListener('pointerdown', () => {
      this.scrubbing = true;
      this.resumeAfterScrub = engine.state.playing;
      engine.pause();
    });
    this.scrubber.addEventListener('input', () => engine.seek(parseFloat(this.scrubber.value)));
    const endScrub = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      if (this.resumeAfterScrub) engine.play();
    };
    this.scrubber.addEventListener('pointerup', endScrub);
    this.scrubber.addEventListener('pointercancel', endScrub);
  }

  update(): void {
    const { playing, time } = this.engine.state;
    const icon = playing ? PAUSE : PLAY;
    if (this.btnPlay.textContent !== icon) {
      this.btnPlay.textContent = icon;
      this.btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    // The end grows while playing past it, or when sandbox edits add later events.
    const max = Math.max(this.engine.getDuration(), time);
    this.scrubber.max = String(max);
    if (!this.scrubbing) this.scrubber.value = String(time);

    const rt = this.engine.getRealTime();
    let text = `t ${rt.approximate ? '≈' : '='} ${formatDuration(rt.fs)}`;
    if (rt.activeLabel) text += ` (fast-forward: ${rt.activeLabel})`;
    this.timeDisplay.textContent = text;
    this.timeDisplay.title = `${text}\n${rt.approximate
      ? 'Real elapsed time. Approximate: includes a span that is fast-forwarded.'
      : 'Real elapsed time.'}`;
  }
}
