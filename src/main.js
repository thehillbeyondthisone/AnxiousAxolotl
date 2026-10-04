import { preloadGroup } from './game/ImageRegistry.js';

async function boot() {
  const screen = document.getElementById('boot-screen');
  const status = document.getElementById('boot-status');
  const progress = document.getElementById('boot-progress');
  const retry = document.getElementById('boot-retry');
  retry.hidden = true;
  try {
    status.textContent = 'Packing Axel’s little adventure…';
    const { Game } = await import('./game/Game.js');
    await preloadGroup('core', (loaded, total) => {
      progress.max = total || 1; progress.value = loaded;
      status.textContent = `Loading pictures ${loaded}/${total}`;
    });
    if (!window.game) window.game = new Game();
    screen.remove();
  } catch (error) {
    status.textContent = error.message;
    retry.hidden = false;
    retry.onclick = boot;
  }
}
window.addEventListener('DOMContentLoaded', boot);
