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

  ctx.strokeStyle = `${accent}99`;
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 62, w - 36, h - 82);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  for (let y = 68; y < h - 24; y += 4) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(w - 22, y);
    ctx.stroke();
  }

  const barH = 42;
  const barX = 24;
  const barY = 12;
  const barW = w - 48;
  const grd = ctx.createLinearGradient(barX, barY, barX, barY + barH);
  grd.addColorStop(0, 'rgba(255, 241, 200, 0.94)');
  grd.addColorStop(1, 'rgba(245, 210, 198, 0.86)');
  ctx.fillStyle = grd;
  ctx.strokeStyle = 'rgba(109, 66, 60, 0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `${accent}55`;
  ctx.beginPath();
  ctx.roundRect(barX + 10, barY + 8, 26, 26, 10);
  ctx.fill();
  ctx.fillStyle = '#3b2724';
  ctx.font = '800 17px SproutPixel, Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title || 'DISC GAME', barX + 46, barY + barH / 2 + 1);
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
