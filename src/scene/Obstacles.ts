import { Box3, Vector3 } from 'three';
import type { BoxObstacle, CylinderObstacle, Obstacle, SphereObstacle } from '../types';

const tmpFuture = new Vector3();
const tmpAway = new Vector3();
const tmpClosest = new Vector3();
const tmpMin = new Vector3();
const tmpMax = new Vector3();
const tmpNormal = new Vector3();
const box = new Box3();

const BOUNCE_EPSILON = 0.05;

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

function bounceSphere(
  obstacle: SphereObstacle,
  position: Vector3,
  velocity: Vector3,
  restitution: number
): boolean {
  tmpAway.copy(position).sub(obstacle.position);
  const surfaceR = obstacle.radius;
  const d = tmpAway.length();
  if (d >= surfaceR) return false;

  if (d === 0) tmpNormal.set(0, 1, 0);
  else tmpNormal.copy(tmpAway).divideScalar(d);

  position.copy(obstacle.position).addScaledVector(tmpNormal, surfaceR + BOUNCE_EPSILON);
  const vn = velocity.dot(tmpNormal);
  if (vn < 0) velocity.addScaledVector(tmpNormal, -(1 + restitution) * vn);
  return true;
}

function bounceBox(
  obstacle: BoxObstacle,
  position: Vector3,
  velocity: Vector3,
  restitution: number
): boolean {
  tmpMin.copy(obstacle.position).sub(obstacle.size);
  tmpMax.copy(obstacle.position).add(obstacle.size);
  const inside =
    position.x > tmpMin.x && position.x < tmpMax.x &&
    position.y > tmpMin.y && position.y < tmpMax.y &&
    position.z > tmpMin.z && position.z < tmpMax.z;
  if (!inside) return false;

  const dxMin = position.x - tmpMin.x;
  const dxMax = tmpMax.x - position.x;
  const dyMin = position.y - tmpMin.y;
  const dyMax = tmpMax.y - position.y;
  const dzMin = position.z - tmpMin.z;
  const dzMax = tmpMax.z - position.z;

  let minDist = dxMin;
  let axis = 0;
  let sign = -1;
  if (dxMax < minDist) { minDist = dxMax; axis = 0; sign = 1; }
  if (dyMin < minDist) { minDist = dyMin; axis = 1; sign = -1; }
  if (dyMax < minDist) { minDist = dyMax; axis = 1; sign = 1; }
  if (dzMin < minDist) { minDist = dzMin; axis = 2; sign = -1; }
  if (dzMax < minDist) { minDist = dzMax; axis = 2; sign = 1; }

  tmpNormal.set(0, 0, 0);
  if (axis === 0) tmpNormal.x = sign;
  else if (axis === 1) tmpNormal.y = sign;
  else tmpNormal.z = sign;

  if (sign > 0) {
    if (axis === 0) position.x = tmpMax.x + BOUNCE_EPSILON;
    else if (axis === 1) position.y = tmpMax.y + BOUNCE_EPSILON;
    else position.z = tmpMax.z + BOUNCE_EPSILON;
  } else {
    if (axis === 0) position.x = tmpMin.x - BOUNCE_EPSILON;
    else if (axis === 1) position.y = tmpMin.y - BOUNCE_EPSILON;
    else position.z = tmpMin.z - BOUNCE_EPSILON;
  }

  const vn = velocity.dot(tmpNormal);
  if (vn < 0) velocity.addScaledVector(tmpNormal, -(1 + restitution) * vn);
  return true;
}

function bounceCylinder(
  obstacle: CylinderObstacle,
  position: Vector3,
  velocity: Vector3,
  restitution: number
): boolean {
  const half = obstacle.height * 0.5;
  const localY = position.y - obstacle.position.y;
  const insideY = localY > -half && localY < half;

  tmpAway.set(position.x - obstacle.position.x, 0, position.z - obstacle.position.z);
  const radial = tmpAway.length();
  const insideR = radial < obstacle.radius;

  if (!insideY || !insideR) return false;

  const dR = obstacle.radius - radial;
  const dTop = half - localY;
  const dBot = localY + half;

  if (dR <= dTop && dR <= dBot) {
    if (radial === 0) tmpNormal.set(1, 0, 0);
    else tmpNormal.set(tmpAway.x / radial, 0, tmpAway.z / radial);
    position.x = obstacle.position.x + tmpNormal.x * (obstacle.radius + BOUNCE_EPSILON);
    position.z = obstacle.position.z + tmpNormal.z * (obstacle.radius + BOUNCE_EPSILON);
  } else if (dTop <= dBot) {
    tmpNormal.set(0, 1, 0);
    position.y = obstacle.position.y + half + BOUNCE_EPSILON;
  } else {
    tmpNormal.set(0, -1, 0);
    position.y = obstacle.position.y - half - BOUNCE_EPSILON;
  }

  const vn = velocity.dot(tmpNormal);
  if (vn < 0) velocity.addScaledVector(tmpNormal, -(1 + restitution) * vn);
  return true;
}

export function resolveObstacleCollision(
  position: Vector3,
  velocity: Vector3,
  obstacles: Obstacle[],
  restitution: number
): boolean {
  let bounced = false;
  for (const obstacle of obstacles) {
    if (obstacle.kind === 'sphere') {
      if (bounceSphere(obstacle, position, velocity, restitution)) bounced = true;
    } else if (obstacle.kind === 'box') {
      if (bounceBox(obstacle, position, velocity, restitution)) bounced = true;
    } else {
      if (bounceCylinder(obstacle, position, velocity, restitution)) bounced = true;
    }
  }
  return bounced;
}
