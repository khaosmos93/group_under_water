import {
  AmbientLight,
  ArrowHelper,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WireframeGeometry
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Flock } from '../sim/Flock';
import type { Bounds, Obstacle } from '../types';
import { FishInstancer } from './FishInstancer';

const ndc = new Vector2();
const interactionPoint = new Vector3();
const boundsIntersection = new Vector3();
const raycaster = new Raycaster();
const boundsBox = new Box3();
const tmpDir = new Vector3();

export class RendererFacade {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;

  private fishInstancer: FishInstancer | null = null;
  private readonly obstaclesGroup = new Group();
  private readonly worldGroup = new Group();
  private readonly interactionMarker: Mesh;
  private readonly boundaryWire: LineSegments;
  private readonly velocityArrow: ArrowHelper;
  private readonly perceptionMarker: Mesh;
  private readonly fpsEl: HTMLElement;

  constructor(
    private readonly container: HTMLElement,
    bounds: Bounds,
    onClickPoint: (point: Vector3) => void
  ) {
    this.scene.background = new Color(0x082334);

    this.camera = new PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(150, 110, 150);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0, 0);

    const ambient = new AmbientLight(0x7ba5c0, 0.8);
    this.scene.add(ambient);

    const dir = new DirectionalLight(0xffffff, 1.2);
    dir.position.set(80, 120, 50);
    this.scene.add(dir);

    const waterFog = new Mesh(
      new BoxGeometry(bounds.halfSize.x * 2, bounds.halfSize.y * 2, bounds.halfSize.z * 2),
      new MeshStandardMaterial({
        color: 0x0a3348,
        transparent: true,
        opacity: 0.08,
        side: DoubleSide
      })
    );
    this.worldGroup.add(waterFog);

    const wireGeo = new WireframeGeometry(new BoxGeometry(bounds.halfSize.x * 2, bounds.halfSize.y * 2, bounds.halfSize.z * 2));
    this.boundaryWire = new LineSegments(wireGeo, new LineBasicMaterial({ color: 0x6fa7c7, transparent: true, opacity: 0.3 }));
    this.scene.add(this.boundaryWire);

    this.worldGroup.add(this.obstaclesGroup);
    this.scene.add(this.worldGroup);

    this.interactionMarker = new Mesh(
      new SphereGeometry(1.2, 14, 10),
      new MeshStandardMaterial({ color: 0xff7f6b, emissive: 0x4a1b15, transparent: true, opacity: 0 })
    );
    this.scene.add(this.interactionMarker);

    this.velocityArrow = new ArrowHelper(new Vector3(1, 0, 0), new Vector3(0, 0, 0), 10, 0xffd166);
    this.velocityArrow.visible = false;
    this.scene.add(this.velocityArrow);

    this.perceptionMarker = new Mesh(
      new SphereGeometry(1, 14, 10),
      new MeshStandardMaterial({ color: 0x85d9ff, wireframe: true, transparent: true, opacity: 0.2 })
    );
    this.perceptionMarker.visible = false;
    this.scene.add(this.perceptionMarker);

    boundsBox.min.set(-bounds.halfSize.x, -bounds.halfSize.y, -bounds.halfSize.z);
    boundsBox.max.set(bounds.halfSize.x, bounds.halfSize.y, bounds.halfSize.z);

    this.renderer.domElement.addEventListener('pointerdown', (ev) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, this.camera);
      const hit = raycaster.ray.intersectBox(boundsBox, boundsIntersection);
      if (hit) {
        onClickPoint(hit.clone());
        this.flashInteractionMarker(hit);
      }
    });

    this.fpsEl = document.createElement('div');
    this.fpsEl.className = 'fps';
    this.fpsEl.textContent = 'FPS --';
    this.container.appendChild(this.fpsEl);
  }

  setFishInstancer(instancer: FishInstancer): void {
    if (this.fishInstancer) this.scene.remove(this.fishInstancer.mesh);
    this.fishInstancer = instancer;
    this.scene.add(instancer.mesh);
  }

  setObstacles(obstacles: Obstacle[]): void {
    this.obstaclesGroup.clear();
    for (const obstacle of obstacles) {
      let mesh: Mesh;
      if (obstacle.kind === 'sphere') {
        mesh = new Mesh(
          new SphereGeometry(obstacle.radius, 20, 16),
          new MeshStandardMaterial({ color: obstacle.color, roughness: 0.8, metalness: 0.05 })
        );
      } else if (obstacle.kind === 'box') {
        mesh = new Mesh(
          new BoxGeometry(obstacle.size.x * 2, obstacle.size.y * 2, obstacle.size.z * 2),
          new MeshStandardMaterial({ color: obstacle.color, roughness: 0.85, metalness: 0.04 })
        );
      } else {
        mesh = new Mesh(
          new CylinderGeometry(obstacle.radius, obstacle.radius, obstacle.height, 20),
          new MeshStandardMaterial({ color: obstacle.color, roughness: 0.85, metalness: 0.05 })
        );
      }
      mesh.position.copy(obstacle.position);
      this.obstaclesGroup.add(mesh);
    }
  }

  updateFish(flock: Flock): void {
    this.fishInstancer?.update(flock.fish);
  }

  setDebugMode(enabled: boolean): void {
    this.velocityArrow.visible = enabled;
    this.perceptionMarker.visible = enabled;
    this.boundaryWire.visible = enabled;
    this.fpsEl.style.display = enabled ? 'block' : 'none';
  }

  updateDebug(flock: Flock, selectedIndex: number, perceptionRadius: number, fps: number): void {
    if (!this.velocityArrow.visible) return;
    const fish = flock.fish[selectedIndex];
    if (!fish) return;

    tmpDir.copy(fish.velocity);
    if (tmpDir.lengthSq() < 0.0001) tmpDir.set(1, 0, 0);
    else tmpDir.normalize();
    this.velocityArrow.position.copy(fish.position);
    this.velocityArrow.setDirection(tmpDir);
    this.velocityArrow.setLength(MathUtils.clamp(fish.velocity.length() * 2.2, 4, 18));

    this.perceptionMarker.position.copy(fish.position);
    this.perceptionMarker.scale.setScalar(perceptionRadius);

    this.fpsEl.textContent = `FPS ${fps.toFixed(0)}`;
  }

  setInteractionRadius(radius: number): void {
    this.interactionMarker.scale.setScalar(radius / 10);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    this.controls.dispose();
    this.renderer.dispose();
  }

  private flashInteractionMarker(point: Vector3): void {
    interactionPoint.copy(point);
    this.interactionMarker.position.copy(interactionPoint);
    const material = this.interactionMarker.material as MeshStandardMaterial;
    material.opacity = 0.85;
    const start = performance.now();
    const duration = 420;

    const tick = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        material.opacity = 0;
        return;
      }
      material.opacity = 0.85 * (1 - t);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
