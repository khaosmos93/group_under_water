import { Vector3 } from 'three';
import type { DisturbancePulse, InteractionSettings } from '../types';

const tmpDelta = new Vector3();

export class InteractionField {
  private pulse: DisturbancePulse | null = null;

  setPulse(position: Vector3, now: number): void {
    this.pulse = {
      position: position.clone(),
      createdAt: now
    };
  }

  getSteering(position: Vector3, now: number, settings: InteractionSettings, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    if (!this.pulse) return out;

    const age = now - this.pulse.createdAt;
    if (age >= settings.decay) {
      this.pulse = null;
      return out;
    }

    tmpDelta.copy(position).sub(this.pulse.position);
    const distance = tmpDelta.length();
    if (distance >= settings.radius || distance === 0) return out;

    const timeT = 1 - age / settings.decay;
    const distT = 1 - distance / settings.radius;
    const mag = settings.strength * timeT * distT;

    if (settings.mode === 'repulsion') {
      out.copy(tmpDelta.normalize().multiplyScalar(mag));
    }

    return out;
  }

  getPulsePosition(): Vector3 | null {
    return this.pulse?.position ?? null;
  }
}
