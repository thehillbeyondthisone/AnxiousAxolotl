import { findDisc } from './DiscCatalog.js';

export function drawScreenFrame(ctx, w, h, title, accent, help) {
  ctx.save();
  ctx.fillStyle = '#050816';
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.45, Math.max(w, h) * 0.7);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = `${accent}cc`;
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  for (let y = 24; y < h - 24; y += 4) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(w - 22, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 22px SproutPixel, Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, 34, 34);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 12px SproutPixel, Outfit, sans-serif';
  ctx.fillText(help, 34, h - 46);
  ctx.restore();
}

export class DiscBase {
  constructor(id, progress) {
    this.id = id;
    this.meta = findDisc(id);
    this.progress = progress || {};
    this.done = false;
    this.exitRequested = false;
    this.result = null;
  }

  serialize() {
    return { ...this.progress };
  }

  onAction() {
    if (this.done) this.exitRequested = true;
  }
}
