/**
 * Minigame orchestration — extracted from Game.js as a prototype mixin.
 *
 * The minigame *engines* live in Fishing.js / Cooking.js / Lockpicking.js;
 * this module holds the Game-side glue: the generic start/update/teardown
 * plumbing plus the fishing/cooking starters and the fishing/cooking/
 * lockpick resolvers. Methods run with `this` bound to the Game instance
 * (Object.assign'd onto Game.prototype). Pure move — no behavior change.
 *
 * The world-query for the cook spot (_findCookSpot) stays in Game.js
 * alongside the other cabin/decor finders it sits with.
 */

import { FishingMinigame } from './Fishing.js';
import { CookingMinigame, COOK_MULT } from './Cooking.js';

export const MinigameMethods = {
  _findFishingSpot() {
    if (!this.player.hasRod || this.world.isInterior || this.player.isHiding) return null;
    const isWater = (t) => t === this.world.TILE_LAKE || t === this.world.TILE_POOL;
    if (isWater(this.world.getTileAt(this.player.x, this.player.y))) return null; // must stand on shore
    // Prefer casting the way the player faces, then sweep around
    const reach = 52;
    const angles = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, Math.PI].map(a => this.player.angle + a);
    for (const a of angles) {
      const x = this.player.x + Math.cos(a) * reach;
      const y = this.player.y + Math.sin(a) * reach;
      if (isWater(this.world.getTileAt(x, y))) return { x, y };
    }
    return null;
  },

  /** === Generic minigame plumbing ===
   * Freeze the world, hand the action button to the minigame, and call
   * onDone(minigame) once it finishes. New minigames only need the shared
   * contract plus a starter + resolver pair like fishing/cooking below.
   */
  startMinigame(minigame, onDone, { actionLabel = 'Go', actionIcon = '🎯' } = {}) {
    this.state = 'minigame';
    this.minigame = minigame;
    this._onMinigameDone = onDone;
    this.player.isHiding = false;
    this.input.reset();
    const actionBtn = document.getElementById('btn-action');
    actionBtn.disabled = false;
    actionBtn.classList.remove('hidden');
    document.getElementById('btn-action-label').innerText = actionLabel;
    document.getElementById('btn-action-icon').innerText = actionIcon;
  },

  /** Advance the active minigame; resolve it when done. */
  updateMinigame(dt) {
    const mg = this.minigame;
    if (!mg) { this.state = 'playing'; return; }

    const held = !!(this.input.keys[' '] || this.input.keys['e'] || this.input.actionHeld);
    const sound = mg.update(dt, held);
    if (sound) this.playSound(sound);

    if (!mg.done) return;
    this._endMinigame();
  },

  /** Tear down the active minigame and invoke its resolver. */
  _endMinigame(forcedResult = null) {
    const mg = this.minigame;
    const onDone = this._onMinigameDone;
    this.minigame = null;
    this._onMinigameDone = null;
    this.state = 'playing';
    this.lastTime = performance.now();
    if (mg && forcedResult) mg.result = forcedResult;
    if (mg && onDone) onDone(mg);
    this.updateHUD();
  },

  /** Begin the fishing minigame: cast the bobber at a water tile. */
  startFishing(spot) {
    this.playSound('splash');
    this.spawnBurst(spot.x, spot.y, 'rgba(125, 211, 252, ALPHA)', 8);

    // Tackle upgrades from the Fish Market apply to every cast
    const opts = { sweetMult: this.devSweetSpotMult };
    if (this.world.getRareFishAt?.(spot.x, spot.y)) opts.bigFishNearby = true;
    if (this.player.hasSturdyLine) opts.barBonus = 0.1;
    if (this.player.baitCharges > 0) {
      opts.instantBite = true;
      this.player.baitCharges--;
      this.spawnFloater(this.player.x, this.player.y - 24, '🪱 Bait used!', '#a3e635');
      this.saveProfile();
    }

    this.startMinigame(new FishingMinigame(spot, opts), (f) => this._resolveFishing(f),
      { actionLabel: 'Reel', actionIcon: '🎣' });
  },

  _resolveFishing(f) {
    if (f.result === 'caught') {
      this.stats.fishCaught++;
      const fish = { name: f.fish.name, type: 'fish', value: f.fish.value, emoji: f.fish.emoji, isFish: true };
      this.playSound('sell');
      this.spawnBurst(this.player.x, this.player.y - 10, 'rgba(56, 189, 248, ALPHA)', 12);
      this.spawnFloater(this.player.x, this.player.y - 30, `+ ${fish.name} ${fish.emoji}`, '#7dd3fc');
      this.questEvent('fish');
      if (f.fish.name === 'Ancient Leviathan') {
        this.stats.leviathanCaught++;
        this.spawnBurst(this.player.x, this.player.y - 10, 'rgba(94, 234, 212, ALPHA)', 24);
        this.spawnFloater(this.player.x, this.player.y - 46, '🏆 LEGENDARY CATCH!', '#5eead4');
      }
      if (!this.player.addItem(fish)) {
        this.world.items.push({
          x: this.player.x + (Math.random() - 0.5) * 50,
          y: this.player.y + 30, radius: 10, ...fish
        });
        this._notifyBackpackFull('Your catch flopped onto the ground.');
      } else {
        this.showAlert(`🎣 Caught a ${fish.name}! Worth ${fish.value} Pebbles at the rat.`);
      }
    } else if (f.result === 'escaped') {
      this.playSound('ui');
      this.showAlert('🐟 It got away...');
    }
  },

  /** Lockpicking outcome: open the chest or snap the pick. */
  _resolveLockpick(mg, container) {
    if (mg.result === 'open') {
      this.player.tools.lockpick--;
      container.locked = false;
      this.stats.locksOpened++;
      this.playSound('upgrade');
      this.spawnBurst(container.x + container.w / 2, container.y + container.h / 2,
        'rgba(251, 191, 36, ALPHA)', 10);
      this.showAlert('🔓 Click! The lock pops open — search it!');
    } else if (mg.result === 'broken') {
      this.player.tools.lockpick--;
      this.stats.locksBroken++;
      this.playSound('caught');
      this.triggerScreenShake(3, 0.25);
      this.showAlert('💥 SNAP! Your lockpick broke. Buy another at the Shop.');
    }
    // cancelled: keep the pick, walk away
  },

  _findCookable() {
    const idx = this.player.items.findIndex(i =>
      !i.cooked && (i.type === 'fish' || i.type === 'food'));
    return idx >= 0 ? { idx, item: this.player.items[idx] } : null;
  },

  /** Begin cooking the first raw item in the backpack at a campfire. */
  startCooking() {
    const c = this._findCookable();
    if (!c) {
      this.showAlert('🍳 Nothing raw to cook! Catch a fish or grab some food.');
      return;
    }
    this.playSound('ui');
    this.startMinigame(new CookingMinigame(c.item, { sweetMult: this.devSweetSpotMult }), (mg) => this._resolveCooking(mg, c.idx),
      { actionLabel: 'Cook', actionIcon: '🍳' });
  },

  /** Cooking outcome: swap one raw unit for its cooked (or burnt) version. */
  _resolveCooking(mg, idx) {
    if (mg.result !== 'cooked') return; // cancelled — item untouched
    const raw = this.player.removeItem(idx, 1); // takes exactly 1 unit off the raw stack
    if (!raw) return;
    const mult = COOK_MULT[mg.quality] || 1;
    const burnt = mg.quality === 'burnt';
    const cooked = {
      ...raw,
      name: `${burnt ? 'Burnt' : 'Cooked'} ${raw.name}`,
      type: 'food', // cooked fish becomes edible
      cooked: true,
      value: Math.max(1, Math.round(raw.value * mult)),
    };
    delete cooked.qty;
    if (!this.player.addItem(cooked)) {
      this.player.addItem(raw); // no room for the cooked result — hand the raw unit back
      this._notifyBackpackFull('No room for the cooked dish.');
      return;
    }
    this.stats.dishesCooked++;
    if (mg.quality === 'perfect') this.stats.perfectDishes++;
    this.questEvent('cook');
    if (mg.quality === 'perfect') {
      this.playSound('sell');
      this.spawnFloater(this.player.x, this.player.y - 30, '✨ Perfect dish!', '#4ade80');
    } else if (mg.quality === 'good') {
      this.playSound('collect');
      this.spawnFloater(this.player.x, this.player.y - 30, '🍳 Nicely cooked', '#facc15');
    } else {
      this.playSound('ui');
      this.spawnFloater(this.player.x, this.player.y - 30, '🔥 Burnt...', '#ef4444');
    }
    this.showAlert(`🍳 ${cooked.name} — now worth ${cooked.value} Pebbles.`);
  },
};
