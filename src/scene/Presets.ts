import { MathUtils, Vector3 } from 'three';
import type { Obstacle, ScenePreset } from '../types';

let uid = 0;
const nextId = (prefix: string): string => `${prefix}_${uid++}`;

function sphere(position: [number, number, number], radius: number, color = 0x6c8ca6): Obstacle {
  return {
    id: nextId('sphere'),
    kind: 'sphere',
    position: new Vector3(...position),
    radius,
    padding: 4,
    color
  };
}

function box(
  position: [number, number, number],
  halfSize: [number, number, number],
  color = 0x58738a
): Obstacle {
  return {
    id: nextId('box'),
    kind: 'box',
    position: new Vector3(...position),
    size: new Vector3(...halfSize),
    padding: 5,
    color
  };
}

function cylinder(
  position: [number, number, number],
  radius: number,
  height: number,
  color = 0x4f6980
): Obstacle {
  return {
    id: nextId('cylinder'),
    kind: 'cylinder',
    position: new Vector3(...position),
    radius,
    height,
    padding: 4,
    color
  };
}

// Pillars are tall, narrow cylinders.
function pillar(position: [number, number, number], radius = 5, height = 85, color = 0x4a6378): Obstacle {
  return cylinder(position, radius, height, color);
}

// A wall is a flat, wide box.
function wall(
  position: [number, number, number],
  halfSize: [number, number, number],
  color = 0x51697d
): Obstacle {
  return box(position, halfSize, color);
}

// An arch is made of two legs and a horizontal lintel, forming a gateway on the X axis.
function arch(
  centerX: number,
  centerY: number,
  z: number,
  span = 28,
  height = 34,
  thickness = 4,
  color = 0x5a7389
): Obstacle[] {
  const legHeight = height - thickness * 2;
  const half = span / 2;
  const legY = centerY - thickness - legHeight / 2;
  const topY = centerY + height / 2 - thickness;
  return [
    box([centerX - half, legY, z], [thickness, legHeight / 2, thickness], color),
    box([centerX + half, legY, z], [thickness, legHeight / 2, thickness], color),
    box([centerX, topY, z], [half + thickness, thickness, thickness], color)
  ];
}

// A tunnel is a ring of boxes forming a square cross-section corridor along the X axis.
function tunnel(
  centerX: number,
  centerY: number,
  centerZ: number,
  length = 80,
  innerHalf = 10,
  wallThickness = 3,
  color = 0x415a70
): Obstacle[] {
  const lenHalf = length / 2;
  const outerHalf = innerHalf + wallThickness;
  return [
    // top
    box([centerX, centerY + outerHalf, centerZ], [lenHalf, wallThickness, outerHalf], color),
    // bottom
    box([centerX, centerY - outerHalf, centerZ], [lenHalf, wallThickness, outerHalf], color),
    // left (-Z)
    box([centerX, centerY, centerZ - outerHalf], [lenHalf, innerHalf, wallThickness], color),
    // right (+Z)
    box([centerX, centerY, centerZ + outerHalf], [lenHalf, innerHalf, wallThickness], color)
  ];
}

// A rock-like cluster is a tight group of spheres of varying sizes.
function rockCluster(
  center: [number, number, number],
  baseRadius = 9,
  count = 6,
  spread = 8,
  seed = 1,
  color = 0x5b6670
): Obstacle[] {
  const rng = mulberry32(seed);
  const out: Obstacle[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = baseRadius * MathUtils.lerp(0.55, 1.1, rng());
    const offset: [number, number, number] = [
      (rng() - 0.5) * spread * 2,
      (rng() - 0.5) * spread,
      (rng() - 0.5) * spread * 2
    ];
    out.push(
      sphere([center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]], r, color)
    );
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PRESETS: ScenePreset[] = [
  {
    id: 'open-water',
    label: 'Open Water',
    description: 'Sparse obstacles and broad movement space.',
    fishSpreadFactor: 0.72,
    obstacles: [sphere([0, -20, 0], 10), sphere([28, 10, -18], 6, 0x738aa0)]
  },
  {
    id: 'pillar-forest',
    label: 'Pillar Forest',
    description: 'Vertical columns encourage stream splitting and regrouping.',
    fishSpreadFactor: 0.65,
    obstacles: [
      pillar([-45, 0, -30], 6, 90),
      pillar([-15, 0, -22], 5, 95),
      pillar([18, 0, -35], 7, 90),
      pillar([42, 0, -18], 5, 90),
      pillar([-32, 0, 20], 6, 95),
      pillar([-2, 0, 12], 6, 90),
      pillar([22, 0, 28], 5, 95),
      pillar([48, 0, 34], 6, 90)
    ]
  },
  {
    id: 'tunnel-passage',
    label: 'Tunnel Passage',
    description: 'A long tunnel-like channel with arches at both ends.',
    fishSpreadFactor: 0.5,
    obstacles: [
      ...tunnel(0, 0, 0, 100, 12, 4),
      ...arch(-55, 0, 0, 34, 42, 4),
      ...arch(55, 0, 0, 34, 42, 4),
      sphere([0, -5, 45], 9, 0x5f7789),
      sphere([-15, 6, -45], 7, 0x5f7789)
    ]
  },
  {
    id: 'canyon',
    label: 'Canyon',
    description: 'Tall side walls with rock clusters in the center.',
    fishSpreadFactor: 0.58,
    obstacles: [
      wall([-60, 0, 0], [8, 45, 60]),
      wall([60, 0, 0], [8, 45, 60]),
      wall([0, -42, 0], [60, 4, 60], 0x3f5365),
      ...rockCluster([-12, -10, 5], 10, 6, 10, 11),
      ...rockCluster([14, 12, -18], 9, 5, 9, 22),
      ...rockCluster([24, -6, 22], 10, 6, 11, 33)
    ]
  },
  {
    id: 'obstacle-maze',
    label: 'Obstacle Maze',
    description: 'Mixed primitives produce complex circulation and detours.',
    fishSpreadFactor: 0.6,
    obstacles: [
      wall([-35, 0, -35], [8, 26, 22]),
      wall([18, 0, -38], [6, 20, 16]),
      wall([35, 0, -2], [6, 24, 18]),
      pillar([-10, 0, 6], 8, 60),
      pillar([30, 0, 30], 7, 70),
      ...arch(0, 10, 38, 26, 36, 3),
      ...rockCluster([-38, 12, 22], 9, 5, 9, 7),
      ...rockCluster([6, -14, 24], 9, 5, 10, 19)
    ]
  }
];

export function getPresetById(id: string): ScenePreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
