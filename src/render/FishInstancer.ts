import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
} from 'three';
import type { FishAgent } from '../sim/FishAgent';

const WORLD_UP = new Vector3(0, 1, 0);
const matrix = new Matrix4();
const forward = new Vector3();
const side = new Vector3();
const up = new Vector3();
const scaleMatrix = new Matrix4();

export class FishInstancer {
  readonly mesh: InstancedMesh;

  constructor(count: number) {
    // Ellipsoid = unit sphere scaled non-uniformly per-instance (long on +X).
    const geo = new SphereGeometry(1, 12, 10);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.05
    });
    this.mesh = new InstancedMesh(geo, material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
  }

  update(fish: FishAgent[]): void {
    const n = fish.length;
    this.mesh.count = n;

    for (let i = 0; i < n; i += 1) {
      const f = fish[i];

      forward.copy(f.velocity);
      if (forward.lengthSq() < 1e-6) {
        forward.set(1, 0, 0);
      } else {
        forward.normalize();
      }

      // Build orthonormal basis with local +X aligned to velocity.
      side.crossVectors(forward, WORLD_UP);
      if (side.lengthSq() < 1e-6) {
        side.set(0, 0, 1);
      } else {
        side.normalize();
      }
      up.crossVectors(side, forward).normalize();

      matrix.makeBasis(forward, up, side);
      scaleMatrix.makeScale(f.scale.x, f.scale.y, f.scale.z);
      matrix.multiply(scaleMatrix);
      matrix.setPosition(f.position);

      this.mesh.setMatrixAt(i, matrix);
      this.mesh.setColorAt(i, f.color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.mesh.dispose();
  }
}
