import { Box3, Vector3 } from 'three';
import type { BoxObstacle, CylinderObstacle, Obstacle, SphereObstacle } from '../types';

const tmpFuture = new Vector3();
const tmpAway = new Vector3();
const tmpClosest = new Vector3();
const tmpMin = new Vector3();
const tmpMax = new Vector3();
const box = new Box3();

function avoidSphere(obstacle: SphereObstacle, futurePos: Vector3, out: Vector3): number {
  tmpAway.copy(futurePos).sub(obstacle.position);
  const threatRadius = obstacle.radius + obstacle.padding;
  const d = tmpAway.length();
  if (d >= threatRadius || d === 0) return 0;
  out.add(tmpAway.normalize().multiplyScalar((1 - d / threatRadius) * 2));
  return 1;
}

function avoidBox(obstacle: BoxObstacle, futurePos: Vector3, out: Vector3): number {
  tmpMin.copy(obstacle.position).sub(obstacle.size);
  tmpMax.copy(obstacle.position).add(obstacle.size);
  box.min.copy(tmpMin);
  box.max.copy(tmpMax);
  box.clampPoint(futurePos, tmpClosest);
  tmpAway.copy(futurePos).sub(tmpClosest);
  const d = tmpAway.length();
  const threat = obstacle.padding + 2;
  if (d >= threat) return 0;
  if (d === 0) {
    tmpAway.copy(futurePos).sub(obstacle.position).normalize();
  } else {
    tmpAway.normalize();
  }
  out.add(tmpAway.multiplyScalar((1 - d / threat) * 2));
  return 1;
}

function avoidCylinder(obstacle: CylinderObstacle, futurePos: Vector3, out: Vector3): number {
  const half = obstacle.height * 0.5;
  const localY = futurePos.y - obstacle.position.y;
  if (localY < -half - obstacle.padding || localY > half + obstacle.padding) return 0;

  tmpAway.set(futurePos.x - obstacle.position.x, 0, futurePos.z - obstacle.position.z);
  const d = tmpAway.length();
  const threat = obstacle.radius + obstacle.padding;
  if (d >= threat || d === 0) return 0;
  out.add(tmpAway.normalize().multiplyScalar((1 - d / threat) * 2));
  return 1;
}

export function getObstacleAvoidanceForce(
  position: Vector3,
  velocity: Vector3,
  lookAhead: number,
  obstacles: Obstacle[],
  out: Vector3
): Vector3 {
  out.set(0, 0, 0);
  if (velocity.lengthSq() === 0 || obstacles.length === 0) return out;

  tmpFuture.copy(velocity).normalize().multiplyScalar(lookAhead).add(position);
  let hits = 0;

  for (const obstacle of obstacles) {
    if (obstacle.kind === 'sphere') hits += avoidSphere(obstacle, tmpFuture, out);
    else if (obstacle.kind === 'box') hits += avoidBox(obstacle, tmpFuture, out);
    else hits += avoidCylinder(obstacle, tmpFuture, out);
  }

  if (hits > 0) {
    out.divideScalar(hits);
  }

  return out;
}
