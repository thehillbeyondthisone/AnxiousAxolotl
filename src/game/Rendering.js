/** Game prototype methods, extracted without changing their receiver. */
import { Player } from './Player.js';
import { World } from './World.js';

export const RenderingMethods = {
  drawFloaters(ctx) {
    if (!this.floaters.length) return;
    ctx.save();
    ctx.font = '700 15px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    this.floaters.forEach(f => {
      const a = Math.min(1, f.life / (f.maxLife * 0.5));
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.restore();
  },

  drawSpeechBubble(ctx, x, y, text) {
    ctx.save();
    const padding = 6;
    const textW = ctx.measureText(text).width;
    const boxW = Math.max(textW + padding * 2, 40);
    const boxH = 20;
    const bx = x - boxW / 2;
    const by = y - boxH - 8;
    const r = 4;
    // White bubble with black outline (use rect + circles for roundRect polyfill)
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + boxW - r, by);
    ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
    ctx.lineTo(bx + boxW, by + boxH - r);
    ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
    ctx.lineTo(bx + r, by + boxH);
    ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 8);
    ctx.lineTo(x + 6, y - 8);
    ctx.lineTo(x, y);
    ctx.fill();
    ctx.stroke();
    // Text
    ctx.fillStyle = '#000';
    ctx.font = '700 12px SproutPixel, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - boxH - 2);
    ctx.restore();
  },

  drawParticles(ctx) {
    this.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color.replace('ALPHA', alpha.toFixed(2));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  drawUnderwater() {
    if (!this.world.isFlooded && !this.player.isDiving) return;
    const ctx = this.ctx;
    const w = this.camera.w, h = this.camera.h;
    const diving = this.player.isDiving;

    // Cool blue depth tint, slightly darker toward the top (deeper). The
    // open-ocean dive goes darker/more saturated than the flooded cabin —
    // it should read as "real depth", not just a submerged room.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (diving) {
      grad.addColorStop(0, 'rgba(2, 24, 54, 0.52)');
      grad.addColorStop(1, 'rgba(8, 90, 138, 0.30)');
    } else {
      grad.addColorStop(0, 'rgba(8, 47, 89, 0.42)');
      grad.addColorStop(1, 'rgba(14, 116, 168, 0.24)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Low-oxygen warning: a pulsing red edge-tint that intensifies as the
    // tank empties, so panic reads visually before the HUD number matters.
    if (diving && this.player.oxygen < 10) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 140);
      const urgency = 1 - this.player.oxygen / 10;
      const cx = w / 2, cy = h / 2;
      const rg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, Math.max(w, h) * 0.65);
      rg.addColorStop(0, 'rgba(220, 38, 38, 0)');
      rg.addColorStop(1, `rgba(220, 38, 38, ${(0.1 + 0.35 * urgency * pulse).toFixed(3)})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    // Gentle caustic shimmer — two slow-moving light bands
    const t = Date.now() / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const cx = (Math.sin(t * 0.3 + i * 2.1) * 0.5 + 0.5) * w;
      const cy = (Math.cos(t * 0.22 + i * 1.7) * 0.5 + 0.5) * h;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      cg.addColorStop(0, 'rgba(125, 211, 252, 0.06)');
      cg.addColorStop(1, 'rgba(125, 211, 252, 0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // Rising bubbles
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Little highlight glint
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, Math.max(0.5, b.r * 0.28), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
    }
    ctx.restore();
  },

  drawRain() {
    if (this.weather.mode !== 'rain' || this.world.isInterior) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(100, 116, 139, 0.13)';
    ctx.fillRect(0, 0, this.camera.w, this.camera.h);
    ctx.strokeStyle = 'rgba(165, 205, 250, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const d of this.rainDrops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.l * 0.18, d.y + d.l);
    }
    ctx.stroke();
  },

  drawLighting(camOverride) {
    const ctx = this.ctx;
    // Accept an "effective" camera rect (see draw()) that already accounts
    // for the current screen-shake offset — without it, this rect and the
    // active shaky transform disagree about what's actually on-screen,
    // leaving a raw seam at the viewport edge during a shake.
    const cam = camOverride || this.camera;
    if (cam.w <= 0 || cam.h <= 0) return; // Viewport not laid out yet

    // Day/night: dayness is 1 at noon (t=0.5), 0 at midnight (t=0)
    const dayness = 0.5 - 0.5 * Math.cos(this.timeOfDay * Math.PI * 2);
    const rainDim = this.weather.mode === 'rain' ? 0.15 : 0;
    const darkness = Math.min(0.7, 0.62 * Math.pow(1 - dayness, 1.4) + rainDim);

    // Golden-hour tint at dawn/dusk (strongest when half-day)
    const duskAmt = 4 * dayness * (1 - dayness) * (1 - dayness);
    if (duskAmt > 0.05) {
      ctx.fillStyle = `rgba(251, 146, 60, ${(0.14 * duskAmt).toFixed(3)})`;
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    }

    if (darkness < 0.05) return; // Full daylight — skip the lantern pass

    // Build the darkness+glow on an offscreen buffer first. Using
    // 'destination-out' straight on the live canvas would erase the real
    // scene (player, tiles) underneath instead of just the dark overlay.
    if (!this._lightCanvas) {
      this._lightCanvas = document.createElement('canvas');
      this._lightCtx = this._lightCanvas.getContext('2d');
    }
    // Padded on every side — screen shake nudges the active transform a
    // few pixels beyond this un-shaken camera rect, and without margin
    // that briefly exposes a raw, un-darkened seam at the viewport edge.
    const MARGIN = 24;
    const w = Math.ceil(cam.w) + MARGIN * 2, h = Math.ceil(cam.h) + MARGIN * 2;
    if (this._lightCanvas.width !== w || this._lightCanvas.height !== h) {
      this._lightCanvas.width = w;
      this._lightCanvas.height = h;
    }
    const lctx = this._lightCtx;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, w, h);
    lctx.fillStyle = `rgba(8, 10, 26, ${darkness.toFixed(3)})`;
    lctx.fillRect(0, 0, w, h);

    const px = this.player.x - cam.x + MARGIN;
    const py = this.player.y - cam.y + MARGIN;
    const glowRadius = 210;
    lctx.globalCompositeOperation = 'destination-out';
    const grad = lctx.createRadialGradient(px, py, 24, px, py, glowRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(px, py, glowRadius, 0, Math.PI * 2);
    lctx.fill();

    // Composite the punched-out darkness onto the camera-translated scene
    ctx.drawImage(this._lightCanvas, cam.x - MARGIN, cam.y - MARGIN);
  },

  drawVignette() {
    const ctx = this.ctx;
    const w = this.camera.w, h = this.camera.h;
    if (w <= 0 || h <= 0) return; // Viewport not laid out yet
    if (!this._vignetteCanvas || this._vignetteW !== w || this._vignetteH !== h) {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const vctx = canvas.getContext('2d');
      const cx = w / 2, cy = h / 2;
      const outerR = Math.hypot(cx, cy);
      const grad = vctx.createRadialGradient(cx, cy, outerR * 0.55, cx, cy, outerR);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      vctx.fillStyle = grad;
      vctx.fillRect(0, 0, w, h);
      this._vignetteCanvas = canvas;
      this._vignetteW = w;
      this._vignetteH = h;
    }
    ctx.drawImage(this._vignetteCanvas, 0, 0);
  },

  draw() {
    this.ctx.clearRect(0, 0, this.camera.w, this.camera.h);

    // Save context and apply camera displacement (plus any active screen shake)
    let shakeX = 0, shakeY = 0;
    if (this.screenShake.timeLeft > 0) {
      const falloff = this.screenShake.timeLeft / this.screenShake.duration;
      shakeX = (Math.random() - 0.5) * 2 * this.screenShake.magnitude * falloff;
      shakeY = (Math.random() - 0.5) * 2 * this.screenShake.magnitude * falloff;
    }
    this.ctx.save();
    this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    // Screen-space overlays (fog of war, lighting) must reason about the
    // same visible world window the shaky transform actually reveals —
    // not the un-shaken camera rect — or they leave a raw seam at the
    // edge for the duration of the shake.
    const shakenCam = (shakeX || shakeY)
      ? { x: this.camera.x - shakeX, y: this.camera.y - shakeY, w: this.camera.w, h: this.camera.h }
      : this.camera;

    // Interiors: void backdrop around the room (deep-blue for flooded cabins)
    if (this.world.isInterior) {
      this.ctx.fillStyle = this.world.isFlooded ? '#04121f' : '#120c06';
      this.ctx.fillRect(this.camera.x - 50, this.camera.y - 50, this.camera.w + 100, this.camera.h + 100);
    }

    // 1. Draw World Ground Tiles
    const focusedPlot = this._findFarmPlotAt();
    this.world.drawGround(this.ctx, this.camera, {
      hasScarecrow: this.hasScarecrow,
      cropPests: this.cropPests,
      focusedPlot,
      focusedPlotHint: this._farmPlotHint?.(focusedPlot),
    });

    // 1b. Draw Guard Vision Cones flat on the ground (before any sorted entities)
    this.guards.forEach(guard => {
      if (guard.x + guard.visionDist > this.camera.x &&
          guard.x - guard.visionDist < this.camera.x + this.camera.w &&
          guard.y + guard.visionDist > this.camera.y &&
          guard.y - guard.visionDist < this.camera.y + this.camera.h) {
        guard.drawVisionCone(this.ctx);
      }
    });

    // 2. Collect 2.5D Entities for Depth Sorting
    const sortableEntities = [];

    // Player
    sortableEntities.push({ y: this.player.y, draw: (ctx) => this.player.draw(ctx) });

    // Tamed companions + wild animals (all depth-sorted with everything else)
    this.pets.forEach(pet => {
      if (pet.atHome && !this.world.isHomeCabin) return; // parked safely at the cabin, off-screen
      // Underwater = actually submerged (TILE_LAKE, mirroring the guards'
      // invisibility check) or parked at home in the flooded cabin — both
      // get the little Air Helmet bubble so it reads as "how are they
      // breathing down here?"
      const petUnderwater = (pet.atHome && this.world.isFlooded) ||
        this.world.getTileAt(pet.x, pet.y) === this.world.TILE_LAKE;
      sortableEntities.push({ y: pet.y, draw: (ctx) => { ctx.save(); ctx.translate(0, pet.atHome ? -(pet.climbOffset || 0) : 0); pet.draw(ctx, petUnderwater); ctx.restore(); } });
    });
    this.wildPets.forEach(wp => sortableEntities.push({ y: wp.y, draw: (ctx) => wp.draw(ctx) }));

    // Guards
    this.guards.forEach(guard => {
      // Frustum culling check (is guard inside camera viewport?)
      if (guard.x + guard.visionDist > this.camera.x &&
          guard.x - guard.visionDist < this.camera.x + this.camera.w &&
          guard.y + guard.visionDist > this.camera.y &&
          guard.y - guard.visionDist < this.camera.y + this.camera.h) {
        sortableEntities.push({ y: guard.y, draw: (ctx) => guard.draw(ctx) });
      }
    });

    // Decoy Ducks (with a fading despawn ring)
    this.decoys.forEach(dcy => {
      sortableEntities.push({
        y: dcy.y,
        draw: (ctx) => {
          const wob = Math.sin(Date.now() / 150) * 2;
          ctx.fillStyle = 'rgba(15,23,42,0.2)';
          ctx.beginPath(); ctx.ellipse(dcy.x, dcy.y + 4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
          // Body + head
          ctx.fillStyle = '#fde047';
          ctx.beginPath(); ctx.ellipse(dcy.x, dcy.y - 6 + wob * 0.3, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(dcy.x + 7, dcy.y - 15 + wob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
          // Beak + eye
          ctx.fillStyle = '#fb923c';
          ctx.fillRect(dcy.x + 12, dcy.y - 17 + wob * 0.3, 6, 4);
          ctx.fillStyle = '#0f172a';
          ctx.beginPath(); ctx.arc(dcy.x + 8, dcy.y - 17 + wob * 0.3, 1.5, 0, Math.PI * 2); ctx.fill();
          // Expiry ring
          ctx.strokeStyle = `rgba(253, 224, 71, ${Math.min(0.6, dcy.t / 4)})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(dcy.x, dcy.y - 4, 20 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2); ctx.stroke();
        }
      });
    });

    // Ambient critters (chickens, cows) — cull to viewport
    this.critters.forEach(c => {
      if (c.x > this.camera.x - 80 && c.x < this.camera.x + this.camera.w + 80 &&
          c.y > this.camera.y - 80 && c.y < this.camera.y + this.camera.h + 80) {
        sortableEntities.push({ y: c.y, draw: (ctx) => c.draw(ctx) });
      }
    });

    // Environment Objects (Trees, Cabins, Tables, Items, Containers, Rat)
    const envEntities = this.world.getSortableEntities();
    envEntities.forEach(ent => sortableEntities.push(ent));

    // 3. Y-Sort algorithm (Depth sorting)
    sortableEntities.sort((a, b) => a.y - b.y);

    // 4. Render sorted entities from top-to-bottom
    sortableEntities.forEach(ent => ent.draw(this.ctx));

    // 4a. Particle bursts (loot pickups, container looting) + text popups
    this.drawParticles(this.ctx);
    this.drawFloaters(this.ctx);

    // 4c. Speech bubbles above NPCs
    this.guards.forEach(g => {
      if (g.speech && g.y > this.camera.y - 100 && g.y < this.camera.y + this.camera.h + 100) {
        this.drawSpeechBubble(this.ctx, g.x, g.y - 50, g.speech);
      }
    });
    if (this.world.camper && this.world.camper.speech) {
      this.drawSpeechBubble(this.ctx, this.world.camper.x, this.world.camper.y - 60, this.world.camper.speech);
    }

    // 4b. Ambient darkness with a soft spotlight around the player
    this.drawLighting(shakenCam);

    // Restore context
    this.ctx.restore();

    // 5b. Screen-space rain + vignette (after restore so they ignore camera shake/pan)
    this.drawRain();
    this.drawVignette();
    this.drawUnderwater();

    // 5c. Minigame overlay (screen space)
    if (this.state === 'minigame' && this.minigame) {
      this.minigame.draw(this.ctx, this.camera, this.player);
    }

    // 6. Draw Minimap (in screen-space, after ctx.restore; none indoors)
    const mmC = document.getElementById('minimap-container');
    if (mmC) mmC.style.display = this.world.isInterior ? 'none' : '';
    if (this.state === 'playing' && !this.world.isInterior && !this._minimapHidden) {
      this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
      this.world.drawMinimap(
        this.minimapCtx,
        this.minimapCanvas.width,
        this.minimapCanvas.height,
        this.player.x,
        this.player.y,
        this.guards,
        { landmarks: [...this.world.getLandmarks(), ...this.progressMarkers()] }
      );
    }
  },

  drawDisc() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.camera.w, this.camera.h);
    if (!this.activeDisc) return;
    this.activeDisc.draw(ctx, this.camera);
  },
};
