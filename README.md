# 3D Fish Schooling Simulator

A browser-based, real-time 3D fish schooling simulator built with **TypeScript + Vite + Three.js**. Fish are rendered as instanced ellipsoids and use boids-like steering with obstacle avoidance, boundary handling, and click-driven disturbance pulses.

## Features

- Real-time 3D flocking simulation (separation, alignment, cohesion)
- Predictive obstacle avoidance against multiple obstacle types
- Soft-wall and wrap-around boundary modes
- Click interaction (repulsion pulse with distance/time decay)
- Multiple scene presets:
  - Open Water
  - Pillar Forest
  - Tunnel Passage
  - Canyon
  - Obstacle Maze
- Working control panel with simulation tuning
- Orbit camera controls (rotate, zoom, pan)
- Debug mode:
  - velocity vector (selected fish)
  - perception sphere
  - interaction marker
  - FPS readout

## Tech Stack

- TypeScript
- Vite
- Three.js
- Plain HTML/CSS UI (no frontend framework)

## Run Locally

### Requirements
- Node.js 20+ (Node.js 22 recommended)
- npm

### Commands

```bash
npm install
npm run dev
```

Then open the URL shown by Vite (typically `http://localhost:5173`).

## Run in GitHub Codespaces

1. Open the repo in Codespaces.
2. Let the devcontainer finish setup (`postCreateCommand` runs `npm install`).
3. Run:

```bash
npm run dev
```

4. Open forwarded port **5173**.

## Controls Overview

- **Start / Pause**: toggle simulation updates
- **Reset**: regenerate school for current fish count/preset
- **Randomize Fish**: reshuffle fish positions
- **Preset**: switch scene layouts
- **Fish Count**: instanced fish amount
- **Max Speed / Max Steering / Perception Radius**
- **Behavior Weights**:
  - Separation
  - Alignment
  - Cohesion
  - Obstacle Avoidance
  - Noise
- **Boundary Mode**: Soft walls or wrap-around
- **Click Interaction**:
  - Radius
  - Strength
  - Decay (seconds)
- **Debug Mode** toggle

## Click Interaction (Repulsion Pulse)

Clicking inside the viewport raycasts into the bounded water volume and creates a disturbance pulse at the hit point.

Nearby fish receive a steering force that:

- points away from the clicked point
- is strongest at close range
- decays smoothly by distance and over time
- blends with normal boids + obstacle steering (no teleporting/snapping)

The simulation architecture separates this into an `InteractionField`, making it straightforward to add future modes (attraction, food target, predator disturbance, vortex source).

## Scene Presets

Each preset defines:

- obstacle set
- initial fish spread factor
- immediate motion characteristics

Examples:

- **Open Water**: minimal obstruction
- **Pillar Forest**: many vertical columns, split/rejoin flow
- **Tunnel Passage**: constrained corridor behavior
- **Canyon**: side walls and rock clusters
- **Obstacle Maze**: mixed primitives, stronger detours

## Project Structure

```txt
.
├─ .devcontainer/devcontainer.json
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ src/
│  ├─ main.ts
│  ├─ styles.css
│  ├─ types.ts
│  ├─ app/App.ts
│  ├─ sim/
│  │  ├─ FishAgent.ts
│  │  ├─ Flock.ts
│  │  └─ InteractionField.ts
│  ├─ scene/
│  │  ├─ Obstacles.ts
│  │  └─ Presets.ts
│  ├─ render/
│  │  ├─ Renderer.ts
│  │  └─ FishInstancer.ts
│  └─ ui/Controls.ts
└─ README.md
```

## Extension Ideas

- Add click-mode dropdown (repulsion / attraction / predator / vortex)
- Add predator entities and prey response states
- Add optional spatial partitioning (uniform grid) for larger fish counts
- Add save/load for tuned parameter presets
- Add touch support and mobile-friendly control collapse
