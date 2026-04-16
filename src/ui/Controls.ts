import type { BoundaryMode, ScenePreset, SimulationParams } from '../types';

interface ControlCallbacks {
  onStartPause: () => void;
  onReset: () => void;
  onRandomizeFish: () => void;
  onPresetChange: (id: string) => void;
  onParamChange: (patch: Partial<SimulationParams>) => void;
  onWeightChange: (weights: Partial<SimulationParams['weights']>) => void;
  onInteractionChange: (interaction: Partial<SimulationParams['interaction']>) => void;
  onDebugToggle: (enabled: boolean) => void;
}

export class ControlsPanel {
  private readonly root: HTMLDivElement;
  private readonly startPauseButton: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    presets: ScenePreset[],
    params: SimulationParams,
    callbacks: ControlCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.className = 'controls';
    container.appendChild(this.root);

    this.startPauseButton = this.button('Pause', callbacks.onStartPause);
    this.button('Reset', callbacks.onReset);
    this.button('Randomize Fish', callbacks.onRandomizeFish);

    this.select('Preset', presets.map((p) => ({ value: p.id, label: p.label })), presets[0].id, (v) => callbacks.onPresetChange(v));

    this.number('Fish Count', params.fishCount, 20, 600, 1, (value) => callbacks.onParamChange({ fishCount: value }));
    this.number('Max Speed', params.maxSpeed, 0.5, 20, 0.1, (value) => callbacks.onParamChange({ maxSpeed: value }));
    this.number('Max Steering', params.maxSteer, 0.01, 2, 0.01, (value) => callbacks.onParamChange({ maxSteer: value }));
    this.number('Perception Radius', params.perceptionRadius, 5, 80, 1, (value) => callbacks.onParamChange({ perceptionRadius: value }));

    this.number('Separation Weight', params.weights.separation, 0, 5, 0.05, (value) => callbacks.onWeightChange({ separation: value }));
    this.number('Alignment Weight', params.weights.alignment, 0, 5, 0.05, (value) => callbacks.onWeightChange({ alignment: value }));
    this.number('Cohesion Weight', params.weights.cohesion, 0, 5, 0.05, (value) => callbacks.onWeightChange({ cohesion: value }));
    this.number('Obstacle Avoid Weight', params.weights.obstacleAvoidance, 0, 8, 0.05, (value) => callbacks.onWeightChange({ obstacleAvoidance: value }));
    this.number('Noise Strength', params.weights.noise, 0, 1, 0.01, (value) => callbacks.onWeightChange({ noise: value }));

    this.select(
      'Boundary Mode',
      [
        { value: 'soft', label: 'Soft walls' },
        { value: 'wrap', label: 'Wrap-around' }
      ],
      params.boundaryMode,
      (value) => callbacks.onParamChange({ boundaryMode: value as BoundaryMode })
    );

    this.number('Click Radius', params.interaction.radius, 5, 90, 1, (value) => callbacks.onInteractionChange({ radius: value }));
    this.number('Click Strength', params.interaction.strength, 0.05, 3, 0.05, (value) => callbacks.onInteractionChange({ strength: value }));
    this.number('Click Decay (s)', params.interaction.decay, 0.1, 8, 0.1, (value) => callbacks.onInteractionChange({ decay: value }));

    this.checkbox('Debug Mode', false, callbacks.onDebugToggle);
  }

  setRunning(isRunning: boolean): void {
    this.startPauseButton.textContent = isRunning ? 'Pause' : 'Start';
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    this.root.appendChild(button);
    return button;
  }

  private number(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onInput: (value: number) => void
  ): void {
    const wrapper = document.createElement('label');
    wrapper.className = 'control-row';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const readout = document.createElement('output');
    readout.textContent = String(value);

    input.addEventListener('input', () => {
      const parsed = Number(input.value);
      readout.textContent = parsed.toFixed(step < 1 ? 2 : 0);
      onInput(parsed);
    });

    wrapper.append(span, input, readout);
    this.root.appendChild(wrapper);
  }

  private select(
    label: string,
    options: Array<{ value: string; label: string }>,
    selected: string,
    onChange: (value: string) => void
  ): void {
    const wrapper = document.createElement('label');
    wrapper.className = 'control-row';
    const span = document.createElement('span');
    span.textContent = label;
    const select = document.createElement('select');
    for (const option of options) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === selected) node.selected = true;
      select.appendChild(node);
    }
    select.addEventListener('change', () => onChange(select.value));
    wrapper.append(span, select);
    this.root.appendChild(wrapper);
  }

  private checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): void {
    const wrapper = document.createElement('label');
    wrapper.className = 'control-row checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const span = document.createElement('span');
    span.textContent = label;
    wrapper.append(input, span);
    this.root.appendChild(wrapper);
  }
}
