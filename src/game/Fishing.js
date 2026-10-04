/**
 * Fishing minigame — Stardew-style reel-in.
 *
 * Flow: cast at a water tile ('waiting') → random delay → 'bite' (short
 * window to press the action button) → 'reel': hold the action input to
 * raise the green catch bar, release to let it fall, and keep the fish
 * inside the bar until the progress column fills. Progress empties → the
 * fish escapes.
 *
 * The Game owns one FishingMinigame instance while state === 'fishing';
 * it feeds update() a held flag and forwards action presses to onAction().
 */

import { Sprites, spriteReady, FISH_ICON_SPRITES, FISHING_SPLASH_FRAMES } from './AssetLoader.js';

export const FISH = [
  { name: 'Minnow',        emoji: '🐟', value: 8,  weight: 26, difficulty: 0.3 },
  { name: 'Perch',         emoji: '🐟', value: 14, weight: 20, difficulty: 0.45 },
  { name: 'Bluegill',      emoji: '🐠', value: 18, weight: 15, difficulty: 0.55 },
  { name: 'Bass',          emoji: '🐟', value: 26, weight: 11, difficulty: 0.7 },
  { name: 'Rainbow Trout', emoji: '🐠', value: 34, weight: 7,  difficulty: 0.85 },
  { name: 'Golden Koi',    emoji: '🎏', value: 60, weight: 3,  difficulty: 1 },
  { name: 'Old Boot',      emoji: '🥾', value: 2,  weight: 8,  difficulty: 0.1 },
  // Ultra rare — roughly a 1-in-200 catch. A trophy, not a payday: the real
  // reward is the hidden achievement + Abyssal skin it unlocks (see
  // _resolveFishing), so its cash value is deliberately modest.
  { name: 'Ancient Leviathan', emoji: '🐡', value: 75, weight: 0.5, difficulty: 1 },
];

export function fishSpriteIndex(name = '') {
  const order = ['Minnow', 'Perch', 'Bluegill', 'Bass', 'Rainbow Trout', 'Golden Koi', 'Ancient Leviathan'];
  const idx = order.indexOf(name);
  return idx < 0 ? null : idx + 1;
}

/** Weighted random pick from the fish table. */
export function rollFish(opts = {}) {
  if (opts.bigFishNearby) {
    const surge = Math.random();
    if (surge < 0.12) return { ...FISH.find(f => f.name === 'Ancient Leviathan') };
    if (surge < 0.34) return { ...FISH.find(f => f.name === 'Golden Koi') };
  }
  const total = FISH.reduce((s, f) => s + f.weight, 0);
  let roll = Math.random() * total;
  for (const f of FISH) {
    roll -= f.weight;
    if (roll <= 0) return { ...f };
  }
  return { ...FISH[0] };
}

export class FishingMinigame {
  /**
   * @param {{x:number,y:number}} spot - world position of the bobber
   * @param {object} [opts]
   * @param {number} [opts.barBonus] - Braided Line upgrade: widens the catch bar
   * @param {boolean} [opts.instantBite] - Bait consumed: skip straight to a bite
   */
  constructor(spot, opts = {}) {
    this.spot = spot;
    this.barBonus = opts.barBonus || 0;
    this.sweetMult = opts.sweetMult || 1;
    this.bigFishNearby = !!opts.bigFishNearby;
    this.done = false;
    this.result = null;     // 'caught' | 'escaped' | 'cancelled'
    this.fish = null;
    this.t = 0;             // animation clock

    if (opts.instantBite) {
      this.phase = 'bite';
      this.timer = 0.9;
    } else {
      this.phase = 'waiting'; // 'waiting' | 'bite' | 'reel'
      this.timer = 1.5 + Math.random() * 3.5;
    }

    // Reel-phase state (all positions normalized 0..1, 0 = top of track)
    this.barPos = 0.35;
    this.barVel = 0;
    this.barSize = 0.3;
    this.fishPos = 0.5;
    this.fishTarget = 0.5;
    this.fishTimer = 0;
    this.progress = 0.35;
    this.inBar = false;
  }

  /** Action press: cancel while waiting, hook the fish on a bite. */
  onAction() {
    if (this.phase === 'waiting') {
      this.done = true;
      this.result = 'cancelled';
    } else if (this.phase === 'bite') {
      this._startReel();
    }
  }

  _startReel() {
    this.phase = 'reel';
    this.fish = rollFish({ bigFishNearby: this.bigFishNearby });
    // Harder fish → smaller catch bar; Braided Line + the dev sweet-spot
    // slider both widen it back out.
    this.barSize = Math.min(0.6, (Math.max(0.16, 0.34 - this.fish.difficulty * 0.16) + this.barBonus) * this.sweetMult);
    this.barPos = 0.5 - this.barSize / 2;
    this.barVel = 0;
    this.fishPos = 0.5;
    this.fishTarget = this._pickFishTarget();
    this.fishTimer = 0;
    this.progress = 0.35;
  }

  /**
   * Skewed towards one edge of the bar more often than the middle — lets
   * the player camp near an edge instead of constantly re-centering to
   * chase a target that wanders uniformly across the whole range.
   */
  _pickFishTarget() {
    if (Math.random() < 0.7) {
      return Math.random() < 0.5 ? Math.random() * 0.25 : 1 - Math.random() * 0.25;
    }
    return Math.random();
  }

  /**
   * Advance the minigame.
   * @param {number} dt seconds
   * @param {boolean} held is the action input currently held?
   * @returns {string|null} sound name for the game to play
   */
  update(dt, held) {
    this.t += dt;

    if (this.phase === 'waiting') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'bite';
        this.timer = 0.9;
        return 'alert';
      }
    } else if (this.phase === 'bite') {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Missed the window — the fish nibbles and swims off, keep waiting
        this.phase = 'waiting';
        this.timer = 1.5 + Math.random() * 3.5;
      }
    } else if (this.phase === 'reel') {
      // Catch bar physics: hold lifts, gravity drops
      this.barVel += (held ? -3.4 : 3.0) * dt;
      this.barVel = Math.max(-1.6, Math.min(1.6, this.barVel));
      this.barPos += this.barVel * dt;
      const maxPos = 1 - this.barSize;
      if (this.barPos < 0) { this.barPos = 0; this.barVel *= -0.25; }
      if (this.barPos > maxPos) { this.barPos = maxPos; this.barVel *= -0.25; }

      // Fish wanders toward random targets, darting more when difficult
      this.fishTimer -= dt;
      if (this.fishTimer <= 0) {
        this.fishTimer = 0.5 + Math.random() * Math.max(0.3, 1.4 - this.fish.difficulty);
        this.fishTarget = this._pickFishTarget();
      }
      const chase = 0.8 + this.fish.difficulty * 2.2;
      this.fishPos += (this.fishTarget - this.fishPos) * Math.min(1, chase * dt);
      this.fishPos += (Math.random() - 0.5) * this.fish.difficulty * 0.4 * dt;
      this.fishPos = Math.max(0, Math.min(1, this.fishPos));

      // Progress fills while the fish sits inside the bar
      this.inBar = this.fishPos >= this.barPos && this.fishPos <= this.barPos + this.barSize;
      this.progress += (this.inBar ? 0.26 : -0.2) * dt;
      if (this.progress >= 1) { this.done = true; this.result = 'caught'; }
      else if (this.progress <= 0) { this.done = true; this.result = 'escaped'; }
    }
    return null;
  }

  /**
   * Draw the bobber (line + float in the water) and, during the reel
   * phase, the catch-bar panel. Screen space — call after ctx.restore().
   */
  draw(ctx, camera, player) {
    const bx = this.spot.x - camera.x;
    const by = this.spot.y - camera.y;
    const px = player.x - camera.x;
    const py = player.y - camera.y;

    ctx.save();

    // Fishing line from the axolotl to the bobber
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py - 14);
    ctx.quadraticCurveTo((px + bx) / 2, Math.min(py, by) - 26, bx, by - 4);
    ctx.stroke();

    // Bobber, bobbing
    const bob = Math.sin(this.t * 4) * 2 + (this.phase === 'bite' ? Math.sin(this.t * 40) * 3 : 0);
    const splashLife = Math.min(1, this.t * 2.8);
    const splashIndex = Math.min(FISHING_SPLASH_FRAMES.length - 1, Math.floor(splashLife * FISHING_SPLASH_FRAMES.length));
    if (spriteReady(Sprites.premiumFishingSplash) && (this.t < 0.9 || this.phase === 'bite')) {
      const s = FISHING_SPLASH_FRAMES[this.phase === 'bite'
        ? (2 + Math.floor(this.t * 10)) % FISHING_SPLASH_FRAMES.length
        : splashIndex];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Sprites.premiumFishingSplash, s.sx, s.sy, s.sw, s.sh, bx - 14, by - 6 + bob * 0.15, 28, 28);
    }
    // Ripple ring
    const rip = (this.t % 1.4) / 1.4;
    ctx.strokeStyle = `rgba(255,255,255,${(0.4 * (1 - rip)).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(bx, by + 2, 6 + rip * 16, 3 + rip * 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bx, by + bob, 5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(bx, by + bob, 5, 0, Math.PI);
    ctx.fill();

    // Status blurb above the bobber
    ctx.font = '700 20px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    if (this.phase === 'waiting') {
      const dots = '.'.repeat(1 + (Math.floor(this.t * 2) % 3));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(dots, bx, by - 16);
    } else if (this.phase === 'bite') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      const jump = Math.abs(Math.sin(this.t * 14)) * 6;
      ctx.strokeText('❗ BITE!', bx, by - 22 - jump);
      ctx.fillText('❗ BITE!', bx, by - 22 - jump);
    }

    if (this.phase === 'reel') this._drawReelPanel(ctx, camera);
    ctx.restore();
  }

  _drawReelPanel(ctx, camera) {
    // The panel lives in the top-right, same corner as the minimap, and its
    // trackW/pad footprint sits above the bottom mobile-controls cluster —
    // clear both instead of centering across the full viewport height.
    const topClearance = 270;   // minimap footprint (header + canvas + padding)
    const bottomClearance = 200; // mobile joystick/action-button cluster
    // Panel chrome: title text + top/bottom padding around the track itself
    // (was badly overestimated at 146, which shrank the bar far more than
    // the actual backdrop needs — see the backdrop rect math just below).
    const chrome = 90;
    const availPanelH = Math.max(120, camera.h - topClearance - bottomClearance);
    const trackH = Math.max(120, Math.min(300, availPanelH - chrome));
    const trackW = 36;
    const x = camera.w - 130;
    const y = topClearance + 78;

    // Panel backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2;
    const pad = 14;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x - pad, y - pad - 26, trackW + 30 + pad * 2, trackH + pad * 2 + 40, 12)
      : ctx.rect(x - pad, y - pad - 26, trackW + 30 + pad * 2, trackH + pad * 2 + 40);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 13px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎣 HOLD!', x + trackW / 2 + 15, y - 16);

    // Water track
    ctx.fillStyle = 'rgba(3, 105, 161, 0.55)';
    ctx.fillRect(x, y, trackW, trackH);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
    ctx.strokeRect(x, y, trackW, trackH);

    // Catch bar
    const barY = y + this.barPos * trackH;
    const barH = this.barSize * trackH;
    ctx.fillStyle = this.inBar ? 'rgba(74, 222, 128, 0.75)' : 'rgba(74, 222, 128, 0.4)';
    ctx.fillRect(x + 2, barY, trackW - 4, barH);
    ctx.strokeStyle = '#4ade80';
    ctx.strokeRect(x + 2, barY, trackW - 4, barH);

    const wob = Math.sin(this.t * 9) * 2;
    const fishSprite = fishSpriteIndex(this.fish?.name);
    if (fishSprite !== null && spriteReady(Sprites.premiumFish)) {
      const f = FISH_ICON_SPRITES[fishSprite % FISH_ICON_SPRITES.length];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Sprites.premiumFish, f.sx, f.sy, f.sw, f.sh,
        x + trackW / 2 - 12 + wob, y + this.fishPos * trackH - 12, 24, 24);
    } else {
      ctx.font = '20px serif';
      ctx.fillText(this.fish.emoji, x + trackW / 2 + wob, y + this.fishPos * trackH + 7);
    }

    // Progress column
    const pgX = x + trackW + 12;
    ctx.fillStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.fillRect(pgX, y, 10, trackH);
    const ph = this.progress * trackH;
    ctx.fillStyle = this.progress > 0.66 ? '#4ade80' : this.progress > 0.33 ? '#facc15' : '#ef4444';
    ctx.fillRect(pgX, y + trackH - ph, 10, ph);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.strokeRect(pgX, y, 10, trackH);
  }
}
