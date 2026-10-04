/**
 * Lockpicking minigame — sweeping-pin timing.
 *
 * A pointer sweeps around a dial; press the action button while it's
 * inside the highlighted wedge to set a pin. Three pins open the lock,
 * and each pin's wedge is smaller and the sweep faster. One miss snaps
 * the lockpick.
 *
 * Implements the shared minigame contract used by Game.startMinigame():
 *   update(dt, held) -> sound|null, onAction(), draw(ctx, camera, player),
 *   done, result ('open' | 'broken' | 'cancelled').
 */

const PIN_COUNT = 3;

export class LockpickMinigame {
  constructor(opts = {}) {
    this.sweetMult = opts.sweetMult || 1;
    this.pin = 0;          // current pin index (0..PIN_COUNT-1)
    this.angle = -Math.PI / 2;
    this.t = 0;
    this.flash = 0;        // pause after a successful pin
    this.done = false;
    this.result = null;    // 'open' | 'broken' | 'cancelled'
    this._newWedge();
  }

  _newWedge() {
    // Wedge shrinks and the sweep speeds up with each pin; the dev
    // sweet-spot slider scales the wedge back up (or down), clamped so it
    // never grows into an easy full circle.
    this.wedgeSize = Math.min(2.4, (1.1 - this.pin * 0.28) * this.sweetMult); // radians
    this.speed = 2.4 + this.pin * 0.9;                   // radians/sec
    // Place the wedge away from the pointer's current position
    this.wedgeAt = this.angle + Math.PI / 2 + Math.random() * Math.PI;
  }

  _inWedge() {
    // Normalized angular distance pointer→wedge center
    let d = (this.angle - this.wedgeAt) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) <= this.wedgeSize / 2;
  }

  onAction() {
    if (this.done || this.flash > 0) return;
    if (this._inWedge()) {
      this.pin++;
      if (this.pin >= PIN_COUNT) {
        this.done = true;
        this.result = 'open';
      } else {
        this.flash = 0.35;
        this._newWedge();
      }
    } else {
      // Snap! The pick breaks.
      this.done = true;
      this.result = 'broken';
    }
  }

  update(dt) {
    this.t += dt;
    if (this.flash > 0) { this.flash -= dt; return this.flash <= 0 ? null : null; }
    this.angle += this.speed * dt;
    return null;
  }

  draw(ctx, camera) {
    const cx = camera.w / 2;
    const cy = camera.h / 2;
    const R = 74;

    ctx.save();

    // Panel
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(cx - R - 34, cy - R - 60, (R + 34) * 2, (R + 60) + R + 48, 14)
      : ctx.rect(cx - R - 34, cy - R - 60, (R + 34) * 2, (R + 60) + R + 48);
    ctx.fill();
    ctx.stroke();

    // Title + pins done
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.fillText('🗝️ Pick the lock!', cx, cy - R - 34);
    ctx.font = '600 14px SproutPixel, Outfit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    let pips = '';
    for (let i = 0; i < PIN_COUNT; i++) pips += i < this.pin ? '🔓' : '🔒';
    ctx.fillText(pips, cx, cy - R - 14);

    // Dial
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Target wedge (glows while the pointer is inside)
    const hot = this._inWedge();
    ctx.strokeStyle = hot ? '#4ade80' : 'rgba(74, 222, 128, 0.55)';
    ctx.lineWidth = hot ? 14 : 10;
    ctx.beginPath();
    ctx.arc(cx, cy, R, this.wedgeAt - this.wedgeSize / 2, this.wedgeAt + this.wedgeSize / 2);
    ctx.stroke();

    // Sweeping pointer
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(this.angle) * (R - 16), cy + Math.sin(this.angle) * (R - 16));
    ctx.lineTo(cx + Math.cos(this.angle) * (R + 12), cy + Math.sin(this.angle) * (R + 12));
    ctx.stroke();

    // Keyhole center
    ctx.fillStyle = '#fbbf24';
    ctx.font = '26px serif';
    ctx.fillText('🔒', cx, cy + 9);

    // Hint
    ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.font = '600 12px SproutPixel, Outfit, sans-serif';
    ctx.fillText('Press Action in the green — miss and the pick snaps!', cx, cy + R + 30);

    ctx.restore();
  }
}
