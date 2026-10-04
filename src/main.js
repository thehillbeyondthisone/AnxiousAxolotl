import { Game } from './game/Game.js';

// Initialize the game when page is ready
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  // Exposed for debugging/automated verification.
  window.game = game;
});
