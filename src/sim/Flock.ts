import { MathUtils, Vector3 } from 'three';
import type { Bounds, Obstacle, SimulationParams } from '../types';
import { FishAgent } from './FishAgent';
import { InteractionField } from './InteractionField';
import { getObstacleAvoidanceForce } from '../scene/Obstacles';

const tmpDelta = new Vector3();
const tmpSep = new Vector3();
const tmpAli = new Vector3();
const tmpCoh = new Vector3();
const tmpCenter = new Vector3();
const tmpObstacle = new Vector3();
const tmpInteraction = new Vector3();
const tmpBoundary = new Vector3();
const tmpNoise = new Vector3();
const baseDir = new Vector3(1, 0, 0);

export class Flock {
  readonly fish: FishAgent[] = [];

  private readonly bounds: Bounds;
  private readonly interactionField: InteractionField;
  private obstacles: Obstacle[] = [];

  constructor(bounds: Bounds, interactionField: InteractionField) {
    this.bounds = bounds;
    this.interactionField = interactionField;
  }

  setObstacles(obstacles: Obstacle[]): void {
    this.obstacles = obstacles;
  }

  reset(count: number, spreadFactor: number): void {
    this.fish.length = 0;
    for (let i = 0; i < count; i += 1) {
      const f = new FishAgent();
      f.position.set(
        MathUtils.randFloatSpread(this.bounds.halfSize.x * spreadFactor * 2),
        MathUtils.randFloatSpread(this.bounds.halfSize.y * spreadFactor * 2),
        MathUtils.randFloatSpread(this.bounds.halfSize.z * spreadFactor * 2)
      );
      f.velocity
        .set(MathUtils.randFloatSpread(2), MathUtils.randFloatSpread(1.4), MathUtils.randFloatSpread(2))
        .normalize()
        .multiplyScalar(MathUtils.randFloat(4, 6));
      const size = MathUtils.randFloat(0.7, 1.3);
      f.scale.set(size * 1.5, size * 0.8, size * 0.8);
      f.color.setHSL(MathUtils.randFloat(0.52, 0.62), MathUtils.randFloat(0.35, 0.5), MathUtils.randFloat(0.52, 0.7));
      this.fish.push(f);
    }
  }

  randomizePositions(spreadFactor: number): void {
    for (const f of this.fish) {
      f.position.set(
        MathUtils.randFloatSpread(this.bounds.halfSize.x * spreadFactor * 2),
        MathUtils.randFloatSpread(this.bounds.halfSize.y * spreadFactor * 2),
        MathUtils.randFloatSpread(this.bounds.halfSize.z * spreadFactor * 2)
      );
    }
  }

  step(dt: number, nowSeconds: number, params: SimulationParams): void {
    const perception = params.perceptionRadius;
    const separationRadius = perception * params.separationRadiusFactor;

    for (let i = 0; i < this.fish.length; i += 1) {
      const current = this.fish[i];
      tmpSep.set(0, 0, 0);
      tmpAli.set(0, 0, 0);
      tmpCoh.set(0, 0, 0);
      tmpCenter.set(0, 0, 0);

      let neighborCount = 0;
      let sepCount = 0;

      for (let j = 0; j < this.fish.length; j += 1) {
        if (i === j) continue;
        const other = this.fish[j];
        tmpDelta.copy(current.position).sub(other.position);
        const d = tmpDelta.length();
        if (d === 0 || d > perception) continue;

        neighborCount += 1;
        tmpAli.add(other.velocity);
        tmpCenter.add(other.position);

        if (d < separationRadius) {
          tmpSep.add(tmpDelta.normalize().divideScalar(Math.max(d, 0.001)));
          sepCount += 1;
        }
      }

      if (sepCount > 0) {
        tmpSep.divideScalar(sepCount);
        this.steerTowards(tmpSep, current.velocity, params.maxSpeed, params.maxSteer);
      }

      if (neighborCount > 0) {
        tmpAli.divideScalar(neighborCount);
        this.steerTowards(tmpAli, current.velocity, params.maxSpeed, params.maxSteer);

        tmpCenter.divideScalar(neighborCount);
        tmpCoh.copy(tmpCenter).sub(current.position);
        this.steerTowards(tmpCoh, current.velocity, params.maxSpeed, params.maxSteer);
      }

      tmpObstacle.copy(
        getObstacleAvoidanceForce(current.position, current.velocity, perception * 1.3, this.obstacles, tmpObstacle)
      );
      this.limit(tmpObstacle, params.maxSteer * 1.6);

      this.getBoundarySteer(current.position, params, tmpBoundary);
      this.limit(tmpBoundary, params.maxSteer * 1.3);

      tmpNoise
        .set(MathUtils.randFloatSpread(1), MathUtils.randFloatSpread(0.8), MathUtils.randFloatSpread(1))
        .multiplyScalar(params.weights.noise);

      this.interactionField.getSteering(current.position, nowSeconds, params.interaction, tmpInteraction);
      this.limit(tmpInteraction, params.maxSteer * 2.4);

      current.applyForce(tmpSep.multiplyScalar(params.weights.separation));
      current.applyForce(tmpAli.multiplyScalar(params.weights.alignment));
      current.applyForce(tmpCoh.multiplyScalar(params.weights.cohesion));
      current.applyForce(tmpObstacle.multiplyScalar(params.weights.obstacleAvoidance));
      current.applyForce(tmpBoundary);
      current.applyForce(tmpNoise);
      current.applyForce(tmpInteraction);

      this.limit(current.acceleration, params.maxSteer * 3.5);
    }

    for (const fish of this.fish) {
      fish.integrate(dt, params.maxSpeed);
      this.applyBoundaryPosition(fish.position, params.boundaryMode);
      if (fish.velocity.lengthSq() < 0.001) {
        fish.velocity.copy(baseDir).multiplyScalar(0.2);
      }
    }
  }

  private steerTowards(desired: Vector3, velocity: Vector3, maxSpeed: number, maxSteer: number): void {
    if (desired.lengthSq() === 0) return;
    desired.setLength(maxSpeed).sub(velocity);
    this.limit(desired, maxSteer);
  }

  private limit(v: Vector3, max: number): void {
    if (v.lengthSq() > max * max) v.setLength(max);
  }

  private getBoundarySteer(position: Vector3, params: SimulationParams, out: Vector3): void {
    out.set(0, 0, 0);
    if (params.boundaryMode === 'wrap') return;

    const margin = 18;
    const strength = 0.08;
    const { x, y, z } = this.bounds.halfSize;

    if (position.x > x - margin) out.x -= (position.x - (x - margin)) * strength;
    if (position.x < -x + margin) out.x += (-x + margin - position.x) * strength;

    if (position.y > y - margin) out.y -= (position.y - (y - margin)) * strength;
    if (position.y < -y + margin) out.y += (-y + margin - position.y) * strength;

    if (position.z > z - margin) out.z -= (position.z - (z - margin)) * strength;
    if (position.z < -z + margin) out.z += (-z + margin - position.z) * strength;
  }

  private applyBoundaryPosition(position: Vector3, mode: 'soft' | 'wrap'): void {
    const h = this.bounds.halfSize;
    if (mode === 'wrap') {
      if (position.x > h.x) position.x = -h.x;
      if (position.x < -h.x) position.x = h.x;
      if (position.y > h.y) position.y = -h.y;
      if (position.y < -h.y) position.y = h.y;
      if (position.z > h.z) position.z = -h.z;
      if (position.z < -h.z) position.z = h.z;
    } else {
      position.x = MathUtils.clamp(position.x, -h.x, h.x);
      position.y = MathUtils.clamp(position.y, -h.y, h.y);
      position.z = MathUtils.clamp(position.z, -h.z, h.z);
    }
  }
}
