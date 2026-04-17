import { App } from './app/App';
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Missing app root');
}

try {
  root.innerHTML = '';
  const app = new App(root);
  app.start();
} catch (err) {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  root.innerHTML = `
    <div class="boot">
      <h1>3D Fish Schooling Simulator</h1>
      <p>Failed to start the simulation.</p>
      <pre class="err"></pre>
    </div>`;
  const pre = root.querySelector('pre');
  if (pre) pre.textContent = message;
  console.error(err);
}
