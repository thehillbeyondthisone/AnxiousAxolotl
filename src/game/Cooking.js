/**
 * Cooking minigame — two-round timing bar.
 *
 * Played at a campfire or grill with a raw fish/food item. A marker
 * sweeps back and forth across a bar; press the action button to lock it
 * in. Round 1 is "Sear", round 2 is "Flip" (faster). Final quality is
 * the worse of the two presses:
 *   perfect ×2.2 value · good ×1.5 · burnt ×0.5
 *
 * Implements the shared minigame contract used by Game.startMinigame():
 *   update(dt, held) -> sound|null, onAction(), draw(ctx, camera, player),
 *   done, result ('cooked' | 'cancelled'), plus .quality when cooked.
 */

const ROUNDS = ['SEAR', 'FLIP'];
const PERFECT_W = 0.14; // half-widths around the 0.5 center
const GOOD_W = 0.3;

export const COOK_MULT = { perfect: 2.2, good: 1.5, burnt: 0.5 };

export class CookingMinigame {
  /** @param {object} item - the backpack item being cooked (read-only here) */
  constructor(item, opts = {}) {
    this.item = item;
    this.sweetMult = opts.sweetMult || 1;
    this.round = 0;
    this.pos = 0;          // 0..1 marker position
    this.dir = 1;
    this.speed = 1.1;      // sweeps per second (round 2 is faster)
    this.t = 0;
    this.qualities = [];
    this.flash = 0;        // post-press feedback timer
    this.lastQuality = null;
    this.done = false;
    this.result = null;    // 'cooked' | 'cancelled'
    this.quality = null;   // final: 'perfect' | 'good' | 'burnt'
  }

  onAction() {
    if (this.done || this.flash > 0) return;
    const off = Math.abs(this.pos - 0.5);
    const q = off <= PERFECT_W * this.sweetMult ? 'perfect' : off <= GOOD_W * this.sweetMult ? 'good' : 'burnt';
    this.qualities.push(q);
    this.lastQuality = q;
    this.flash = 0.55;
  }

  update(dt) {
    this.t += dt;

    if (this.flash > 0) {
      // Brief pause showing the press result, then next round / finish
      this.flash -= dt;
      if (this.flash <= 0) {
        this.round++;
        if (this.round >= ROUNDS.length) {
          // Worst press decides the dish
          const rank = { burnt: 0, good: 1, perfect: 2 };
          this.quality = this.qualities.reduce((a, b) => rank[a] <= rank[b] ? a : b);
          this.done = true;
          this.result = 'cooked';
        } else {
          this.pos = 0;
          this.dir = 1;
          this.speed = 1.7; // flip round is quicker
        }
      }
      return this.flash <= 0 ? null : null;
    }

    this.pos += this.dir * this.speed * 2 * dt;
    if (this.pos > 1) { this.pos = 1; this.dir = -1; }
    if (this.pos < 0) { this.pos = 0; this.dir = 1; }
    return null;
  }

  draw(ctx, camera) {
    const barW = Math.min(420, camera.w * 0.55);
    const barH = 26;
    const x = (camera.w - barW) / 2;
    const y = camera.h - 150;

    ctx.save();

    // Panel
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2;
    const pad = 16;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x - pad, y - 52, barW + pad * 2, barH + 90, 12)
      : ctx.rect(x - pad, y - 52, barW + pad * 2, barH + 90);
    ctx.fill();
    ctx.stroke();

    // Title: round + item
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    const sizzle = Math.sin(this.t * 10) * 2;
    ctx.fillText(`🍳 ${ROUNDS[Math.min(this.round, ROUNDS.length - 1)]}!`, camera.w / 2, y - 28 + (this.flash > 0 ? 0 : sizzle * 0.5));
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 13px SproutPixel, Outfit, sans-serif';
    ctx.fillText(`${this.item.emoji} ${this.item.name}`, camera.w / 2, y - 8);

    // Bar zones: burnt | good | perfect | good | burnt
    const zone = (from, to, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + from * barW, y, (to - from) * barW, barH);
    };
    const goodW = GOOD_W * this.sweetMult, perfectW = PERFECT_W * this.sweetMult;
    zone(0, 1, 'rgba(239, 68, 68, 0.45)');                     // burnt
    zone(0.5 - goodW, 0.5 + goodW, 'rgba(250, 204, 21, 0.55)'); // good
    zone(0.5 - perfectW, 0.5 + perfectW, 'rgba(74, 222, 128, 0.8)'); // perfect
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.strokeRect(x, y, barW, barH);

    // Marker
    const mx = x + this.pos * barW;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(mx, y - 8);
    ctx.lineTo(mx - 7, y - 18);
    ctx.lineTo(mx + 7, y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(mx - 1.5, y - 8, 3, barH + 8);

    // Press feedback
    if (this.flash > 0 && this.lastQuality) {
      const label = { perfect: '✨ PERFECT!', good: '👍 Good', burnt: '🔥 Burnt...' }[this.lastQuality];
      const color = { perfect: '#4ade80', good: '#facc15', burnt: '#ef4444' }[this.lastQuality];
      ctx.font = '700 20px SproutPixel, Outfit, sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText(label, camera.w / 2, y + barH + 26);
      ctx.fillStyle = color;
      ctx.fillText(label, camera.w / 2, y + barH + 26);
    } else {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
      ctx.font = '600 12px SproutPixel, Outfit, sans-serif';
      ctx.fillText('Press Action in the green!', camera.w / 2, y + barH + 24);
    }

    ctx.restore();
  }
}
