/** Small, readable touch shell. Does not change progression or save data. */
export class FriendlyUI {
  constructor(game) {
    this.game = game;
    this.lastState = game.state;
    this.help = document.getElementById('controls-help');
    this.more = document.getElementById('more-controls');
    this.coach = document.getElementById('play-coach');
    document.body.classList.toggle('dev-tools', new URLSearchParams(location.search).has('dev'));
    try { this.learned = localStorage.getItem('axelControlsSeen') === '1'; } catch { this.learned = false; }
    document.getElementById('btn-controls-help').addEventListener('click', () => this.openHelp());
    document.getElementById('btn-close-controls').addEventListener('click', () => this.closeHelp());
    document.getElementById('btn-pause').addEventListener('click', () => {
      if (['playing', 'minigame', 'disc'].includes(game.state)) game.openSettings();
    });
    document.getElementById('btn-minigame-back').addEventListener('click', () => {
      if (game.state === 'minigame') { game.input.reset(); game._endMinigame('cancelled'); }
    });
    // Pause while choosing from More. Restore before the existing click
    // handlers open a shop, wardrobe, or another full-screen panel.
    this.more.addEventListener('toggle', () => {
      if (this.more.open && game.state === 'playing') {
        game.input.reset();
        game.state = 'more';
      } else if (!this.more.open && game.state === 'more') {
        game.state = 'playing';
        game.lastTime = performance.now();
      }
    });
    this.more.addEventListener('click', (e) => {
      if (!e.target.closest('button')) return;
      if (game.state === 'more') game.state = 'playing';
      this.more.open = false;
    }, true);
    this.more.querySelector('summary').addEventListener('click', () => {
      // Details fires toggle asynchronously; update the pause state now so
      // the next button tap cannot race it on a fast touch screen.
      if (!this.more.open && game.state === 'playing') { game.input.reset(); game.state = 'more'; }
      else if (this.more.open && game.state === 'more') { game.state = 'playing'; game.lastTime = performance.now(); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (this.more.open && !this.more.contains(e.target)) {
        this.more.open = false;
        if (game.state === 'more') { game.state = 'playing'; game.lastTime = performance.now(); }
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && game.state === 'help') this.closeHelp();
      if (e.key === 'Escape' && this.more.open) this.more.open = false;
      if (game.state === 'help' && e.key === 'Tab') {
        e.preventDefault();
        document.getElementById('btn-close-controls').focus();
      }
    });
    // Freeze safely on backgrounding and orientation changes; never leave
    // a child dehydrating behind the rotate-device screen.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && ['playing', 'minigame', 'disc'].includes(game.state)) game.openSettings();
    });
  }

  openHelp() {
    if (!['playing', 'minigame', 'disc'].includes(this.game.state)) return;
    this.returnState = this.game.state;
    this.game.input.reset();
    this.game.state = 'help';
    this.help.classList.remove('hidden');
    document.getElementById('btn-close-controls').focus();
  }

  closeHelp() {
    this.help.classList.add('hidden');
    this.game.input.reset();
    this.game.state = this.returnState || 'playing';
    this.game.lastTime = performance.now();
    this.learned = true;
    try { localStorage.setItem('axelControlsSeen', '1'); } catch { /* session-only */ }
    document.getElementById('btn-controls-help').focus();
  }

  update() {
    const game = this.game;
    if (!this.learned && this.lastState === 'menu' && game.state === 'playing') this.openHelp();
    if (this.lastState !== game.state) {
      game.input.reset();
      this.lastState = game.state;
    }
    if (!game.input.canMove()) game.input.resetMovement();
    // The orientation prompt applies only to small portrait devices.
    if (window.matchMedia('(orientation: portrait) and (max-width: 820px)').matches && ['playing', 'minigame', 'disc'].includes(game.state)) game.openSettings();
    document.getElementById('btn-minigame-back').classList.toggle('hidden', game.state !== 'minigame');
    const button = document.getElementById('btn-action');
    if (game.state === 'playing') {
      const label = document.getElementById('btn-action-label').textContent;
      const tip = game.player.hydration < 30 ? 'Water is low! Swim to fill your blue bar.'
        : button.disabled ? 'Walk near a friend, a door, or a treasure.'
        : `Tap ${label} on the right · Let go of the stick to stop`;
      if (this.coach.textContent !== tip) this.coach.textContent = tip;
    } else if (game.state === 'minigame') {
      const tip = game.minigame?.phase === 'reel' ? 'Hold Reel to lift the bar. Let go to lower it.'
        : game.minigame?.phase === 'waiting' ? 'Wait for a bite! Then tap Reel.'
        : 'Tap the big button when the marker is in the good spot.';
      if (this.coach.textContent !== tip) this.coach.textContent = tip;
    }
  }
}
