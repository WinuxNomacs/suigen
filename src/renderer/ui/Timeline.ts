import { SimulationEngine } from '../physics/SimulationEngine';
import { formatDuration } from '../physics/time';

const PLAY = '▶';
const PAUSE = '⏸';

export class Timeline {
  private engine: SimulationEngine;
  private btnPlay: HTMLButtonElement;
  private timeDisplay: HTMLSpanElement;
  private speedInput: HTMLInputElement;
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

    this.speedInput.addEventListener('input', () => {
      engine.setSpeed(parseFloat(this.speedInput.value));
    });

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
    this.timeDisplay.title = rt.approximate
      ? 'Real elapsed time. Approximate: includes a span that is fast-forwarded.'
      : 'Real elapsed time.';
  }
}
