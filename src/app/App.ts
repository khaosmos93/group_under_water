import { Vector3 } from 'three';
import { FishInstancer } from '../render/FishInstancer';
import { RendererFacade } from '../render/Renderer';
import { getPresetById, PRESETS } from '../scene/Presets';
import { Flock } from '../sim/Flock';
import { InteractionField } from '../sim/InteractionField';
import type { Bounds, ScenePreset, SimulationParams } from '../types';
import { ControlsPanel } from '../ui/Controls';

const bounds: Bounds = {
  halfSize: new Vector3(80, 50, 80)
};

const defaultParams: SimulationParams = {
  fishCount: 220,
  maxSpeed: 8,
  maxSteer: 0.28,
  perceptionRadius: 32,
  separationRadiusFactor: 0.28,
  boundaryMode: 'soft',
  weights: {
    // Tight separation only at close range, strong alignment and cohesion
    // so the flock polarizes and stays as a single moving body.
    separation: 1.1,
    alignment: 1.6,
    cohesion: 1.3,
    obstacleAvoidance: 3.2,
    noise: 0.04
  },
  interaction: {
    mode: 'repulsion',
    radius: 26,
    strength: 1.6,
    decay: 1.8
  }
};

export class App {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLDivElement;
  private readonly interactionField = new InteractionField();
  private readonly flock = new Flock(bounds, this.interactionField);
  private readonly renderer: RendererFacade;
  private readonly controls: ControlsPanel;

  private fishInstancer: FishInstancer;
  private params: SimulationParams = structuredClone(defaultParams);
  private preset: ScenePreset = PRESETS[0];
  private isRunning = true;
  private lastTs = performance.now();
  private fpsSmoothed = 60;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'layout';

    this.viewport = document.createElement('div');
    this.viewport.className = 'viewport';
    this.root.appendChild(this.viewport);

    this.renderer = new RendererFacade(this.viewport, bounds, (point) => {
      this.interactionField.setPulse(point, performance.now() / 1000);
    });

    this.fishInstancer = new FishInstancer(this.params.fishCount);
    this.renderer.setFishInstancer(this.fishInstancer);

    this.controls = new ControlsPanel(this.root, PRESETS, this.params, {
      onStartPause: () => {
        this.isRunning = !this.isRunning;
        this.controls.setRunning(this.isRunning);
      },
      onReset: () => this.reset(),
      onRandomizeFish: () => this.flock.randomizePositions(this.preset.fishSpreadFactor),
      onPresetChange: (id) => this.applyPreset(getPresetById(id), true),
      onParamChange: (patch) => this.updateParams(patch),
      onWeightChange: (weights) => this.updateParams({ weights: { ...this.params.weights, ...weights } }),
      onInteractionChange: (interaction) => {
        this.updateParams({ interaction: { ...this.params.interaction, ...interaction } });
        if (interaction.radius !== undefined) this.renderer.setInteractionRadius(interaction.radius);
      },
      onDebugToggle: (enabled) => this.renderer.setDebugMode(enabled)
    });

    this.applyPreset(this.preset, false);
    this.controls.setRunning(this.isRunning);
    this.renderer.setInteractionRadius(this.params.interaction.radius);

    window.addEventListener('resize', () => this.renderer.resize());
  }

  start(): void {
    const frame = (ts: number) => {
      const dt = Math.min(0.033, (ts - this.lastTs) / 1000);
      this.lastTs = ts;

      if (this.isRunning) {
        this.flock.step(dt, ts / 1000, this.params);
      }

      this.renderer.updateFish(this.flock);
      this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
      this.renderer.updateDebug(this.flock, 0, this.params.perceptionRadius, this.fpsSmoothed);
      this.renderer.render();

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  private applyPreset(preset: ScenePreset, regenerateFish: boolean): void {
    this.preset = preset;
    this.flock.setObstacles(preset.obstacles);
    this.renderer.setObstacles(preset.obstacles);

    if (regenerateFish) {
      this.reset();
    } else {
      this.flock.reset(this.params.fishCount, this.preset.fishSpreadFactor);
    }
  }

  private reset(): void {
    this.flock.reset(this.params.fishCount, this.preset.fishSpreadFactor);
  }

  private updateParams(patch: Partial<SimulationParams>): void {
    const beforeCount = this.params.fishCount;
    this.params = {
      ...this.params,
      ...patch
    };

    if (patch.fishCount !== undefined && patch.fishCount !== beforeCount) {
      this.fishInstancer.dispose();
      this.fishInstancer = new FishInstancer(this.params.fishCount);
      this.renderer.setFishInstancer(this.fishInstancer);
      this.reset();
    }
  }
}
