/**
 * Home-cabin farming — extracted from Game.js as a prototype mixin.
 *
 * Methods run with `this` bound to the Game instance (Object.assign'd onto
 * Game.prototype), so `this.world` / `this.player` / `this.homeFarmState`
 * and the save hooks resolve exactly as they did inline. Pure move — no
 * behavior change.
 *
 * The `ALPHA` token in the spawnBurst colors is intentional: drawParticles
 * substitutes it with the particle's fading alpha each frame.
 */
import { CROP_TYPES, CROP_ORDER } from './AssetLoader.js';

export const FarmMethods = {
  /** Cycle which crop the next 'plant' interaction will sow — bound to the 'C' key near a plot. */
  _cycleSelectedCrop() {
    const idx = CROP_ORDER.indexOf(this.selectedCropType);
    this.selectedCropType = CROP_ORDER[(idx + 1) % CROP_ORDER.length];
    const def = CROP_TYPES[this.selectedCropType];
    this.playSound('ui');
    this.showAlert(`${def.emoji} Selected seed: ${def.name}`);
  },

  _findFarmPlotAt() {
    if (!this.world?.farmPlots?.length || this.world.areaType !== 'woods') return null;
    let best = null;
    let bestDist = 58;
    for (const plot of this.world.farmPlots) {
      const cx = plot.x + plot.w / 2;
      const cy = plot.y + plot.h / 2;
      const d = Math.hypot(this.player.x - cx, this.player.y - cy);
      if (d < bestDist) {
        best = plot;
        bestDist = d;
      }
    }
    return best;
  },

  _farmActionFor(plot) {
    if (!plot) return null;
    if (!plot.crop) return 'plant';
    if ((plot.stage || 0) >= 3) return 'harvest';
    if (!plot.watered) return 'water';
    return 'wait';
  },

  _farmStatusText(plot) {
    if (!plot) return '';
    if (!plot.crop) {
      const def = CROP_TYPES[this.selectedCropType] || CROP_TYPES.sproutroot;
      return `Next seed: ${def.name}`;
    }
    const cropDef = CROP_TYPES[plot.crop] || CROP_TYPES.sproutroot;
    const stage = Math.max(0, Math.min(3, plot.stage || 0));
    if (stage >= 3) return 'Ready to harvest';
    if (plot.watered) return `Stage ${stage + 1}/4 - watered`;
    return `Stage ${stage + 1}/4 - needs water`;
  },

  _farmPlotHint(plot) {
    if (!plot) return null;
    const action = this._farmActionFor(plot);
    const def = plot.crop ? (CROP_TYPES[plot.crop] || CROP_TYPES.sproutroot) : (CROP_TYPES[this.selectedCropType] || CROP_TYPES.sproutroot);
    const actionText = action === 'plant'
      ? `Plant ${def.name}`
      : action === 'water'
        ? `Water ${def.name}`
        : action === 'harvest'
          ? `Harvest ${def.name}`
          : `Wait on ${def.name}`;
    return {
      title: actionText,
      detail: this._farmStatusText(plot),
    };
  },

  _interactFarmPlot(plot) {
    const action = this._farmActionFor(plot);
    if (!action) return false;
    if (action === 'plant') {
      if (this.farmSeedCount <= 0) {
        this.showAlert('Out of seeds. Harvest crops or check the farm soon for more.');
        return true;
      }
      const sownDef = CROP_TYPES[this.selectedCropType] || CROP_TYPES.sproutroot;
      plot.crop = sownDef.id;
      plot.stage = 0;
      plot.watered = false;
      plot.plantedDay = this.dayCount;
      this.farmSeedCount--;
      this.playSound('collect');
      this.spawnBurst(plot.x + plot.w / 2, plot.y + plot.h / 2, 'rgba(132, 204, 22, ALPHA)', 8);
      this.spawnFloater(plot.x + plot.w / 2, plot.y - 4, `Planted ${sownDef.name}`, '#a3e635');
    } else if (action === 'water') {
      plot.watered = true;
      this.playSound('splash');
      this.spawnBurst(plot.x + plot.w / 2, plot.y + plot.h / 2, 'rgba(125, 211, 252, ALPHA)', 8);
      this.spawnFloater(plot.x + plot.w / 2, plot.y - 4, 'Watered', '#7dd3fc');
    } else if (action === 'harvest') {
      const cropDef = CROP_TYPES[plot.crop] || CROP_TYPES.sproutroot;
      const crop = { name: cropDef.name, type: 'food', value: cropDef.value, emoji: cropDef.emoji, qty: 1 };
      if (!this.player.addItem(crop)) {
        this.world.items.push({
          x: plot.x + plot.w / 2,
          y: plot.y + plot.h / 2,
          radius: 10,
          ...crop
        });
        this._notifyBackpackFull('The harvest dropped by the plot.');
      } else {
        this.showAlert(`Harvested ${cropDef.name}.`);
      }
      plot.crop = null;
      plot.stage = 0;
      plot.watered = false;
      plot.plantedDay = 0;
      this.farmSeedCount += cropDef.seedYield;
      this.playSound('sell');
      this.spawnBurst(plot.x + plot.w / 2, plot.y + plot.h / 2, 'rgba(251, 191, 36, ALPHA)', 10);
      this.spawnFloater(plot.x + plot.w / 2, plot.y - 4, `+ ${cropDef.name}`, '#fde047');
    } else {
      this.showAlert('Already watered. Check back tomorrow.');
    }
    this._saveHomeFarmState();
    this.updateHUD();
    this.saveProfile();
    return true;
  },

  /**
   * A rain shower waters every planted crop, whether the player is standing
   * in the woods or the farm is persisted off-screen. Only affects plots
   * that actually hold a crop, and skips fully-grown ones (nothing to water).
   */
  _rainWaterCrops() {
    const live = this.world?.areaType === 'woods' ? this.world.farmPlots : null;
    let touched = false;
    const soak = plots => {
      if (!plots) return;
      plots.forEach(plot => {
        if (plot.crop && (plot.stage || 0) < 3 && !plot.watered) {
          plot.watered = true;
          touched = true;
        }
      });
    };
    soak(live);
    // Keep the off-screen snapshot in sync so growth still advances at day-end.
    if (live) {
      this._saveHomeFarmState();
    } else {
      soak(this.homeFarmState);
    }
    if (touched && live) {
      this.spawnFloater?.(this.player.x, this.player.y - 40, '🌧️ Crops watered', '#7dd3fc');
    }
  },

  /**
   * Crow pests: while the player is at the home farm without a scarecrow,
   * a crow occasionally swoops in to eat a growing crop. Approaching the
   * crow scares it off before it finishes; a scarecrow (`this.hasScarecrow`)
   * stops them from ever spawning.
   */
  _updateCropPests(dt) {
    if (this.world?.areaType !== 'woods' || !this.world.farmPlots?.length) {
      if (this.cropPests.length) this.cropPests.length = 0;
      return;
    }

    if (this._pestSpawnTimer === undefined) this._pestSpawnTimer = 15 + Math.random() * 20;

    if (!this.hasScarecrow && this.cropPests.length === 0) {
      this._pestSpawnTimer -= dt;
      if (this._pestSpawnTimer <= 0) {
        this._pestSpawnTimer = 25 + Math.random() * 30;
        const targets = this.world.farmPlots.filter(p => p.crop && (p.stage || 0) >= 1);
        if (targets.length) {
          const plot = targets[Math.floor(Math.random() * targets.length)];
          const cx = plot.x + plot.w / 2, cy = plot.y + plot.h / 2;
          const angle = Math.random() * Math.PI * 2;
          this.cropPests.push({
            x: cx + Math.cos(angle) * 220,
            y: cy + Math.sin(angle) * 220,
            targetPlotId: plot.id,
            state: 'flying',
            timer: 0,
          });
        }
      }
    }

    for (let i = this.cropPests.length - 1; i >= 0; i--) {
      const crow = this.cropPests[i];
      const plot = this.world.farmPlots.find(p => p.id === crow.targetPlotId);
      const distToPlayer = Math.hypot(this.player.x - crow.x, this.player.y - crow.y);

      // A scarecrow bought mid-swoop, or the player closing in, scares it off.
      if ((this.hasScarecrow || distToPlayer < 55) && crow.state !== 'fleeing') {
        crow.state = 'fleeing';
        crow.timer = 0;
        if (distToPlayer < 55) this.spawnFloater(crow.x, crow.y - 10, 'Shoo!', '#e2e8f0');
      }

      if (crow.state === 'flying') {
        if (!plot) { crow.state = 'fleeing'; continue; }
        const tx = plot.x + plot.w / 2, ty = plot.y + plot.h / 2 - 6;
        const d = Math.hypot(tx - crow.x, ty - crow.y);
        if (d < 6) {
          crow.state = 'eating';
          crow.timer = 2.2;
        } else {
          const a = Math.atan2(ty - crow.y, tx - crow.x);
          crow.x += Math.cos(a) * 140 * dt;
          crow.y += Math.sin(a) * 140 * dt;
        }
      } else if (crow.state === 'eating') {
        crow.timer -= dt;
        if (crow.timer <= 0 && plot?.crop) {
          plot.crop = null;
          plot.stage = 0;
          plot.watered = false;
          this.spawnBurst(plot.x + plot.w / 2, plot.y + plot.h / 2, 'rgba(30, 27, 24, ALPHA)', 8);
          this.spawnFloater(plot.x + plot.w / 2, plot.y - 8, 'A crow ate your crop!', '#f87171');
          this.playSound('splash');
          this._saveHomeFarmState();
          this.updateHUD();
          this.saveProfile();
          crow.state = 'fleeing';
          crow.timer = 0;
        }
      } else if (crow.state === 'fleeing') {
        crow.x += (crow.x - this.player.x) * 0.02 + (Math.random() - 0.5) * 4;
        crow.y -= 90 * dt;
        crow.timer += dt;
        if (crow.timer > 1.5) this.cropPests.splice(i, 1);
      }
    }
  },

  _advanceFarmDay() {
    if (!this.homeFarmState && this.world?.farmPlots?.length) this._saveHomeFarmState();
    const plots = this.world?.areaType === 'woods' ? this.world.farmPlots : this.homeFarmState;
    if (!plots) return;
    plots.forEach(plot => {
      if (!plot.crop) return;
      if (plot.watered) plot.stage = Math.min(3, (plot.stage || 0) + 1);
      plot.watered = false;
    });
    if (this.world?.areaType === 'woods') this._saveHomeFarmState();
  },

  _serializeHomeFarmState() {
    if (this.world?.areaType === 'woods' && this.world.farmPlots?.length) {
      this._saveHomeFarmState();
    }
    return this.homeFarmState ? this.homeFarmState.map(p => ({ ...p })) : null;
  },

  _normalizeHomeFarmState(value) {
    if (!Array.isArray(value)) return null;
    return value
      .filter(plot => plot && typeof plot.id === 'string')
      .map(plot => {
        const stage = Number(plot.stage);
        return {
          id: plot.id,
          x: Number.isFinite(Number(plot.x)) ? Number(plot.x) : 0,
          y: Number.isFinite(Number(plot.y)) ? Number(plot.y) : 0,
          w: Number.isFinite(Number(plot.w)) ? Number(plot.w) : 44,
          h: Number.isFinite(Number(plot.h)) ? Number(plot.h) : 44,
          crop: plot.crop || null,
          stage: Number.isFinite(stage) ? Math.max(0, Math.min(3, Math.floor(stage))) : 0,
          watered: !!plot.watered,
          plantedDay: Number.isFinite(Number(plot.plantedDay)) ? Number(plot.plantedDay) : 0
        };
      });
  },

  _saveHomeFarmState() {
    if (this.world?.areaType !== 'woods' || !this.world.farmPlots) return;
    this.homeFarmState = this.world.farmPlots.map(p => ({ ...p }));
  },

  _applyHomeFarmState() {
    if (this.world?.areaType !== 'woods' || !this.world.farmPlots?.length) return;
    if (!this.homeFarmState) {
      this._saveHomeFarmState();
      return;
    }
    const byId = new Map(this.homeFarmState.map(p => [p.id, p]));
    this.world.farmPlots = this.world.farmPlots.map(plot => {
      const saved = byId.get(plot.id);
      if (!saved) return plot;
      return {
        ...plot,
        crop: saved.crop || null,
        stage: saved.stage || 0,
        watered: !!saved.watered,
        plantedDay: saved.plantedDay || 0
      };
    });
  },
};
