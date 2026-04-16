import { Vector3 } from 'three';
import type { Obstacle, ScenePreset } from '../types';

function sphere(id: string, position: [number, number, number], radius: number, color = 0x6c8ca6): Obstacle {
  return {
    id,
    kind: 'sphere',
    position: new Vector3(...position),
    radius,
    padding: 4,
    color
  };
}

function box(id: string, position: [number, number, number], size: [number, number, number], color = 0x58738a): Obstacle {
  return {
    id,
    kind: 'box',
    position: new Vector3(...position),
    size: new Vector3(...size),
    padding: 5,
    color
  };
}

function cylinder(
  id: string,
  position: [number, number, number],
  radius: number,
  height: number,
  color = 0x4f6980
): Obstacle {
  return {
    id,
    kind: 'cylinder',
    position: new Vector3(...position),
    radius,
    height,
    padding: 4,
    color
  };
}

export const PRESETS: ScenePreset[] = [
  {
    id: 'open-water',
    label: 'Open Water',
    description: 'Sparse obstacles and broad movement space.',
    fishSpreadFactor: 0.72,
    obstacles: [sphere('s1', [0, -20, 0], 10)]
  },
  {
    id: 'pillar-forest',
    label: 'Pillar Forest',
    description: 'Vertical columns encourage stream splitting and regrouping.',
    fishSpreadFactor: 0.65,
    obstacles: [
      cylinder('p1', [-35, 0, -25], 7, 70),
      cylinder('p2', [-5, 0, -20], 6, 80),
      cylinder('p3', [25, 0, -30], 8, 75),
      cylinder('p4', [-22, 0, 15], 6, 70),
      cylinder('p5', [12, 0, 10], 7, 82),
      cylinder('p6', [40, 0, 28], 6, 70)
    ]
  },
  {
    id: 'tunnel-passage',
    label: 'Tunnel Passage',
    description: 'A long tunnel-like channel made from walls and arches.',
    fishSpreadFactor: 0.5,
    obstacles: [
      box('tw1', [0, -25, 0], [70, 8, 10]),
      box('tw2', [0, 25, 0], [70, 8, 10]),
      box('tw3', [0, 0, -18], [70, 18, 6]),
      sphere('ta1', [-35, 0, 16], 14),
      sphere('ta2', [0, 0, 16], 14),
      sphere('ta3', [35, 0, 16], 14)
    ]
  },
  {
    id: 'canyon',
    label: 'Canyon',
    description: 'Tall side walls with rock clusters in the center.',
    fishSpreadFactor: 0.58,
    obstacles: [
      box('c1', [-55, 0, 0], [10, 45, 55]),
      box('c2', [55, 0, 0], [10, 45, 55]),
      sphere('c3', [-10, -8, 5], 12),
      sphere('c4', [8, 14, -12], 10),
      sphere('c5', [20, -5, 20], 13)
    ]
  },
  {
    id: 'obstacle-maze',
    label: 'Obstacle Maze',
    description: 'Mixed primitives produce complex circulation and detours.',
    fishSpreadFactor: 0.6,
    obstacles: [
      box('m1', [-30, 0, -30], [8, 22, 24]),
      box('m2', [15, 0, -35], [7, 18, 18]),
      box('m3', [32, 0, -2], [6, 22, 18]),
      cylinder('m4', [-8, 0, 6], 9, 55),
      cylinder('m5', [28, 0, 30], 8, 62),
      sphere('m6', [-35, 10, 22], 11),
      sphere('m7', [0, -12, 24], 10)
    ]
  }
];

export function getPresetById(id: string): ScenePreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
