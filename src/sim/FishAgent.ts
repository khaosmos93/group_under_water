import { Color, Vector3 } from 'three';

export class FishAgent {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  readonly acceleration = new Vector3();
  readonly scale = new Vector3();
  readonly color = new Color();

  applyForce(force: Vector3): void {
    this.acceleration.add(force);
  }

  integrate(dt: number, maxSpeed: number): void {
    this.velocity.addScaledVector(this.acceleration, dt);
    if (this.velocity.lengthSq() > maxSpeed * maxSpeed) {
      this.velocity.setLength(maxSpeed);
    }
    this.position.addScaledVector(this.velocity, dt);
    this.acceleration.set(0, 0, 0);
  }
}
