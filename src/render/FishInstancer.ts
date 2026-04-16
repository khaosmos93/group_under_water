import { DynamicDrawUsage, InstancedMesh, Matrix4, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { FishAgent } from '../sim/FishAgent';

const UP = new Vector3(0, 1, 0);
const matrix = new Matrix4();
const forward = new Vector3();
const target = new Vector3();

export class FishInstancer {
  readonly mesh: InstancedMesh;

  constructor(count: number) {
    const geo = new SphereGeometry(1, 10, 8);
    geo.scale(1.25, 0.65, 0.65);
    const material = new MeshStandardMaterial({
      color: 0x88bcd4,
      roughness: 0.45,
      metalness: 0.05,
      vertexColors: true
    });
    this.mesh = new InstancedMesh(geo, material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  update(fish: FishAgent[]): void {
    this.mesh.count = fish.length;
    for (let i = 0; i < fish.length; i += 1) {
      const f = fish[i];
      forward.copy(f.velocity);
      if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0);
      else forward.normalize();
      target.copy(f.position).add(forward);
      matrix.lookAt(f.position, target, UP);
      matrix.invert();
      matrix.scale(f.scale);
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
  }
}
