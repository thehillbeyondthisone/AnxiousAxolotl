import { DiscBase, drawScreenFrame } from './DiscBase.js';
import { DISC_CATALOG, findDisc } from './DiscCatalog.js';
import { CozyCatRoomDisc } from './CozyCatRoom.js';

export function createDiscExperience(id, progress = {}) {
  if (id === 'deep_channel') return new DeepChannelDisc(progress);
  if (id === 'office_98') return new Office98Disc(progress);
  if (id === 'cozy_cat_room') return new CozyCatRoomDisc(progress);
  return new PondSkaterDisc(progress);
}

function keyDown(keys, ...names) {
  return names.some((name) => !!keys[name]);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

class PondSkaterDisc extends DiscBase {
  constructor(progress) {
    super('pond_skater', progress);
    this.best = Number(progress.best || 0);
    this.reset();
  }

  reset() {
    this.x = 0.5;
    this.y = 0.68;
    this.vx = 0;
    this.vy = 0;
    this.score = 0;
    this.time = 45;
    this.lives = 3;
    this.motes = [];
    this.junk = [];
    this.spawnMote = 0;
    this.spawnJunk = 0.6;
    this.dash = 0;
    this.done = false;
    this.exitRequested = false;
    this.result = null;
  }

  update(dt, keys, screen) {
    if (this.done) return;
    const w = screen.w;
    const h = screen.h;
    const ax = (keyDown(keys, 'a', 'arrowleft') ? -1 : 0) + (keyDown(keys, 'd', 'arrowright') ? 1 : 0);
    const ay = (keyDown(keys, 'w', 'arrowup') ? -1 : 0) + (keyDown(keys, 's', 'arrowdown') ? 1 : 0);
    const speed = this.dash > 0 ? 1.25 : 0.72;
    this.vx = ax * speed;
    this.vy = ay * speed;
    this.x = clamp(this.x + this.vx * dt, 0.08, 0.92);
    this.y = clamp(this.y + this.vy * dt, 0.18, 0.88);
    this.dash = Math.max(0, this.dash - dt);

    this.spawnMote -= dt;
    if (this.spawnMote <= 0) {
      this.spawnMote = 0.45 + Math.random() * 0.55;
      this.motes.push({ x: 0.08 + Math.random() * 0.84, y: 0.2 + Math.random() * 0.64, r: 9, t: 8 });
    }

    this.spawnJunk -= dt;
    if (this.spawnJunk <= 0) {
      this.spawnJunk = Math.max(0.35, 1.15 - this.score * 0.012);
      this.junk.push({
        x: Math.random() < 0.5 ? -0.04 : 1.04,
        y: 0.22 + Math.random() * 0.62,
        vx: Math.random() < 0.5 ? 0.28 + Math.random() * 0.28 : -0.28 - Math.random() * 0.28,
        r: 13,
      });
    }

    const px = this.x * w;
    const py = this.y * h;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.motes.splice(i, 1);
        continue;
      }
      if (Math.hypot(px - m.x * w, py - m.y * h) < 24) {
        this.score += 5;
        this.motes.splice(i, 1);
      }
    }

    for (let i = this.junk.length - 1; i >= 0; i--) {
      const j = this.junk[i];
      j.x += j.vx * dt;
      if (j.x < -0.08 || j.x > 1.08) {
        this.junk.splice(i, 1);
        continue;
      }
      if (Math.hypot(px - j.x * w, py - j.y * h) < 25) {
        this.lives--;
        this.junk.splice(i, 1);
        if (this.lives <= 0) this.finish();
      }
    }

    this.time -= dt;
    if (this.time <= 0) this.finish();
  }

  onAction() {
    if (this.done) {
      this.exitRequested = true;
      return;
    }
    this.dash = 0.22;
  }

  finish() {
    if (this.done) return;
    const oldBest = this.best;
    this.best = Math.max(this.best, this.score);
    const rewardPebbles = Math.max(0, Math.min(45, this.best - oldBest));
    this.done = true;
    this.result = {
      score: this.score,
      rewardPebbles,
      message: rewardPebbles > 0 ? `New high score: ${this.best}` : `Score: ${this.score}`,
    };
  }

  serialize() {
    return { best: this.best };
  }

  draw(ctx, screen) {
    const w = screen.w;
    const h = screen.h;
    drawScreenFrame(ctx, w, h, 'POND SKATER', this.meta.accent, this.done ? 'Action: return to desktop' : 'WASD/Arrows: skate    Action: dash');

    ctx.save();
    ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.56, w * 0.42, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    for (const m of this.motes) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const j of this.junk) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(j.x * w - 14, j.y * h - 10, 28, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#fecaca';
      ctx.fillRect(j.x * w - 7, j.y * h - 3, 14, 4);
    }

    const px = this.x * w;
    const py = this.y * h;
    ctx.fillStyle = this.dash > 0 ? '#fef08a' : '#67e8f9';
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 7, py - 3, 14, 6);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Score ${this.score}`, w - 34, 36);
    ctx.fillText(`Best ${this.best}`, w - 34, 58);
    ctx.fillText(`Time ${Math.max(0, Math.ceil(this.time))}`, w - 34, 80);
    ctx.fillText(`Lives ${this.lives}`, w - 34, 102);

    if (this.done) this.drawResult(ctx, w, h);
    ctx.restore();
  }

  drawResult(ctx, w, h) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 180, h / 2 - 78, 360, 156, 14);
    ctx.fill();
    ctx.strokeStyle = this.meta.accent;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RUN COMPLETE', w / 2, h / 2 - 44);
    ctx.font = '700 14px SproutPixel, Outfit, sans-serif';
    ctx.fillText(this.result.message, w / 2, h / 2 - 10);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Payout: ${this.result.rewardPebbles} Pebbles`, w / 2, h / 2 + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press Action to eject', w / 2, h / 2 + 52);
  }
}

class DeepChannelDisc extends DiscBase {
  constructor(progress) {
    super('deep_channel', progress);
    this.completed = !!progress.completed;
    this.x = 0.5;
    this.y = 0.5;
    this.fragments = Array.from({ length: 5 }, (_, i) => ({
      x: 0.18 + ((i * 0.19) % 0.68),
      y: 0.22 + ((i * 0.27) % 0.58),
      found: false,
    }));
    this.found = 0;
    this.timer = 0;
  }

  update(dt, keys, screen) {
    if (this.done) return;
    this.timer += dt;
    const ax = (keyDown(keys, 'a', 'arrowleft') ? -1 : 0) + (keyDown(keys, 'd', 'arrowright') ? 1 : 0);
    const ay = (keyDown(keys, 'w', 'arrowup') ? -1 : 0) + (keyDown(keys, 's', 'arrowdown') ? 1 : 0);
    this.x = clamp(this.x + ax * 0.26 * dt, 0.08, 0.92);
    this.y = clamp(this.y + ay * 0.26 * dt, 0.16, 0.86);
    const px = this.x * screen.w;
    const py = this.y * screen.h;
    for (const f of this.fragments) {
      if (f.found) continue;
      if (Math.hypot(px - f.x * screen.w, py - f.y * screen.h) < 30) {
        f.found = true;
        this.found++;
      }
    }
    if (this.found >= this.fragments.length) this.finish();
  }

  finish() {
    const firstClear = !this.completed;
    this.completed = true;
    this.done = true;
    this.result = {
      score: this.found,
      rewardPebbles: firstClear ? 35 : 5,
      message: firstClear ? 'Signal archive restored.' : 'Archive revisited.',
    };
  }

  serialize() {
    return { completed: this.completed };
  }

  draw(ctx, screen) {
    const w = screen.w;
    const h = screen.h;
    drawScreenFrame(ctx, w, h, 'DEEP CHANNEL', this.meta.accent, this.done ? 'Action: return to desktop' : 'WASD/Arrows: drift through the signal');
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const x = ((i * 97 + this.timer * 18) % w);
      const y = 90 + ((i * 53 + Math.sin(this.timer + i) * 40) % (h - 160));
      ctx.fillStyle = `rgba(94, 234, 212, ${0.08 + (i % 5) * 0.03})`;
      ctx.beginPath();
      ctx.arc(x, y, 4 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const f of this.fragments) {
      if (f.found) continue;
      const pulse = 8 + Math.sin(this.timer * 4 + f.x * 10) * 3;
      ctx.strokeStyle = '#ccfbf1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x * w, f.y * h, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    const px = this.x * w;
    const py = this.y * h;
    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.moveTo(px, py - 18);
    ctx.lineTo(px + 16, py + 12);
    ctx.lineTo(px - 16, py + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Fragments ${this.found}/5`, w - 34, 36);
    if (this.done) this.drawResult(ctx, w, h);
    ctx.restore();
  }

  drawResult(ctx, w, h) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 190, h / 2 - 74, 380, 148, 14);
    ctx.fill();
    ctx.strokeStyle = this.meta.accent;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.result.message, w / 2, h / 2 - 24);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Payout: ${this.result.rewardPebbles} Pebbles`, w / 2, h / 2 + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press Action to eject', w / 2, h / 2 + 44);
  }
}

class Office98Disc extends DiscBase {
  constructor(progress) {
    super('office_98', progress);
    this.best = Number(progress.best || 0);
    this.marker = 0;
    this.dir = 1;
    this.forms = 0;
    this.errors = 0;
    this.score = 0;
    this.target = this.rollTarget();
  }

  rollTarget() {
    const start = 0.22 + Math.random() * 0.46;
    return { start, end: start + 0.12 };
  }

  update(dt) {
    if (this.done) return;
    this.marker += this.dir * dt * (0.62 + this.forms * 0.035);
    if (this.marker > 1) {
      this.marker = 1;
      this.dir = -1;
    } else if (this.marker < 0) {
      this.marker = 0;
      this.dir = 1;
    }
  }

  onAction() {
    if (this.done) {
      this.exitRequested = true;
      return;
    }
    const hit = this.marker >= this.target.start && this.marker <= this.target.end;
    this.forms++;
    if (hit) this.score += 12 + this.forms * 2;
    else this.errors++;
    if (this.forms >= 10 || this.errors >= 4) this.finish();
    else this.target = this.rollTarget();
  }

  finish() {
    const oldBest = this.best;
    this.best = Math.max(this.best, this.score);
    const rewardPebbles = Math.max(0, Math.min(55, Math.ceil((this.best - oldBest) / 2)));
    this.done = true;
    this.result = {
      score: this.score,
      rewardPebbles,
      message: this.errors >= 4 ? 'The copier won this round.' : 'Shift complete.',
    };
  }

  serialize() {
    return { best: this.best };
  }

  draw(ctx, screen) {
    const w = screen.w;
    const h = screen.h;
    drawScreenFrame(ctx, w, h, 'OFFICE SIMULATOR 98', this.meta.accent, this.done ? 'Action: return to desktop' : 'Action: stamp inside the green approval band');
    ctx.save();
    const deskX = w / 2 - 220;
    const deskY = h / 2 - 26;
    const deskW = 440;
    const deskH = 52;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('URGENT APPROVAL FORM', w / 2, deskY - 58);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(deskX, deskY, deskW, deskH, 10);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(deskX + this.target.start * deskW, deskY, (this.target.end - this.target.start) * deskW, deskH);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(deskX + this.marker * deskW - 4, deskY - 10, 8, deskH + 20);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'right';
    ctx.fillText(`Forms ${this.forms}/10`, w - 34, 36);
    ctx.fillText(`Errors ${this.errors}/4`, w - 34, 58);
    ctx.fillText(`Score ${this.score}`, w - 34, 80);
    ctx.fillText(`Best ${this.best}`, w - 34, 102);
    if (this.done) this.drawResult(ctx, w, h);
    ctx.restore();
  }

  drawResult(ctx, w, h) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 185, h / 2 - 76, 370, 152, 14);
    ctx.fill();
    ctx.strokeStyle = this.meta.accent;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.result.message, w / 2, h / 2 - 30);
    ctx.fillText(`Score: ${this.score}`, w / 2, h / 2 - 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Payout: ${this.result.rewardPebbles} Pebbles`, w / 2, h / 2 + 26);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press Action to eject', w / 2, h / 2 + 54);
  }
}
