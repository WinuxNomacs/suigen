import { SimulationEngine } from '../physics/SimulationEngine';

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
    this.timeDisplay.textContent = `t = ${this.engine.state.time.toFixed(1)} fs`;
  }
}
