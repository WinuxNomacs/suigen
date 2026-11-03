import { ParticleType } from '../../shared/types';

export class Toolbar {
  private selectedType: ParticleType | null = null;
  private buttons: NodeListOf<HTMLButtonElement>;
  private onSelect?: (type: ParticleType | null) => void;

  constructor() {
    this.buttons = document.querySelectorAll('.particle-btn');
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type as ParticleType;
        if (this.selectedType === type) {
          this.selectedType = null;
          btn.classList.remove('active');
        } else {
          this.buttons.forEach(b => b.classList.remove('active'));
          this.selectedType = type;
          btn.classList.add('active');
        }
        this.onSelect?.(this.selectedType);
      });
    });
  }

  setOnSelect(cb: (type: ParticleType | null) => void): void {
    this.onSelect = cb;
  }

  getSelectedType(): ParticleType | null {
    return this.selectedType;
  }

  getPhotonEnergy(): number {
    return parseFloat((document.getElementById('photon-energy') as HTMLSelectElement).value);
  }

  clearSelection(): void {
    this.selectedType = null;
    this.buttons.forEach(b => b.classList.remove('active'));
  }
}
