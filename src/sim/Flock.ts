import { MathUtils, Vector3 } from 'three';
import type { Bounds, Obstacle, SimulationParams } from '../types';
import { FishAgent } from './FishAgent';
import { InteractionField } from './InteractionField';
import { getObstacleAvoidanceForce } from '../scene/Obstacles';
import { resolveCollisions } from './Collisions';

/*
 * Boids schooling model. For each fish i with position p_i and velocity v_i
 * we build a desired acceleration as a weighted sum of the classical Reynolds
 * forces plus a global-cohesion term that keeps the whole group moving as a
 * single organism:
 *
 *   Separation   S_i = Σ_{j∈N_s}  (p_i - p_j) / |p_i - p_j|^2
 *   Alignment    A_i = mean_{j∈N}(v_j)  -  v_i
 *   Cohesion     C_i = mean_{j∈N}(p_j)  -  p_i
 *   Group pull   G_i = (c - p_i) * max(0, (|c - p_i| - R_school) / R_school)
 *                      with   c = mean_j(p_j)
 *   Obstacles    O_i = repel(look-ahead position from each obstacle)
 *   Boundary     B_i = soft wall spring
 *
 *   a_i  = w_s S_i + w_a A_i + w_c C_i + w_g G_i + w_o O_i + w_b B_i + noise
 *
 * Each sub-force is clamped to max_steer. After Euler integration we clamp
 * speed to [v_min, v_max] and run a hard collision resolver that reflects the
 * velocity off any penetrated obstacle surface:
 *
 *   v' = v - (1 + e)(v·n) n        when  v·n < 0
 *
 * which is the standard elastic-reflection formula with restitution e<1.
 */

const tmpDelta = new Vector3();
const tmpSep = new Vector3();
const tmpAli = new Vector3();
const tmpCoh = new Vector3();
const tmpCenter = new Vector3();
const tmpObstacle = new Vector3();
const tmpInteraction = new Vector3();
const tmpBoundary = new Vector3();
const tmpNoise = new Vector3();
const tmpGroup = new Vector3();
const globalCentroid = new Vector3();
const baseDir = new Vector3(1, 0, 0);

const MIN_SPEED_FRACTION = 0.35; // min speed = fraction * maxSpeed

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
    // Spawn the school as a single tight cloud, not scattered across the volume,
    // so they start already behaving as one group.
    const h = this.bounds.halfSize;
    const spread = Math.min(h.x, h.y, h.z) * spreadFactor * 0.35;
    const origin = new Vector3(
      MathUtils.randFloatSpread(h.x * 0.4),
      MathUtils.randFloatSpread(h.y * 0.4),
      MathUtils.randFloatSpread(h.z * 0.4)
    );
    const seedVel = new Vector3(
      MathUtils.randFloatSpread(1),
      MathUtils.randFloatSpread(0.3),
      MathUtils.randFloatSpread(1)
    ).normalize();

    for (let i = 0; i < count; i += 1) {
      const f = new FishAgent();
      f.position
        .set(
          MathUtils.randFloatSpread(spread * 2),
          MathUtils.randFloatSpread(spread),
          MathUtils.randFloatSpread(spread * 2)
        )
        .add(origin);
      f.velocity
        .copy(seedVel)
        .addScaledVector(
          new Vector3(
            MathUtils.randFloatSpread(0.4),
            MathUtils.randFloatSpread(0.2),
            MathUtils.randFloatSpread(0.4)
          ),
          1
        )
        .normalize()
        .multiplyScalar(MathUtils.randFloat(4, 6));
      const size = MathUtils.randFloat(0.7, 1.2);
      f.scale.set(size * 1.6, size * 0.75, size * 0.75);
      f.color.setHSL(
        MathUtils.randFloat(0.52, 0.62),
        MathUtils.randFloat(0.35, 0.5),
        MathUtils.randFloat(0.52, 0.7)
      );
      this.fish.push(f);
    }
  }

  randomizePositions(spreadFactor: number): void {
    const h = this.bounds.halfSize;
    const spread = Math.min(h.x, h.y, h.z) * spreadFactor * 0.35;
    const origin = new Vector3(
      MathUtils.randFloatSpread(h.x * 0.4),
      MathUtils.randFloatSpread(h.y * 0.4),
      MathUtils.randFloatSpread(h.z * 0.4)
    );
    for (const f of this.fish) {
      f.position
        .set(
          MathUtils.randFloatSpread(spread * 2),
          MathUtils.randFloatSpread(spread),
          MathUtils.randFloatSpread(spread * 2)
        )
        .add(origin);
    }
  }

  step(dt: number, nowSeconds: number, params: SimulationParams): void {
    const perception = params.perceptionRadius;
    const separationRadius = perception * params.separationRadiusFactor;
    const minSpeed = params.maxSpeed * MIN_SPEED_FRACTION;

    // --- Global centroid (school center of mass). -----------------------------
    globalCentroid.set(0, 0, 0);
    for (const f of this.fish) globalCentroid.add(f.position);
    if (this.fish.length > 0) globalCentroid.divideScalar(this.fish.length);

    // School cohesion radius scales with the bounded volume: fish outside this
    // radius get an extra pull back toward the center of mass.
    const h = this.bounds.halfSize;
    const schoolRadius = Math.min(h.x, h.y, h.z) * 0.55;

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
        const d2 = tmpDelta.lengthSq();
        if (d2 === 0 || d2 > perception * perception) continue;
        const d = Math.sqrt(d2);

        neighborCount += 1;
        tmpAli.add(other.velocity);
        tmpCenter.add(other.position);

        if (d < separationRadius) {
          // Inverse-square repulsion: (p_i - p_j) / |p_i - p_j|^2
          tmpSep.addScaledVector(tmpDelta, 1 / d2);
          sepCount += 1;
        }
      }

      if (sepCount > 0) {
        this.steerTowards(tmpSep, current.velocity, params.maxSpeed, params.maxSteer);
      }

      if (neighborCount > 0) {
        tmpAli.divideScalar(neighborCount);
        this.steerTowards(tmpAli, current.velocity, params.maxSpeed, params.maxSteer);

        tmpCenter.divideScalar(neighborCount);
        tmpCoh.copy(tmpCenter).sub(current.position);
        this.steerTowards(tmpCoh, current.velocity, params.maxSpeed, params.maxSteer);
      }

      // Global cohesion: keeps the group as one organism.
      // G_i = (c - p_i) * soft-threshold((|c - p_i| - R_school) / R_school)
      tmpGroup.copy(globalCentroid).sub(current.position);
      const gDist = tmpGroup.length();
      if (gDist > 0 && gDist > schoolRadius) {
        const excess = (gDist - schoolRadius) / schoolRadius;
        const pull = Math.min(1, excess * excess + excess); // 0 at edge, grows past it
        tmpGroup.multiplyScalar(pull / gDist); // unit vector * pull
        this.steerTowards(tmpGroup, current.velocity, params.maxSpeed, params.maxSteer);
      } else {
        tmpGroup.set(0, 0, 0);
      }

      // Predictive obstacle avoidance (steering layer, before bounce).
      getObstacleAvoidanceForce(
        current.position,
        current.velocity,
        perception * 1.3,
        this.obstacles,
        tmpObstacle
      );
      this.limit(tmpObstacle, params.maxSteer * 1.8);

      this.getBoundarySteer(current.position, params, tmpBoundary);
      this.limit(tmpBoundary, params.maxSteer * 1.3);

      tmpNoise
        .set(
          MathUtils.randFloatSpread(1),
          MathUtils.randFloatSpread(0.8),
          MathUtils.randFloatSpread(1)
        )
        .multiplyScalar(params.weights.noise);

      this.interactionField.getSteering(
        current.position,
        nowSeconds,
        params.interaction,
        tmpInteraction
      );
      this.limit(tmpInteraction, params.maxSteer * 2.4);

      current.applyForce(tmpSep.multiplyScalar(params.weights.separation));
      current.applyForce(tmpAli.multiplyScalar(params.weights.alignment));
      current.applyForce(tmpCoh.multiplyScalar(params.weights.cohesion));
      current.applyForce(tmpGroup.multiplyScalar(params.weights.cohesion * 1.4));
      current.applyForce(tmpObstacle.multiplyScalar(params.weights.obstacleAvoidance));
      current.applyForce(tmpBoundary);
      current.applyForce(tmpNoise);
      current.applyForce(tmpInteraction);

      this.limit(current.acceleration, params.maxSteer * 3.5);
    }

    for (const fish of this.fish) {
      fish.integrate(dt, params.maxSpeed);

      // Clamp speed to [minSpeed, maxSpeed] so the school stays polarized even
      // right after a bounce or when cohesion briefly cancels alignment.
      const speed2 = fish.velocity.lengthSq();
      if (speed2 < minSpeed * minSpeed) {
        if (speed2 < 1e-6) fish.velocity.copy(baseDir);
        fish.velocity.setLength(minSpeed);
      }

      this.applyBoundaryPosition(fish.position, params.boundaryMode);

      // Hard collision resolution: bounce off any penetrated obstacle surface.
      resolveCollisions(fish.position, fish.velocity, this.obstacles);

      // Re-clamp max speed in case the bounce added normal energy.
      if (fish.velocity.lengthSq() > params.maxSpeed * params.maxSpeed) {
        fish.velocity.setLength(params.maxSpeed);
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
