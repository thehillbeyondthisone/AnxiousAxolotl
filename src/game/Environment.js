/** Game prototype methods; Game coordinates their shared receiver. */
import { spawnCritters } from './Critter.js';
import { MATERIALS, RECIPES, TOOLS, canCraft } from './Crafting.js';

export const EnvironmentMethods = {
  _spawnWorldLife() {
    const isTown = this.world.areaType === 'town';
    this.critters = spawnCritters(
      this.world,
      isTown ? 2 : 4,
      isTown ? 0 : 1,
      isTown ? 0 : 1,
      isTown ? 0 : 1
    );
  },

  updateWeather(dt) {
    const w = this.weather;
    w.timer -= dt;

    if (w.mode === 'clear' && w.timer <= 0) {
      w.mode = 'rain';
      w.timer = 20 + Math.random() * 15;
      this.showAlert('🌧️ Rain shower! Your skin drinks it up — guards can barely see.');
      this.audio.setRain(true);
      this.guards.forEach(g => { g._baseVision = g.visionDist; g.visionDist *= 0.7; });
      // Nature does the chores: a shower waters every outdoor crop for free.
      this._rainWaterCrops();
      // Seed screen-space raindrops
      this.rainDrops = [];
      for (let i = 0; i < 110; i++) {
        this.rainDrops.push({
          x: Math.random() * this.camera.w,
          y: Math.random() * this.camera.h,
          s: 380 + Math.random() * 240,
          l: 10 + Math.random() * 10
        });
      }
    } else if (w.mode === 'rain') {
      // Rain rehydrates faster than land drains (net gain, slower than swimming)
      // ...but not under a roof.
      if (!this.player.inWater && !this.player.hasHelmet && !this.player.isDead && !this.world.isInterior) {
        this.player.hydration = Math.min(this.player.maxHydration, this.player.hydration + 6 * dt);
      }
      for (const d of this.rainDrops) {
        d.y += d.s * dt;
        d.x -= d.s * 0.18 * dt;
        if (d.y > this.camera.h) { d.y = -12; d.x = Math.random() * (this.camera.w + 60); }
      }
      if (w.timer <= 0) {
        w.mode = 'clear';
        w.timer = 50 + Math.random() * 70;
        this.audio.setRain(false);
        this.guards.forEach(g => { if (g._baseVision) { g.visionDist = g._baseVision; g._baseVision = null; } });
        this.rainDrops = [];
      }
    }
  },

  updateBubbles(dt) {
    if (!this.world.isFlooded && !this.player.isDiving) {
      if (this.bubbles.length) this.bubbles.length = 0;
      return;
    }
    // Keep a steady population of bubbles (more, faster ones while diving —
    // it should feel like being submerged in open water, not just a puddle)
    const target = this.player.isDiving ? 42 : 26;
    while (this.bubbles.length < target) {
      this.bubbles.push({
        x: Math.random() * this.camera.w,
        y: this.camera.h + Math.random() * this.camera.h,
        r: 1.5 + Math.random() * 4,
        vy: 18 + Math.random() * 34,
        wobA: Math.random() * Math.PI * 2,
        wobS: 1 + Math.random() * 2.5,
      });
    }
    for (const b of this.bubbles) {
      b.y -= b.vy * dt;
      b.wobA += b.wobS * dt;
      b.x += Math.sin(b.wobA) * 10 * dt;
      if (b.y < -8) {
        b.y = this.camera.h + Math.random() * 30;
        b.x = Math.random() * this.camera.w;
      }
    }
  },
  updateAmbientBeforeMove(dt,isMovingNow,inWater) {
    // Splash burst + sound when diving in or hopping out of water
    if (inWater !== this._wasInWater) {
      this.audio.play('splash', { volume: 0.7 });
      this.spawnBurst(this.player.x, this.player.y + 6, 'rgba(125, 211, 252, ALPHA)', 12);
      this._wasInWater = inWater;
    }

    // Footstep dust puffs while moving on land
    if (isMovingNow && !inWater) {
      this._dustTimer -= dt;
      if (this._dustTimer <= 0) {
        this._dustTimer = 0.22;
        this.particles.push({
          x: this.player.x - Math.cos(this.player.angle) * 12 + (Math.random() - 0.5) * 8,
          y: this.player.y + 8,
          vx: (Math.random() - 0.5) * 15, vy: -8 - Math.random() * 10,
          life: 0.35, maxLife: 0.35, size: 2.5,
          color: 'rgba(214, 211, 209, ALPHA)'
        });
      }
    }

    // Advance the day/night clock (full cycle = this.dayLengthSeconds of real time)
    const prevTime = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + dt / this.dayLengthSeconds) % 1;
    if (this.timeOfDay < prevTime) {
      this.dayCount++;
      this.stats.maxDayReached = Math.max(this.stats.maxDayReached, this.dayCount);
      this._advanceFarmDay({ serviceHelpers: false });
      this.saveProfile();
      this.showAlert(`🌅 Day ${this.dayCount} at the resort!`);
    }
    if (prevTime < 0.25 && this.timeOfDay >= 0.25) {
      this._serviceFarmHelpers();
      this.saveProfile();
    }
    this.runStats.time += dt;

    // Ambient wildlife (startled chickens can shed a feather — premium mat)
    this.critters.forEach(c => {
      c.update(dt, this.player, this.world);
      if (c.featherDrop) {
        this.world.items.push({
          x: c.featherDrop.x, y: c.featherDrop.y, radius: 10,
          name: 'Feather', type: 'material', matId: 'feather', value: 0, emoji: '🪶'
        });
        c.featherDrop = null;
      }
    });

    // Sneak Stun Slingshot cooldown
    if (this._stunnerCooldown > 0) this._stunnerCooldown = Math.max(0, this._stunnerCooldown - dt);

    // Decoy Ducks: lure nearby guards away from their patrols
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const dcy = this.decoys[i];
      dcy.t -= dt;
      if (dcy.t <= 0) {
        this.decoys.splice(i, 1);
        this.guards.forEach(g => { if (g.state === 'decoy') g.state = 'patrol'; });
        continue;
      }
      this.guards.forEach(g => {
        if ((g.state === 'patrol' || g.state === 'idle' || g.state === 'search') &&
            Math.hypot(g.x - dcy.x, g.y - dcy.y) < 340) {
          g.state = 'decoy';
          g.decoyPt = dcy;
        }
      });
    }

    // Weather system
    this.updateWeather(dt);
    this._updateCropPests(dt);

  },

  updateAmbientAfterMove(dt) {
    // Rising bubbles inside the flooded cabin (screen-space ambiance)
    this.updateBubbles(dt);

    // Tamed companions trail the player and may fetch a Pebble.
    // Any pet left home (Air Helmet on) just idles at its cabin bed spot.
    if (this.pets.length) {
      this.pets.forEach(pet => {
        if (pet.atHome) {
          pet.animTime += dt;
          this.updateHomeCompanion(pet, dt);
          if (pet.happyTimer > 0) pet.happyTimer -= dt;
          return;
        }
        const reward = pet.update(dt, this.player, this.world);
        if (reward > 0) {
          this.player.pebbles += reward;
          this.spawnFloater(pet.x, pet.y - 24, `+${reward} ✨`, '#fde047');
          this.playSound('collect');
          this.updateHUD();
          this.saveProfile();
        }
      });
      this._petChipTimer = (this._petChipTimer || 0) - dt;
      if (this._petChipTimer <= 0) { this._petChipTimer = 0.5; this.updatePetChip(); }
    }

    // Wild (untamed) animals wander near their spawn point (Woods only)
    this.wildPets.forEach(wp => wp.update(dt, this.player, this.world));

  },
  devGrowCrops() {
    const plots = this.world?.areaType === 'woods' ? this.world.farmPlots : this.homeFarmState;
    if (!plots?.length) {
      this.showAlert('No farm plots loaded — visit the home farm first.');
      return;
    }
    let grown = 0;
    plots.forEach(plot => {
      if (plot.crop && (plot.stage || 0) < 3) { plot.stage = 3; grown++; }
    });
    if (this.world?.areaType === 'woods') this._saveHomeFarmState();
    this.playSound('upgrade');
    this.showAlert(grown ? `🌾 Grew ${grown} crop(s) to full maturity.` : 'Nothing planted to grow.');
    this.saveProfile();
  },

  devWaterCrops() {
    const plots = this.world?.areaType === 'woods' ? this.world.farmPlots : this.homeFarmState;
    if (!plots?.length) {
      this.showAlert('No farm plots loaded — visit the home farm first.');
      return;
    }
    plots.forEach(plot => { if (plot.crop) plot.watered = true; });
    if (this.world?.areaType === 'woods') this._saveHomeFarmState();
    this.playSound('splash');
    this.showAlert('💧 Watered every planted plot.');
    this.saveProfile();
  },

  devSpawnCrow() {
    if (this.world?.areaType !== 'woods' || !this.world.farmPlots?.length) {
      this.showAlert('Stand at the home farm to test crow pests.');
      return;
    }
    const targets = this.world.farmPlots.filter(p => p.crop);
    if (!targets.length) {
      this.showAlert('Plant a crop first — nothing for the crow to eat.');
      return;
    }
    const plot = targets[Math.floor(Math.random() * targets.length)];
    this.cropPests.push({
      x: plot.x + plot.w / 2 + 200,
      y: plot.y + plot.h / 2 - 200,
      targetPlotId: plot.id,
      state: 'flying',
      timer: 0,
    });
    this.playSound('ui');
  },

  devUntamePets() {
    if (!this.pets.length) {
      this.showAlert('🐾 No tamed companions to release.');
      return;
    }
    this.pets = [];
    this._spawnWildPets(); // rebuilds wildPets from world data, minus anything still in this.pets (now none)
    this.updatePetChip();
    this.playSound('ui');
    this.showAlert(this.world.areaType === 'woods'
      ? '🐾 Companions released — they\'re wandering Whispering Woods again!'
      : '🐾 Companions released — head to Whispering Woods to tame them again.');
    this.saveProfile();
    this.updateHUD();
  },

  devSpawnItem(value) {
    const [kind, key] = value.split(':');
    if (kind === 'food') {
      const def = this._spawnDefs.food[parseInt(key)];
      if (!def) return;
      if (!this.player.addItem({ ...def })) {
        this._notifyBackpackFull('No room for that spawned item.');
        return;
      }
      this.showAlert(`✨ Spawned ${def.name}`);
    } else if (kind === 'material') {
      this.player.addMaterial(key);
      this.showAlert(`✨ Spawned ${MATERIALS[key].name}`);
    } else if (kind === 'tool') {
      this.player.tools[key] = (this.player.tools[key] || 0) + 1;
      this.showAlert(`✨ Spawned ${TOOLS[key].name}`);
    }
    this.playSound('collect');
    this.updateHUD();
    this.updateBackpackUI();
  },

  spawnBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 2,
        color
      });
    }
  },

  spawnFloater(x, y, text, color = '#fde047') {
    this.floaters.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
  },

  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  },

  triggerScreenShake(magnitude, duration) {
    this.screenShake.magnitude = magnitude;
    this.screenShake.duration = duration;
    this.screenShake.timeLeft = duration;
  },

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92; // drag
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.screenShake.timeLeft > 0) {
      this.screenShake.timeLeft = Math.max(0, this.screenShake.timeLeft - dt);
    }
  },
};
