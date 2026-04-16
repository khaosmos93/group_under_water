import type { Vector3 } from 'three';

export type BoundaryMode = 'soft' | 'wrap';
export type InteractionMode = 'repulsion';

export interface Bounds {
  halfSize: Vector3;
}

export interface BehaviorWeights {
  separation: number;
  alignment: number;
  cohesion: number;
  obstacleAvoidance: number;
  noise: number;
}

export interface InteractionSettings {
  mode: InteractionMode;
  radius: number;
  strength: number;
  decay: number;
}

export interface SimulationParams {
  fishCount: number;
  maxSpeed: number;
  maxSteer: number;
  perceptionRadius: number;
  separationRadiusFactor: number;
  boundaryMode: BoundaryMode;
  weights: BehaviorWeights;
  interaction: InteractionSettings;
}

export type ObstacleKind = 'sphere' | 'box' | 'cylinder';

export interface BaseObstacle {
  id: string;
  kind: ObstacleKind;
  position: Vector3;
  padding: number;
  color: number;
}

export interface SphereObstacle extends BaseObstacle {
  kind: 'sphere';
  radius: number;
}

export interface BoxObstacle extends BaseObstacle {
  kind: 'box';
  size: Vector3;
}

export interface CylinderObstacle extends BaseObstacle {
  kind: 'cylinder';
  radius: number;
  height: number;
}

export type Obstacle = SphereObstacle | BoxObstacle | CylinderObstacle;

export interface DisturbancePulse {
  position: Vector3;
  createdAt: number;
}

export interface ScenePreset {
  id: string;
  label: string;
  description: string;
  fishSpreadFactor: number;
  obstacles: Obstacle[];
}

export interface DebugData {
  selectedFishIndex: number;
}
