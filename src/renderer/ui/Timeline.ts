import { SimulationEngine } from '../physics/SimulationEngine';
import { formatDuration } from '../physics/time';

export class Timeline {
  private engine: SimulationEngine;
  private btnPlay: HTMLButtonElement;
  private timeDisplay: HTMLSpanElement;
  private speedInput: HTMLInputElement;

  constructor(engine: SimulationEngine) {
    this.engine = engine;
    this.btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    this.timeDisplay = document.getElementById('time-display') as HTMLSpanElement;
    this.speedInput = document.getElementById('speed') as HTMLInputElement;

    this.btnPlay.addEventListener('click', () => {
      engine.togglePlay();
      this.btnPlay.textContent = engine.state.playing ? '\u23F8' : '\u25B6';
    });

    document.getElementById('btn-step-back')!.addEventListener('click', () => {
      engine.stepBack();
    });

    document.getElementById('btn-step-fwd')!.addEventListener('click', () => {
      engine.stepForward();
    });

    this.speedInput.addEventListener('input', () => {
      engine.setSpeed(parseFloat(this.speedInput.value));
    });
  }

  update(): void {
    const rt = this.engine.getRealTime();
    let text = `t ${rt.approximate ? '\u2248' : '='} ${formatDuration(rt.fs)}`;
    if (rt.activeLabel) text += ` (fast-forward: ${rt.activeLabel})`;
    this.timeDisplay.textContent = text;
    this.timeDisplay.title = rt.approximate
      ? 'Real elapsed time. Approximate: includes a span that is fast-forwarded.'
      : 'Real elapsed time.';
  }
}
