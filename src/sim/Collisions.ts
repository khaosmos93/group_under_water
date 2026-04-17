import { Box3, Vector3 } from 'three';
import type { BoxObstacle, CylinderObstacle, Obstacle, SphereObstacle } from '../types';

/*
 * Hard collision resolution against obstacles.
 *
 * After the integration step we check each fish against each obstacle. If the
 * fish has penetrated the surface (or entered a thin "skin" buffer around it)
 * we:
 *   1. compute the outward surface normal n
 *   2. clamp the fish position back to surface + SKIN along n
 *   3. reflect the inward velocity component:
 *          v' = v - (1 + e) (v · n) n        if v · n < 0
 *      where e is the coefficient of restitution (0 = slide, 1 = elastic).
 *
 * The restitution is < 1 so the bounce sheds a little energy, then a small
 * tangential damp removes grazing speed so fish don't skid forever.
 */

const RESTITUTION = 0.85;
const TANGENT_DAMP = 0.96;
const SKIN = 0.5;

const normal = new Vector3();
const tangent = new Vector3();
const closest = new Vector3();
const box = new Box3();

function reflect(velocity: Vector3, n: Vector3): void {
  const vn = velocity.dot(n);
  if (vn >= 0) return;
  // Normal component reflection with restitution.
  velocity.addScaledVector(n, -(1 + RESTITUTION) * vn);
  // Mild tangent damping: v_t *= TANGENT_DAMP, where v_t = v - (v·n) n.
  const vn2 = velocity.dot(n);
  tangent.copy(velocity).addScaledVector(n, -vn2);
  velocity.copy(n).multiplyScalar(vn2).addScaledVector(tangent, TANGENT_DAMP);
}

function resolveSphere(o: SphereObstacle, position: Vector3, velocity: Vector3): void {
  normal.copy(position).sub(o.position);
  const d2 = normal.lengthSq();
  const r = o.radius + SKIN;
  if (d2 >= r * r) return;

  const d = Math.sqrt(d2);
  if (d === 0) {
    normal.set(1, 0, 0);
  } else {
    normal.divideScalar(d);
  }
  position.copy(o.position).addScaledVector(normal, r);
  reflect(velocity, normal);
}

function resolveBox(o: BoxObstacle, position: Vector3, velocity: Vector3): void {
  box.min.copy(o.position).sub(o.size);
  box.max.copy(o.position).add(o.size);
  box.clampPoint(position, closest);
  normal.copy(position).sub(closest);
  const d2 = normal.lengthSq();

  if (d2 === 0) {
    // Point is inside the box: pick the nearest face.
    const dx = o.size.x - Math.abs(position.x - o.position.x);
    const dy = o.size.y - Math.abs(position.y - o.position.y);
    const dz = o.size.z - Math.abs(position.z - o.position.z);
    normal.set(0, 0, 0);
    if (dx <= dy && dx <= dz) {
      normal.x = Math.sign(position.x - o.position.x) || 1;
      position.x = o.position.x + normal.x * (o.size.x + SKIN);
    } else if (dy <= dz) {
      normal.y = Math.sign(position.y - o.position.y) || 1;
      position.y = o.position.y + normal.y * (o.size.y + SKIN);
    } else {
      normal.z = Math.sign(position.z - o.position.z) || 1;
      position.z = o.position.z + normal.z * (o.size.z + SKIN);
    }
    reflect(velocity, normal);
    return;
  }

  if (d2 >= SKIN * SKIN) return;

  const d = Math.sqrt(d2);
  normal.divideScalar(d);
  position.copy(closest).addScaledVector(normal, SKIN);
  reflect(velocity, normal);
}

function resolveCylinder(o: CylinderObstacle, position: Vector3, velocity: Vector3): void {
  // Axis-aligned along Y.
  const halfH = o.height * 0.5;
  const yLo = o.position.y - halfH;
  const yHi = o.position.y + halfH;

  const dx = position.x - o.position.x;
  const dz = position.z - o.position.z;
  const rPlane2 = dx * dx + dz * dz;
  const rLimit = o.radius + SKIN;

  const withinHeight = position.y > yLo - SKIN && position.y < yHi + SKIN;
  if (!withinHeight) return;

  if (position.y > yLo && position.y < yHi && rPlane2 < rLimit * rLimit) {
    // Inside the wall region -> push out radially.
    const rPlane = Math.sqrt(rPlane2);
    if (rPlane === 0) {
      normal.set(1, 0, 0);
      position.x = o.position.x + rLimit;
      position.z = o.position.z;
    } else {
      const inv = 1 / rPlane;
      normal.set(dx * inv, 0, dz * inv);
      position.x = o.position.x + normal.x * rLimit;
      position.z = o.position.z + normal.z * rLimit;
    }
    reflect(velocity, normal);
    return;
  }

  // Cap region: only reflect in Y if actually overlapping the disc.
  if (rPlane2 < o.radius * o.radius) {
    if (position.y <= yLo && position.y > yLo - SKIN) {
      normal.set(0, -1, 0);
      position.y = yLo - SKIN;
      reflect(velocity, normal);
    } else if (position.y >= yHi && position.y < yHi + SKIN) {
      normal.set(0, 1, 0);
      position.y = yHi + SKIN;
      reflect(velocity, normal);
    }
  }
}

export function resolveCollisions(
  position: Vector3,
  velocity: Vector3,
  obstacles: Obstacle[]
): void {
  for (const o of obstacles) {
    if (o.kind === 'sphere') resolveSphere(o, position, velocity);
    else if (o.kind === 'box') resolveBox(o, position, velocity);
    else resolveCylinder(o, position, velocity);
  }
}
