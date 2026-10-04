/** Game prototype methods; Game coordinates their shared receiver. */
import { World } from './World.js';
import { WorldGenerator } from './WorldGenerator.js';
import { Pet, PET_KINDS, TAME_REQUIREMENTS } from './Pet.js';
import { Player } from './Player.js';
import { MATERIALS, RECIPES, TOOLS, canCraft } from './Crafting.js';
import { AchievementTracker, ACHIEVEMENTS } from './Achievements.js';
import { SKINS, isSkinUnlocked, findSkin } from './Unlockables.js';
import { DISC_CATALOG, findDisc } from './DiscCatalog.js';
import { Sprites, spriteReady, FURNITURE, RUG_PIECES, HOME_BED_SPRITE, WARDROBE_SPRITE, PETBED_SPRITE, COUNTER_SPRITE, WORKSTATION_SPRITE, CLOCK_SPRITE, DOGBONE_SPRITE, SMALL_PLANT_SPRITE, SEED_ICON_SPRITE, HUD_ICON_SPRITES, NAV_ICON_SPRITES, NAV_ITEM_SPRITES, RECYCLE_SPRITES } from './AssetLoader.js';

export const UIStateMethods = {
  bindUIEvents() {
    // Menu Controls
    document.getElementById('btn-start').addEventListener('click', () => {
      this.playSound('collect');
      this.startGame();
    });

    document.getElementById('btn-how-to').addEventListener('click', () => {
      this.playSound('collect');
      document.getElementById('main-menu').classList.add('hidden');
      document.getElementById('how-to-play-screen').classList.remove('hidden');
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
      this.playSound('collect');
      document.getElementById('how-to-play-screen').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
    });

    // Shop Controls
    document.getElementById('btn-open-shop').addEventListener('click', () => {
      this.playSound('collect');
      this.openShop();
    });

    document.getElementById('btn-close-shop').addEventListener('click', () => {
      this.playSound('collect');
      this.closeShop();
    });

    // Achievements Controls
    document.getElementById('btn-open-achievements')?.addEventListener('click', () => {
      this.playSound('collect');
      this.openAchievements();
    });
    document.getElementById('btn-close-achievements')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closeAchievements();
    });

    // Wardrobe Controls
    document.getElementById('btn-open-wardrobe')?.addEventListener('click', () => {
      this.playSound('collect');
      this.openWardrobe();
    });
    document.getElementById('btn-close-wardrobe')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closeWardrobe();
    });

    // Pet companion controls (Feed/Play buttons are generated per-card in updatePetUI)
    document.getElementById('btn-open-pet')?.addEventListener('click', () => {
      this.playSound('collect');
      this.openPet();
    });
    document.getElementById('btn-close-pet')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closePet();
    });

    // Cabin Storage Controls
    document.getElementById('btn-close-cabin-storage')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closeCabinStorage();
    });

    // Fish Market Controls
    document.getElementById('btn-close-fishmarket')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closeFishMarket();
    });
    document.getElementById('btn-sell-fish')?.addEventListener('click', () => this.sellFishToMarket());
    document.getElementById('btn-buy-bait')?.addEventListener('click', () => this.buyBait());
    document.getElementById('btn-buy-sturdyline')?.addEventListener('click', () => this.buySturdyLine());

    // Raccoon Shop Controls
    document.getElementById('btn-close-raccoonshop')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closeRaccoonShop();
    });

    // Home Upgrade Shop Controls
    document.getElementById('btn-close-home-upgrades')?.addEventListener('click', () => {
      this.playSound('collect');
      this.closeHomeUpgradeShop();
    });

    // Computer / disc drive controls
    document.getElementById('btn-close-computer')?.addEventListener('click', () => {
      this.playSound('ui');
      this.closeComputer();
    });
    document.getElementById('btn-disc-back')?.addEventListener('click', () => {
      if (this.state !== 'disc') return;
      this.playSound('ui');
      this.exitDiscToComputer();
    });

    // Game Over Retry
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.playSound('collect');
      this.resetGame();
    });

    // Dialogue Overlay Controls
    document.getElementById('btn-dialogue-action').addEventListener('click', () => {
      this.handleRatTrade();
    });

    document.getElementById('btn-dialogue-close').addEventListener('click', () => {
      this.playSound('collect');
      document.getElementById('dialogue-overlay').classList.add('hidden');
    });

    // Crafting overlay (opened from the rat's dialogue)
    document.getElementById('btn-dialogue-craft').addEventListener('click', () => {
      document.getElementById('dialogue-overlay').classList.add('hidden');
      this.openCrafting();
    });
    document.getElementById('btn-close-craft').addEventListener('click', () => {
      this.playSound('ui');
      this.closeCrafting();
    });

    // Backpack Overlay Controls
    const backpackHud = document.querySelector('.backpack-hud');
    if (backpackHud) {
      backpackHud.addEventListener('click', () => {
        if (this.state === 'playing') {
          this.playSound('collect');
          this.openBackpack();
        }
      });
    }

    const btnOpenBackpackHud = document.getElementById('btn-open-backpack-hud');
    if (btnOpenBackpackHud) {
      btnOpenBackpackHud.addEventListener('click', () => {
        if (this.state === 'playing') {
          this.playSound('collect');
          this.openBackpack();
        }
      });
    }

    const btnCloseBackpack = document.getElementById('btn-close-backpack');
    if (btnCloseBackpack) {
      btnCloseBackpack.addEventListener('click', () => {
        this.playSound('collect');
        this.closeBackpack();
      });
    }

    // Keyboard shortcuts for inventory + minimap
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'i' || key === 'b') {
        if (this.state === 'playing') {
          this.playSound('collect');
          this.openBackpack();
        } else if (this.state === 'backpack') {
          this.playSound('collect');
          this.closeBackpack();
        }
      }
      if (key === 'm' && (this.state === 'playing' || this.state === 'paused')) {
        this.setMinimapHidden(!this._minimapHidden);
      }
      if (key === 'q' && this.state === 'playing') {
        this._useStunner();
      }
      if (key === 'r' && this.state === 'playing') {
        this._unleashPet();
      }
      if (key === 'c' && this.state === 'playing' && this._findFarmPlotAt()) {
        this._cycleSelectedCrop();
      }
      const slotNum = Number(key);
      if (this.state === 'playing' && Number.isInteger(slotNum) && slotNum >= 1 && slotNum <= this.actionSlots.length) {
        this.selectActionSlot(slotNum - 1);
      }
    });

    // Mouse wheel over the hotbar cycles the selected slot
    document.getElementById('action-bar')?.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = (this.selectedActionSlot + dir + this.actionSlots.length) % this.actionSlots.length;
      this.selectActionSlot(next);
    }, { passive: false });

    // Minimap collapse toggle (tap the area badge or the arrow button)
    const mmToggle = document.getElementById('btn-minimap-toggle');
    if (mmToggle) {
      mmToggle.addEventListener('click', () => this.setMinimapHidden(!this._minimapHidden));
    }

    // === SETTINGS MENU ===
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('btn-reset-save')?.addEventListener('click', () => {
      if (confirm('Are you sure? This will reset all saved possessions, upgrades and progress.')) {
        this.saveManager.reset();
        location.reload();
      }
    });

    // Settings sliders
    const bindVolumeSlider = (id, callback) => {
      const slider = document.getElementById(id);
      const display = document.getElementById(id + '-val');
      if (!slider || !display) return;
      const handler = () => {
        display.textContent = slider.value + '%';
        callback(parseFloat(slider.value) / 100);
        this.saveProfile();
      };
      slider.addEventListener('input', handler);
    };
    bindVolumeSlider('vol-master', (v) => { this.audio.masterVolume = v; });
    bindVolumeSlider('vol-music', (v) => { this.audio.musicVolume = v; });
    bindVolumeSlider('vol-sfx', (v) => { this.audio.sfxVolume = v; });

    // Minimap default toggle
    const mmDefault = document.getElementById('minimap-default-hidden');
    if (mmDefault) {
      mmDefault.addEventListener('change', () => {
        this._minimapDefaultHidden = mmDefault.checked;
        this.saveProfile();
      });
    }

    // Joystick size slider (mobile web viewports vary a lot — let players tune it)
    const joySlider = document.getElementById('joystick-size');
    const joyVal = document.getElementById('joystick-size-val');
    if (joySlider) {
      joySlider.addEventListener('input', () => {
        joyVal.textContent = joySlider.value + '%';
        this.input.setJoystickScale(parseFloat(joySlider.value) / 100);
        this.saveProfile();
      });
    }

    // ESC to pause/settings
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state === 'playing') {
        this.openSettings();
      } else if (e.key === 'Escape' && this.state === 'settings') {
        this.closeSettings();
      } else if (e.key === 'Escape' && this.state === 'minigame') {
        // Walk away from the minigame
        this._endMinigame('cancelled');
        this.playSound('ui');
      } else if (e.key === 'Escape' && this.state === 'computer') {
        this.closeComputer();
        this.playSound('ui');
      } else if (e.key === 'Escape' && this.state === 'disc') {
        this.exitDiscToComputer();
        this.playSound('ui');
      }
    });

    // Setup Shop Buy Actions
    const items = ['booties', 'canteen', 'rod', 'backpack', 'helmet', 'airhelmet', 'scarecrow'];
    items.forEach(itemId => {
      const btn = document.getElementById(`btn-buy-${itemId}`);
      if (btn) {
        btn.addEventListener('click', () => this.purchaseUpgrade(itemId));
      }
    });
    document.getElementById('btn-buy-lockpick')?.addEventListener('click', () => this.buyLockpick());
    document.getElementById('btn-knockout')?.addEventListener('click', () => this._useStunner());

    // === DEV MENU BINDINGS ===
    document.getElementById('btn-open-dev').addEventListener('click', () => {
      this.playSound('collect');
      this.openDevMenu();
    });

    // Dev menu tabs
    document.querySelectorAll('.dev-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.dev-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.dev-tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.tabPanel !== tab));
        this.playSound('ui');
      });
    });

    document.getElementById('btn-close-dev').addEventListener('click', () => {
      this.playSound('collect');
      this.closeDevMenu();
    });

    document.getElementById('dev-refresh-sprites')?.addEventListener('click', () => {
      this.renderSpriteGallery();
      this.playSound('ui');
    });

    // Diagnostics controls
    const btnClearLog = document.getElementById('dev-clear-log');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        this.debugLog = [];
        this._lastError = null;
        this._loopErrored = false;
        this.logDebug('info', 'Log cleared');
      });
    }
    const btnThrowTest = document.getElementById('dev-throw-test');
    if (btnThrowTest) {
      btnThrowTest.addEventListener('click', () => {
        // Deliberately throw to confirm the loop's error capture is wired up.
        throw new Error('Test error from Dev menu');
      });
    }

    // Slider helper: bind a range input to a live value display and callback
    const bindSlider = (id, callback) => {
      const slider = document.getElementById(id);
      const display = document.getElementById(id + '-val');
      if (!slider || !display) return;
      const handler = () => {
        display.textContent = slider.value;
        callback(parseFloat(slider.value));
        this.updateSpeedRatio();
      };
      slider.addEventListener('input', handler);
    };

    // Speed sliders
    bindSlider('dev-player-speed', (v) => { this.player.baseSpeed = v; });
    bindSlider('dev-guard-speed', (v) => { this.guards.forEach(g => g.patrolSpeed = v); });
    bindSlider('dev-chase-speed', (v) => { this.guards.forEach(g => g.chaseSpeed = v); });

    // Guard AI sliders
    bindSlider('dev-vision-dist', (v) => { this.guards.forEach(g => g.visionDist = v); });
    bindSlider('dev-vision-fov', (v) => { this.guards.forEach(g => g.visionFov = v); });
    bindSlider('dev-alert-speed', (v) => { this.guards.forEach(g => g.alertSpeed = v); });

    // Hydration sliders
    bindSlider('dev-hydration-drain', (v) => { this.player.hydrationDrainRate = v; });
    bindSlider('dev-hydration-fill', (v) => { this.player.hydrationFillRate = v; });

    // Minigame sweet-spot size — widens/narrows the fishing catch bar,
    // cooking perfect/good zones, and lockpicking wedge all at once.
    bindSlider('dev-sweet-spot', (v) => { this.devSweetSpotMult = v; });

    // World gen sliders (display only for now — used when Regenerate is clicked)
    bindSlider('dev-map-cols', () => {});
    bindSlider('dev-map-rows', () => {});
    bindSlider('dev-zone-spacing', () => {});
    bindSlider('dev-tree-density', () => {});
    bindSlider('dev-guard-count', () => {});
    bindSlider('dev-building-count', () => {});
    bindSlider('dev-material-loot', (v) => { this.materialLootMult = v / 100; });
    bindSlider('dev-drop-amount', (v) => { this.dropAmount = v; });

    // Regenerate world button — now fully functional!
    document.getElementById('btn-regen-world').addEventListener('click', () => {
      this.playSound('upgrade');
      this.regenerateWorld();
    });

    // Spawn Item cheat — populate the dropdown once with every spawnable defs
    this._populateSpawnItemSelect();
    document.getElementById('dev-spawn-btn')?.addEventListener('click', () => {
      const sel = document.getElementById('dev-spawn-select');
      if (sel && sel.value) this.devSpawnItem(sel.value);
    });

    // Cheat buttons
    document.getElementById('dev-give-pebbles').addEventListener('click', () => {
      this.player.pebbles += 100;
      this.playSound('sell');
      this.updateHUD();
    });

    document.getElementById('dev-full-hydration').addEventListener('click', () => {
      this.player.hydration = this.player.maxHydration;
      this.playSound('refill');
      this.updateHUD();
    });

    document.getElementById('dev-toggle-helmet').addEventListener('click', () => {
      this.player.hasHelmet = !this.player.hasHelmet;
      this.playSound('upgrade');
      document.getElementById('helmet-indicator').classList.toggle('hidden', !this.player.hasHelmet);
      this.updateHUD();
    });

    document.getElementById('dev-reset-progress')?.addEventListener('click', () => {
      if (confirm('Are you sure? This will reset all upgrades and progress (you keep your current items).')) {
        this.saveManager.reset();
        location.reload();
      }
    });

    document.getElementById('dev-untame-pets')?.addEventListener('click', () => this.devUntamePets());

    // Farm tab cheats
    document.getElementById('dev-grow-crops')?.addEventListener('click', () => this.devGrowCrops());
    document.getElementById('dev-water-crops')?.addEventListener('click', () => this.devWaterCrops());
    document.getElementById('dev-give-seeds')?.addEventListener('click', () => {
      this.farmSeedCount += 20;
      this.playSound('collect');
      this.updateHUD();
      this.saveProfile();
    });
    document.getElementById('dev-toggle-scarecrow')?.addEventListener('click', () => {
      this.hasScarecrow = !this.hasScarecrow;
      this.playSound('upgrade');
      this.showAlert(this.hasScarecrow ? '🎃 Scarecrow placed.' : '🎃 Scarecrow removed.');
      this.saveProfile();
    });
    document.getElementById('dev-spawn-crow')?.addEventListener('click', () => this.devSpawnCrow());
  },

  setMinimapHidden(hidden, save = true) {
    this._minimapHidden = hidden;
    const mmC = document.getElementById('minimap-container');
    if (mmC) mmC.classList.toggle('collapsed', hidden);
    const btn = document.getElementById('btn-minimap-toggle');
    if (btn) btn.innerText = hidden ? '▸' : '▾';
    this.playSound('ui');
    if (save) this.saveProfile();
  },

  openSettings() {
    this._settingsReturnState = this.state;
    this.input.reset();
    this.state = 'settings';
    document.getElementById('settings-overlay').classList.remove('hidden');
    // Sync current settings to UI
    document.getElementById('vol-master').value = Math.round((this.audio.masterVolume ?? 0.8) * 100);
    document.getElementById('vol-music').value = Math.round((this.audio.musicVolume ?? 0.6) * 100);
    document.getElementById('vol-sfx').value = Math.round((this.audio.sfxVolume ?? 0.8) * 100);
    for (const id of ['vol-master', 'vol-music', 'vol-sfx']) document.getElementById(id + '-val').textContent = document.getElementById(id).value + '%';
    document.getElementById('minimap-default-hidden').checked = this._minimapDefaultHidden || false;
    document.getElementById('joystick-size').value = Math.round((this.input.joystickScale || 1) * 100);
    document.getElementById('joystick-size-val').textContent = Math.round((this.input.joystickScale || 1) * 100) + '%';
    this.lastTime = performance.now();
  },

  closeSettings() {
    this.state = this._settingsReturnState || 'playing';
    this.input.reset();
    document.getElementById('settings-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  _fadeIntoGame(setupFn) {
    const overlay = document.getElementById('game-fade-overlay');
    const FADE_MS = 400;
    this.audio.playGameplay(FADE_MS * 2);
    overlay.classList.add('active');
    setTimeout(() => {
      setupFn();
      // A plain timeout (not rAF) to let the DOM settle one tick before
      // fading back in — rAF can be throttled/paused on a backgrounded
      // tab, which would leave the overlay stuck black.
      setTimeout(() => overlay.classList.remove('active'), 30);
    }, FADE_MS);
  },

  startGame() {
    this._fadeIntoGame(() => this._doStartGame());
  },

  _doStartGame() {
    this.state = 'playing';
    this.runStats = { time: 0, pebbles: 0, food: 0, spotted: 0 };
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    this.lastTime = performance.now();
  },

  resetGame() {
    this._fadeIntoGame(() => this._doResetGame());
  },

  _doResetGame() {
    this.state = 'playing';
    this._outside = null;      // discard any interior we died inside
    this._wokeCamper = false;
    this._interiors = new Map();
    this.decoys = [];
    this.floaters = [];
    // Persistent quests and day survive a retry.
    this._saveHomeFarmState();
    this.updateQuestChip();
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    document.getElementById('dialogue-overlay').classList.add('hidden');
    document.getElementById('craft-overlay').classList.add('hidden');
    document.getElementById('backpack-overlay').classList.add('hidden');
    document.getElementById('shop-overlay').classList.add('hidden');

    // Force areaType back to campsite (original starting area)
    this._worldConfig.areaType = 'campsite';

    // Regenerate the campsite world
    const genData = new WorldGenerator(this._worldConfig).generate();
    this.world = new World(genData);

    // Preserve items and pebbles — player keeps their loot when caught!
    const savedItems = [...this.player.items];
    const savedPebbles = this.player.pebbles;

    // Get spawn point from campsite world's lake zone
    const lakeZone = this.world.zones.find(z => z.type === 'lake');
    const spawnX = lakeZone ? lakeZone.spawnX : 600;
    const spawnY = lakeZone ? lakeZone.spawnY : 150;
    this.player.reset(spawnX, spawnY);
    this.player.items = savedItems;
    this.player.pebbles = savedPebbles;

    // Spawn guards and apply dev settings
    this.initGuards(genData.guardPatrols);
    this._applyDevSettingsToGuards();
    this._spawnWorldLife();
    this.runStats = { time: 0, pebbles: 0, food: 0, spotted: 0 };

    this.updateHUD();
    this.saveProfile();
    this.lastTime = performance.now();
  },
  openDevMenu() {
    this.state = 'paused';
    document.getElementById('dev-menu').classList.remove('hidden');
    this.updateSpeedRatio();
    // Show current world seed
    document.getElementById('dev-current-seed').textContent = this.world.seed || '—';
    // Populate diagnostics and keep them live while the menu is open
    this.renderSpriteGallery();
    this.refreshDebugPanel();
    clearInterval(this._debugInterval);
    this._debugInterval = setInterval(() => this.refreshDebugPanel(), 500);
  },

  closeDevMenu() {
    this.state = 'playing';
    document.getElementById('dev-menu').classList.add('hidden');
    this.lastTime = performance.now();
    clearInterval(this._debugInterval);
    clearTimeout(this._spriteGalleryRetry);
  },

  updateSpeedRatio() {
    const playerSpeed = parseFloat(document.getElementById('dev-player-speed').value);
    const chaseSpeed = parseFloat(document.getElementById('dev-chase-speed').value);
    const ratio = (playerSpeed / chaseSpeed).toFixed(2);
    const el = document.getElementById('dev-speed-ratio');
    if (el) el.textContent = ratio + 'x';
  },

  _populateSpawnItemSelect() {
    const sel = document.getElementById('dev-spawn-select');
    if (!sel) return;
    const foodDefs = [
      { name: 'Hot Dog', type: 'food', value: 12, emoji: '🌭' },
      { name: 'Burger', type: 'food', value: 25, emoji: '🍔' },
      { name: 'Sandwich', type: 'food', value: 18, emoji: '🥪' },
      { name: 'Pizza Slice', type: 'food', value: 20, emoji: '🍕' },
      { name: 'Corn Dog', type: 'food', value: 14, emoji: '🌽' },
      { name: 'Fish Taco', type: 'food', value: 22, emoji: '🌮' },
      { name: 'Soggy Fries', type: 'food', value: 8, emoji: '🍟' },
      { name: 'Half-Eaten Donut', type: 'food', value: 10, emoji: '🍩' },
      { name: 'Cold Ice Cream', type: 'food', value: 16, emoji: '🍦' },
      { name: 'Apple Core', type: 'food', value: 5, emoji: '🍏' },
      { name: 'Fresh Soda', type: 'drink', value: 10, emoji: '🥤' },
      { name: 'Glow Ring', type: 'treasure', value: 15, emoji: '💍' },
      { name: 'Shiny Wrapper', type: 'trash', value: 7, emoji: '✨' },
      { name: 'Empty Can', type: 'trash', value: 1, emoji: '🥫' },
      { name: 'Crumpled Receipt', type: 'trash', value: 2, emoji: '🧾' },
      { name: 'Banana Peel', type: 'trash', value: 3, emoji: '🍌' },
    ];
    this._spawnDefs = { food: foodDefs, material: MATERIALS, tool: TOOLS };

    const foodGroup = document.createElement('optgroup');
    foodGroup.label = 'Food & Loot';
    foodDefs.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = `food:${i}`;
      opt.textContent = `${d.emoji} ${d.name}`;
      foodGroup.appendChild(opt);
    });
    sel.appendChild(foodGroup);

    const matGroup = document.createElement('optgroup');
    matGroup.label = 'Materials';
    Object.entries(MATERIALS).forEach(([id, m]) => {
      const opt = document.createElement('option');
      opt.value = `material:${id}`;
      opt.textContent = `${m.emoji} ${m.name}`;
      matGroup.appendChild(opt);
    });
    sel.appendChild(matGroup);

    const toolGroup = document.createElement('optgroup');
    toolGroup.label = 'Tools';
    Object.entries(TOOLS).forEach(([id, t]) => {
      const opt = document.createElement('option');
      opt.value = `tool:${id}`;
      opt.textContent = `${t.emoji} ${t.name}`;
      toolGroup.appendChild(opt);
    });
    sel.appendChild(toolGroup);
  },

  openComputer(computer) {
    this.state = 'computer';
    this._computerHostName = computer?.hostName || this.world.areaName || 'Town Shop';
    document.getElementById('computer-overlay')?.classList.remove('hidden');
    this.updateComputerUI();
  },

  closeComputer() {
    if (this.state !== 'computer') return;
    this.state = 'playing';
    document.getElementById('computer-overlay')?.classList.add('hidden');
    this.lastTime = performance.now();
  },

  updateComputerUI() {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText('computer-host-name', this._computerHostName || 'Unknown Shop');
    setText('computer-pebbles-value', this.player.pebbles);

    const ownedList = document.getElementById('computer-owned-discs');
    const storeList = document.getElementById('computer-store-discs');
    if (!ownedList || !storeList) return;

    const owned = DISC_CATALOG.filter(d => this.ownedDiscs.includes(d.id));
    ownedList.innerHTML = '';
    if (!owned.length) {
      ownedList.innerHTML = '<div class="computer-empty">No discs installed. Grab the free demo or buy one from the shelf.</div>';
    } else {
      owned.forEach((disc) => {
        const progress = this.discProgress[disc.id] || {};
        const stat = progress.best ? `Best ${progress.best}` : progress.completed ? 'Completed' : 'Fresh disc';
        const card = document.createElement('div');
        card.className = 'computer-disc-card owned';
        card.innerHTML = `
          <div class="computer-disc-orb" style="--disc-accent:${disc.accent}"></div>
          <div class="computer-disc-info">
            <h3>${this._escapeHtml(disc.name)}</h3>
            <p>${this._escapeHtml(stat)}</p>
          </div>
          <button class="btn-buy">Boot</button>`;
        card.querySelector('button').addEventListener('click', () => this.bootDisc(disc.id));
        ownedList.appendChild(card);
      });
    }

    storeList.innerHTML = '';
    DISC_CATALOG.forEach((disc) => {
      const ownedDisc = this.ownedDiscs.includes(disc.id);
      const card = document.createElement('div');
      card.className = `computer-disc-card ${ownedDisc ? 'owned' : ''}`;
      card.innerHTML = `
        <div class="computer-disc-orb" style="--disc-accent:${disc.accent}"></div>
        <div class="computer-disc-info">
          <h3>${this._escapeHtml(disc.name)}</h3>
          <p>${this._escapeHtml(disc.desc)}</p>
          <div class="shop-card-price">${disc.cost ? `${disc.cost} Pebbles` : 'Free demo disc'}</div>
        </div>
        <button class="btn-buy ${ownedDisc ? 'owned' : ''}" ${ownedDisc || this.player.pebbles < disc.cost ? 'disabled' : ''}>${ownedDisc ? 'Installed' : disc.cost ? 'Buy' : 'Install'}</button>`;
      const btn = card.querySelector('button');
      if (!ownedDisc) btn.addEventListener('click', () => this.buyDisc(disc.id));
      storeList.appendChild(card);
    });
  },

  _flashBackpackHud() {
    const btn = document.getElementById('btn-open-backpack-hud');
    if (!btn) return;
    btn.classList.remove('bag-attention');
    void btn.offsetWidth;
    btn.classList.add('bag-attention');
    clearTimeout(this._bagAttentionTimer);
    this._bagAttentionTimer = setTimeout(() => btn.classList.remove('bag-attention'), 800);
  },

  _notifyBackpackFull(message = 'Backpack full - make room or drop something.') {
    this._flashBackpackHud();
    this.showAlert(`${message} Open the backpack with I.`);
  },

  _compassDir(dx, dy) {
    const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    const angle = Math.atan2(dy, dx);
    const index = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    return dirs[index];
  },

  _nearestLandmarkSummary() {
    const marks = this.world?.getLandmarks?.() || [];
    if (!marks.length) return '';
    let nearest = null;
    let bestDist = Infinity;
    marks.forEach(mark => {
      const dist = Math.hypot(mark.x - this.player.x, mark.y - this.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = mark;
      }
    });
    if (!nearest) return '';
    const dir = this._compassDir(nearest.x - this.player.x, nearest.y - this.player.y);
    const tiles = Math.max(1, Math.round(bestDist / (this.world?.tileSize || 32)));
    return `Nearest: ${nearest.label} ${dir} ${tiles} tiles`;
  },

  _itemNoteText(item) {
    if (!item) return '';
    if (item.type === 'food' || item.type === 'drink') {
      return item.cooked
        ? `Snack now for hydration and a speed boost. Rat pays ${item.value} pebbles each.`
        : `Edible now, but cooking at a fire improves the payout. Rat pays ${item.value} pebbles each.`;
    }
    if (item.isFish) return 'Fresh catch. Cook it for more value or sell it at the Fish Market.';
    if (item.type === 'trash') return 'The rat recycles this into bottle caps.';
    if (item.type === 'treasure') return `Pocketable shiny. The rat buys it for ${item.value} pebbles.`;
    return `Worth ${item.value || 0} pebbles when traded.`;
  },

  updateHUD() {
    this._initHudIcons();
    document.getElementById('hydration-bar-fill').style.width = `${this.player.hydration}%`;
    document.getElementById('hydration-text').innerText = `${Math.round(this.player.hydration)}%`;

    // Low hydration pulse styling
    const hudBar = document.querySelector('.hydration-hud');
    if (this.player.hydration < 30) {
      hudBar.classList.add('low-hydration');
    } else {
      hudBar.classList.remove('low-hydration');
    }

    // Oxygen bar only appears while diving
    const oxygenHud = document.getElementById('oxygen-hud');
    if (oxygenHud) {
      oxygenHud.classList.toggle('hidden', !this.player.isDiving);
      if (this.player.isDiving) {
        const pct = Math.max(0, (this.player.oxygen / this.player.maxOxygen) * 100);
        document.getElementById('oxygen-bar-fill').style.width = `${pct}%`;
        document.getElementById('oxygen-text').innerText = `${Math.ceil(Math.max(0, this.player.oxygen))}s`;
        oxygenHud.classList.toggle('low-oxygen', this.player.oxygen < 10);
      }
    }

    document.getElementById('pebble-count').innerText = this.player.pebbles;
    const capsEl = document.getElementById('bottlecaps-count');
    if (capsEl) capsEl.innerText = this.player.bottleCaps;
    document.getElementById('backpack-count').innerText = `${this.player.items.length}/${this.player.backpackCapacity}`;

    const areaBadge = document.getElementById('area-badge');
    if (areaBadge && this.world) {
      areaBadge.innerText = `📍 ${this.world.areaName}`;
    }

    const areaBadgeSub = document.getElementById('area-badge-sub');
    if (areaBadgeSub) areaBadgeSub.textContent = this._nearestLandmarkSummary();

    // Day / time-of-day chip (sun climbs, sets, moon rises)
    const clockIcon = document.getElementById('clock-icon');
    const clockText = document.getElementById('clock-text');
    if (clockIcon && clockText) {
      const t = this.timeOfDay;
      const phase = t < 0.2 ? 'moon' : t < 0.3 ? 'sunrise' : t < 0.7 ? 'sun' : t < 0.8 ? 'sunrise' : 'moon';
      if (spriteReady(Sprites.emojiIcons)) {
        this._paintSpriteIcon(clockIcon, Sprites.emojiIcons, HUD_ICON_SPRITES[phase], 0.55);
      } else {
        clockIcon.innerText =
          t < 0.2 ? '🌙' : t < 0.3 ? '🌅' : t < 0.7 ? '☀️' : t < 0.8 ? '🌇' : '🌙';
      }
      // Map 0-1 to a 24h clock starting at midnight, so the chip reads as
      // an actual time-of-day rather than just an abstract fraction.
      const totalMins = Math.floor(t * 24 * 60);
      let hour24 = Math.floor(totalMins / 60);
      const min = totalMins % 60;
      const ampm = hour24 < 12 ? 'AM' : 'PM';
      let hour12 = hour24 % 12; if (hour12 === 0) hour12 = 12;
      clockText.innerText = `Day ${this.dayCount} · ${hour12}:${String(min).padStart(2, '0')} ${ampm}`;
    }
    const clockFill = document.getElementById('clock-fill');
    if (clockFill) clockFill.style.width = `${Math.round(this.timeOfDay * 100)}%`;

    this.renderActionBar();
    this._unlockCheck();
  },

  _unlockCheck() {
    const stats = { ...this.stats, pebblesLifetime: this.scorePebbles, foodSoldLifetime: this.scoreFoodSold };
    const newly = this.achievements.checkAll(stats, this.player);
    if (newly.length) {
      newly.forEach(a => this._queueAchievementToast(a));
      this.saveProfile();
    }
  },

  _queueAchievementToast(a) {
    this._achvQueue.push(a);
    if (!this._achvToastBusy) this._advanceAchvToast();
  },

  _advanceAchvToast() {
    if (this._achvQueue.length === 0) { this._achvToastBusy = false; return; }
    this._achvToastBusy = true;
    const a = this._achvQueue.shift();
    const toast = document.getElementById('achievement-toast');
    if (!toast) { this._advanceAchvToast(); return; }
    document.getElementById('achv-toast-icon').textContent = a.icon;
    document.getElementById('achv-toast-name').textContent = a.name;
    toast.classList.add('show');
    this.playSound('upgrade');
    clearTimeout(this._achvToastTimer);
    this._achvToastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => this._advanceAchvToast(), 400);
    }, 3000);
  },

  openAchievements() {
    this.state = 'paused';
    document.getElementById('achievements-overlay').classList.remove('hidden');
    this.updateAchievementsUI();
  },

  closeAchievements() {
    this.state = 'playing';
    document.getElementById('achievements-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  openWardrobe() {
    this.state = 'paused';
    document.getElementById('wardrobe-overlay').classList.remove('hidden');
    this.updateWardrobeUI();
  },

  closeWardrobe() {
    this.state = 'playing';
    document.getElementById('wardrobe-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  openPet() {
    this.state = 'paused';
    document.getElementById('pet-overlay').classList.remove('hidden');
    this.updatePetUI();
  },

  closePet() {
    this.state = 'playing';
    document.getElementById('pet-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  updatePetUI() {
    const emptyView = document.getElementById('pet-empty-view');
    const list = document.getElementById('pet-care-list');
    if (!list) return;
    list.innerHTML = '';

    if (!this.pets.length) {
      emptyView.classList.remove('hidden');
      return;
    }
    emptyView.classList.add('hidden');

    // Fetching a pet back is only doable while standing in the home cabin.
    // Leaving one there needs an Air Helmet until the pump makes the room dry.
    const atHomeCabin = !!this.world.isHomeCabin;
    this.pets.forEach((pet, idx) => {
      const k = PET_KINDS[pet.kind];
      const hasFood = this.player.items.some(it => it.type === 'food' || it.type === 'drink');
      const card = document.createElement('div');
      card.className = 'shop-card pet-care-card';
      // Leaving a pet home now happens in-world (interact with the pet
      // bed in the cabin — see _findFollowingPetNearBed) rather than from
      // this menu; only the reverse ("bring them back") stays here.
      let homeBtnHtml = '';
      if (pet.atHome) {
        homeBtnHtml = `<button class="btn-secondary btn-pet-home" ${atHomeCabin ? '' : 'disabled'} title="${atHomeCabin ? '' : 'Visit the cabin to bring them along'}">🚶 Bring Along</button>`;
      }
      card.innerHTML = `
        <div class="shop-card-icon">${k.emoji}</div>
        <div class="shop-card-info">
          <h3>${pet.name}${pet.atHome ? ' <span class="pet-home-tag">🫧 home</span>' : ''}</h3>
          <div class="pet-stat"><label>Hunger</label><div class="pet-bar"><div class="pet-bar-fill" style="width:${Math.round(pet.hunger)}%"></div></div></div>
          <div class="pet-stat"><label>Happiness</label><div class="pet-bar"><div class="pet-bar-fill happy" style="width:${Math.round(pet.happiness)}%"></div></div></div>
        </div>
        <div class="pet-actions">
          <button class="btn-primary btn-pet-feed" ${hasFood ? '' : 'disabled'}>🍖 Feed</button>
          <button class="btn-secondary btn-pet-play">🎾 Pet</button>
          <button class="btn-secondary btn-pet-together" ${atHomeCabin ? '' : 'disabled'}>🐾 Play Together</button>
          ${homeBtnHtml}
        </div>`;
      card.querySelector('.btn-pet-feed').addEventListener('click', () => this.feedPet(idx));
      card.querySelector('.btn-pet-play').addEventListener('click', () => this.playWithPet(idx));
      card.querySelector('.btn-pet-together').addEventListener('click', () => this.startCompanionPlay(idx));
      const homeBtn = card.querySelector('.btn-pet-home');
      if (homeBtn && !homeBtn.disabled) homeBtn.addEventListener('click', () => this.toggleHomePet(idx));
      list.appendChild(card);
    });
  },

  updatePetChip() {
    const chip = document.getElementById('pet-chip');
    if (!chip) return;
    const following = this.pets.filter(p => !p.atHome);
    if (!following.length) {
      chip.classList.add('hidden');
      return;
    }
    chip.classList.remove('hidden');
    document.getElementById('pet-chip-icon').textContent = following.map(p => PET_KINDS[p.kind].emoji).join(' ');
    document.getElementById('pet-chip-mood').textContent = following.map(p => p.moodEmoji).join(' ');
  },

  equipSkin(id) {
    const skin = findSkin(id);
    if (!isSkinUnlocked(skin, this.achievements)) return;
    this.player.skinId = skin.id;
    this.player.skinHue = skin.hue;
    this.playSound('upgrade');
    this.saveProfile();
    this.updateWardrobeUI();
  },

  updateWardrobeUI() {
    const grid = document.getElementById('wardrobe-grid');
    if (!grid) return;
    grid.innerHTML = SKINS.map(skin => {
      const unlocked = isSkinUnlocked(skin, this.achievements);
      const equipped = this.player.skinId === skin.id;
      const lockAchv = skin.unlockedBy ? ACHIEVEMENTS.find(a => a.id === skin.unlockedBy) : null;
      const status = unlocked
        ? (equipped ? 'Equipped' : 'Tap to equip')
        : `Unlock: ${lockAchv ? lockAchv.name : '???'}`;
      return `
        <div class="wardrobe-card ${unlocked ? 'unlocked' : 'locked'} ${equipped ? 'equipped' : ''}">
          <div class="wardrobe-swatch" style="background: hsl(${skin.hue}, 100%, 68%);"></div>
          <div class="wardrobe-info">
            <h3>${skin.name}</h3>
            <p>${status}</p>
          </div>
          ${unlocked && !equipped ? `<button class="btn-buy" data-skin="${skin.id}">Equip</button>` : ''}
        </div>`;
    }).join('');
    grid.querySelectorAll('button[data-skin]').forEach(btn => {
      btn.addEventListener('click', () => this.equipSkin(btn.getAttribute('data-skin')));
    });
  },

  openCabinStorage() {
    this.state = 'paused';
    document.getElementById('cabin-storage-overlay').classList.remove('hidden');
    this.updateCabinStorageUI();
  },

  closeCabinStorage() {
    this.state = 'playing';
    document.getElementById('cabin-storage-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  updateCabinStorageUI() {
    if (this.hasShellShelf) this.cabinStorage.items.sort((a,b) => (a.type || '').localeCompare(b.type || '') || a.name.localeCompare(b.name));
    // Same square-tile grid look as the real backpack (.inventory-slot),
    // rather than the old wide list-row cards — locked slots only make
    // sense for the backpack side since the shed itself is unlimited.
    const renderGrid = (container, items, actionLabel, onAction, opts = {}) => {
      if (!container) return;
      container.innerHTML = '';
      const capacity = opts.capacity ?? Infinity;
      const visibleSlots = Number.isFinite(capacity)
        ? Math.max(capacity, items.length)
        : Math.max(6, Math.ceil((items.length + 1) / 3) * 3);

      for (let index = 0; index < visibleSlots; index++) {
        const item = items[index];
        const slot = document.createElement('div');
        slot.className = 'backpack-card inventory-slot';

        if (index >= capacity) {
          slot.classList.add('slot-locked');
          slot.innerHTML = '<div class="slot-lock">🔒</div><div class="slot-name">Locked</div>';
          container.appendChild(slot);
          continue;
        }
        if (!item) {
          slot.classList.add('slot-empty');
          slot.innerHTML = '<div class="slot-plus">+</div>';
          container.appendChild(slot);
          continue;
        }

        const qty = item.qty || 1;
        slot.title = `${item.name} (${item.type || 'item'})`;
        slot.innerHTML = `
          <div class="backpack-card-emoji">${item.emoji || '📦'}${qty > 1 ? `<span class="backpack-card-qty">x${qty}</span>` : ''}</div>
          <div class="backpack-card-details">
            <h3>${item.name}</h3>
            <p>✨ ${item.value || 0}${qty > 1 ? ` ea` : ''}</p>
          </div>
          <div class="backpack-card-actions">
            <button class="btn-drop">${actionLabel}</button>
          </div>
        `;
        slot.querySelector('.btn-drop').addEventListener('click', () => onAction(index));
        container.appendChild(slot);
      }
    };

    renderGrid(
      document.getElementById('cabin-storage-list'),
      this.cabinStorage.items, 'Take',
      (i) => this.takeItem(i)
    );
    renderGrid(
      document.getElementById('cabin-backpack-list'),
      this.player.items, 'Store',
      (i) => this.storeItem(i),
      { capacity: this.player.backpackCapacity }
    );
  },

  updateAchievementsUI() {
    const { unlocked, total } = this.achievements.progress;
    const header = document.getElementById('achv-progress');
    if (header) header.textContent = `${unlocked} / ${total} unlocked`;

    const grid = document.getElementById('achv-grid');
    if (!grid) return;
    grid.innerHTML = ACHIEVEMENTS.map(a => {
      const isUnlocked = this.achievements.isUnlocked(a.id);
      const showHidden = a.hidden && !isUnlocked;
      return `
        <div class="achv-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="achv-icon">${showHidden ? '❔' : a.icon}</div>
          <div class="achv-info">
            <h3>${showHidden ? '???' : a.name}</h3>
            <p>${showHidden ? 'Keep playing to discover this one.' : a.desc}</p>
          </div>
        </div>`;
    }).join('');
  },

  initDebug() {
    this.debugLog = [];        // ring buffer of { t, level, msg }
    this.debugMax = 60;        // keep the last N entries
    this._lastError = null;    // most recent uncaught error, shown in stats
    this._loopErrored = false; // guards against error spam every frame
    this._fps = 0;
    this._frameAccum = 0;
    this._frameCount = 0;

    // Catch synchronous errors that would otherwise only hit the console.
    window.addEventListener('error', (e) => {
      this._lastError = e.message || String(e.error);
      this.logDebug('error', `Uncaught: ${e.message} @ ${e.filename?.split('/').pop() || '?'}:${e.lineno}`);
    });
    // Catch rejected promises (async silent failures).
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason?.message || String(e.reason);
      this._lastError = reason;
      this.logDebug('error', `Unhandled promise: ${reason}`);
    });

    this.logDebug('info', 'Game initialized');
  },

  logDebug(level, msg) {
    if (!this.debugLog) return;
    const entry = { t: new Date().toLocaleTimeString('en-US', { hour12: false }), level, msg };
    this.debugLog.push(entry);
    if (this.debugLog.length > this.debugMax) this.debugLog.shift();

    const c = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    c(`[Diag] ${msg}`);

    const menu = document.getElementById('dev-menu');
    if (menu && !menu.classList.contains('hidden')) this.refreshDebugPanel();
  },

  renderSpriteGallery() {
    const gallery = document.getElementById('dev-sprite-gallery');
    if (!gallery) return;

    const sheetFor = (src) => {
      if (src === 'basic') return Sprites.furniture;
      if (src === 'modern') return Sprites.modernInteriors;
      if (src === 'topdownCool') return Sprites.furnitureCool;
      if (src === 'smallItems') return Sprites.smallItems;
      if (src === 'workStation') return Sprites.workStation;
      return Sprites.furnitureWarm;
    };

    const entries = [
      ...Object.entries(FURNITURE).map(([name, piece]) => ({
        name,
        src: piece.src,
        crop: piece,
        drawW: piece.drawW
      })),
      ...Object.entries(RUG_PIECES).map(([name, piece]) => ({
        name: `rug_${name}`,
        src: piece.src || 'modern',
        crop: piece,
        drawW: piece.drawW
      })),
      { name: 'special_home_bed', src: 'topdown', crop: HOME_BED_SPRITE },
      { name: 'special_wardrobe', src: 'topdown', crop: WARDROBE_SPRITE },
      { name: 'special_petbed', src: 'topdown', crop: PETBED_SPRITE },
      { name: 'special_counter', src: 'topdownCool', crop: COUNTER_SPRITE },
      { name: 'special_workstation', src: 'workStation', crop: WORKSTATION_SPRITE },
      { name: 'special_clock', src: 'smallItems', crop: CLOCK_SPRITE },
      { name: 'special_dogbone', src: 'smallItems', crop: DOGBONE_SPRITE },
      { name: 'special_smallplant', src: 'smallItems', crop: SMALL_PLANT_SPRITE },
    ];

    gallery.replaceChildren();
    let needsRetry = false;

    entries.forEach((entry) => {
      const img = sheetFor(entry.src);
      const crop = entry.crop;
      const card = document.createElement('div');
      card.className = 'dev-sprite-card';

      const title = document.createElement('div');
      title.className = 'dev-sprite-title';
      title.textContent = entry.name;

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'dev-sprite-preview';

      if (spriteReady(img)) {
        const canvas = document.createElement('canvas');
        const maxPreview = 96;
        const scale = Math.max(1, Math.min(4, Math.floor(maxPreview / Math.max(crop.sw, crop.sh)) || 1));
        const pad = 8;
        canvas.width = crop.sw * scale + pad * 2;
        canvas.height = crop.sh * scale + pad * 2;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const cell = 8;
        for (let y = 0; y < canvas.height; y += cell) {
          for (let x = 0; x < canvas.width; x += cell) {
            ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? '#1f2937' : '#111827';
            ctx.fillRect(x, y, cell, cell);
          }
        }

        ctx.strokeStyle = '#facc15';
        ctx.strokeRect(pad - 0.5, pad - 0.5, crop.sw * scale + 1, crop.sh * scale + 1);
        ctx.drawImage(
          img,
          crop.sx, crop.sy, crop.sw, crop.sh,
          pad, pad, crop.sw * scale, crop.sh * scale
        );
        canvasWrap.appendChild(canvas);
      } else {
        needsRetry = true;
        const loading = document.createElement('span');
        loading.className = 'dev-sprite-loading';
        loading.textContent = 'loading';
        canvasWrap.appendChild(loading);
      }

      const meta = document.createElement('div');
      meta.className = 'dev-sprite-meta';
      meta.textContent = `${entry.src} ${crop.sx},${crop.sy} ${crop.sw}x${crop.sh}` +
        (entry.drawW ? ` drawW ${entry.drawW}` : '');

      card.append(title, canvasWrap, meta);
      gallery.appendChild(card);
    });

    if (needsRetry) {
      clearTimeout(this._spriteGalleryRetry);
      this._spriteGalleryRetry = setTimeout(() => this.renderSpriteGallery(), 250);
    }
  },

  refreshDebugPanel() {
    const stats = document.getElementById('dev-debug-stats');
    if (stats) {
      const p = this.player;
      const w = this.world;
      const activeGuards = this.guards ? this.guards.filter(g => g.state === 'chase').length : 0;
      stats.textContent =
        `FPS:      ${this._fps.toFixed(0)}\n` +
        `State:    ${this.state}\n` +
        `Player:   (${p ? p.x.toFixed(0) : '?'}, ${p ? p.y.toFixed(0) : '?'})  hydration ${p ? p.hydration.toFixed(0) : '?'}%\n` +
        `Guards:   ${this.guards ? this.guards.length : 0} (${activeGuards} chasing)\n` +
        `World:    ${w ? w.cols + 'x' + w.rows : '?'} tiles, seed ${w ? w.seed : '?'}\n` +
        `Colliders:${w && w.colliders ? ' ' + w.colliders.length : ' ?'}   Items: ${w && w.items ? w.items.length : '?'}\n` +
        `Backpack: ${p && p.items ? p.items.length : 0}/${p ? p.backpackCapacity : '?'} item(s)\n` +
        `LastError:${this._lastError ? ' ' + this._lastError : ' none'}`;
    }

    const logEl = document.getElementById('dev-debug-log');
    if (logEl) {
      if (!this.debugLog.length) {
        logEl.innerHTML = '<span class="log-empty">No events logged.</span>';
      } else {
        logEl.innerHTML = this.debugLog
          .slice()
          .reverse()
          .map(e => `<div class="log-line"><span class="log-time">${e.t}</span><span class="log-${e.level}">${this._escapeHtml(e.msg)}</span></div>`)
          .join('');
      }
    }
  },

  formatDialogue(text) {
    return this._escapeHtml(text)
      .replace(/(\d+\s+)?(Shiny\s+)?Pebbles?/gi, m => `<span class="hl-pebble">${m}</span>`)
      .replace(/snacks?|food|coolers?|trash cans?/gi, m => `<span class="hl-food">${m}</span>`)
      .replace(/Water Helmet|BACKPACK FULL/gi, m => `<span class="hl-special">${m}</span>`)
      .replace(/guards?|lifeguards?/gi, m => `<span class="hl-danger">${m}</span>`);
  },

  setDialogueText(text) {
    document.getElementById('dialogue-text').innerHTML = this.formatDialogue(text);
  },

  _escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  updateQuestChip() {
    const chip = document.getElementById('quest-chip');
    if (!chip) return;
    if (this.quest) {
      chip.classList.remove('hidden');
      document.getElementById('quest-text').innerText =
        `${this.quest.text} ${this.quest.progress}/${this.quest.n}`;
    } else {
      chip.classList.add('hidden');
    }
  },

  showAlert(message, duration = 3000) {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;

    banner.querySelector('.alert-text').innerHTML = this.formatDialogue(message);
    banner.classList.remove('hidden');

    if (this._alertTimeout) clearTimeout(this._alertTimeout);
    this._alertTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, duration);
  },

  showGateNotice(title, message, icon = '!', duration = 3200) {
    const notice = document.getElementById('gate-notice');
    if (!notice) {
      this.showAlert(message, duration);
      return;
    }

    const iconEl = notice.querySelector('.gate-notice-icon');
    const titleEl = notice.querySelector('.gate-notice-title');
    const textEl = notice.querySelector('.gate-notice-text');
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.innerHTML = this.formatDialogue(message);

    notice.classList.remove('hidden');
    notice.classList.remove('gate-notice-pop');
    void notice.offsetWidth;
    notice.classList.add('gate-notice-pop');

    if (this._gateNoticeTimeout) clearTimeout(this._gateNoticeTimeout);
    this._gateNoticeTimeout = setTimeout(() => {
      notice.classList.add('hidden');
      notice.classList.remove('gate-notice-pop');
    }, duration);
  },

  openCrafting() {
    this.state = 'paused';
    document.getElementById('craft-overlay').classList.remove('hidden');
    this.updateCraftUI();
  },

  closeCrafting() {
    this.state = 'playing';
    document.getElementById('craft-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  updateCraftUI() {
    // Pouch summary in the header
    const mats = this.player.materials;
    const summary = Object.entries(mats)
      .map(([id, n]) => `${MATERIALS[id].emoji}${n}`).join(' ');
    document.getElementById('craft-mats-summary').innerHTML = summary || 'Pouch empty — loot trash cans!';

    const list = document.getElementById('craft-recipes');
    list.innerHTML = '';
    RECIPES.forEach(r => {
      const affordable = canCraft(r, mats);
      const owned = this.player.tools[r.id] || 0;
      const matsHtml = Object.entries(r.mats).map(([id, n]) => {
        const have = mats[id] || 0;
        return `<span class="${have >= n ? 'mat-ok' : 'mat-missing'}">${MATERIALS[id].emoji} ${have}/${n}</span>`;
      }).join(' ');
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML = `
        <div class="shop-card-icon">${r.emoji}</div>
        <div class="shop-card-info">
          <h3>${r.name}${owned ? ` <span class="tool-owned">x${owned}</span>` : ''}</h3>
          <p>${r.desc}</p>
          <div class="shop-card-price">${matsHtml}</div>
        </div>
        <button class="btn-buy" ${affordable ? '' : 'disabled'}>Craft</button>`;
      card.querySelector('.btn-buy').addEventListener('click', () => this.craftItem(r));
      list.appendChild(card);
    });
  },

  selectActionSlot(index) {
    if (index < 0 || index >= this.actionSlots.length) return;
    this.selectedActionSlot = index;
    this.renderActionBar();
  },

  renderActionBar() {
    const bar = document.getElementById('action-bar');
    if (!bar) return;

    if (bar.children.length !== this.actionSlots.length) {
      bar.replaceChildren();
      this.actionSlots.forEach((slot, index) => {
        const btn = document.createElement('button');
        btn.className = 'action-slot';
        btn.innerHTML = `
          <span class="action-slot-key">${index + 1}</span>
          <span class="action-slot-icon"></span>
          <span class="action-slot-label">${slot.label}</span>
          <span class="action-slot-count"></span>
        `;
        btn.addEventListener('click', () => {
          if (index === this.selectedActionSlot && this.state === 'playing') {
            const plot = this._findFarmPlotAt();
            if (plot && this._interactFarmPlot(plot)) return;
            this.useSelectedActionSlot();
            return;
          }
          this.selectActionSlot(index);
        });
        bar.appendChild(btn);
      });
    }

    this.actionSlots.forEach((slot, index) => {
      const btn = bar.children[index];
      btn.className = `action-slot${index === this.selectedActionSlot ? ' selected' : ''}`;
      btn.title = `${index + 1}: ${slot.label}`;
      btn.setAttribute('aria-label', slot.label);
      btn.setAttribute('aria-pressed', String(index === this.selectedActionSlot));
      this._paintActionSlotIcon(slot, btn.querySelector('.action-slot-icon'));
      const count = this._actionSlotCount(slot.id);
      const countEl = btn.querySelector('.action-slot-count');
      countEl.textContent = count !== null ? count : '';
      countEl.style.display = count !== null ? '' : 'none';
    });
  },

  _paintActionSlotIcon(slot, iconEl) {
    if (slot.id === 'seeds' && spriteReady(Sprites.farmingItems)) {
      this._paintSpriteIcon(iconEl, Sprites.farmingItems, SEED_ICON_SPRITE, 2.5);
      return;
    }
    if (slot.id === 'water' && spriteReady(Sprites.emojiIcons)) {
      this._paintSpriteIcon(iconEl, Sprites.emojiIcons, HUD_ICON_SPRITES.wateringCan, 1);
      return;
    }
    iconEl.style.backgroundImage = '';
    iconEl.style.width = '';
    iconEl.style.height = '';
    if (slot.id === 'snack') {
      const food = this.player.items.find(i => i.type === 'food' || i.type === 'drink');
      iconEl.textContent = food?.emoji || slot.icon;
      return;
    }
    iconEl.textContent = slot.icon;
  },

  _paintSpriteIcon(iconEl, sheetImg, crop, scale) {
    iconEl.textContent = '';
    iconEl.style.display = 'inline-block';
    iconEl.style.width = `${crop.sw * scale}px`;
    iconEl.style.height = `${crop.sh * scale}px`;
    iconEl.style.backgroundImage = `url(${sheetImg.src})`;
    iconEl.style.backgroundPosition = `-${crop.sx * scale}px -${crop.sy * scale}px`;
    iconEl.style.backgroundSize = `${sheetImg.naturalWidth * scale}px ${sheetImg.naturalHeight * scale}px`;
    iconEl.style.imageRendering = 'pixelated';
  },

  _initHudIcons() {
    if (this._hudIconsPainted) return;
    let allReady = true;
    const hydrationIcon = document.getElementById('hydration-icon');
    if (hydrationIcon) {
      if (spriteReady(Sprites.emojiIcons)) this._paintSpriteIcon(hydrationIcon, Sprites.emojiIcons, HUD_ICON_SPRITES.wateringCan, 0.7);
      else allReady = false;
    }
    const pebbleIcon = document.getElementById('pebble-icon');
    if (pebbleIcon) {
      if (spriteReady(Sprites.emojiIcons)) this._paintSpriteIcon(pebbleIcon, Sprites.emojiIcons, HUD_ICON_SPRITES.coin, 0.7);
      else allReady = false;
    }
    const capsIcon = document.getElementById('bottlecaps-icon');
    if (capsIcon) {
      if (spriteReady(Sprites.recycle)) this._paintSpriteIcon(capsIcon, Sprites.recycle, RECYCLE_SPRITES[0], 0.34);
      else allReady = false;
    }

    // Top-bar nav buttons + related icons — both sheets needed to be ready.
    if (spriteReady(Sprites.allIcons) && spriteReady(Sprites.smallItems)) {
      const paint = (id, sheet, crop, scale) => {
        const el = document.getElementById(id);
        if (el) this._paintSpriteIcon(el, sheet, crop, scale);
      };
      paint('nav-icon-shop', Sprites.allIcons, NAV_ICON_SPRITES.cart, 1);
      paint('nav-icon-achievements', Sprites.allIcons, NAV_ICON_SPRITES.trophy, 1);
      paint('achv-toast-icon', Sprites.allIcons, NAV_ICON_SPRITES.trophy, 1);
      paint('nav-icon-dev', Sprites.allIcons, NAV_ICON_SPRITES.gear, 1);
      paint('nav-icon-wardrobe', Sprites.smallItems, NAV_ITEM_SPRITES.hanger, 1);
      paint('nav-icon-pet', Sprites.smallItems, NAV_ITEM_SPRITES.dogBone, 1);
      paint('quest-icon', Sprites.smallItems, NAV_ITEM_SPRITES.openBook, 1);
    } else {
      allReady = false;
    }

    this._hudIconsPainted = allReady;
  },

  _actionSlotCount(id) {
    if (id === 'seeds') return this.farmSeedCount;
    if (id === 'snack') {
      const food = this.player.items.find(i => i.type === 'food' || i.type === 'drink');
      return food ? (food.qty || 1) : 0;
    }
    return null;
  },

  openBackpack() {
    if (this.state !== 'playing') return;
    this.state = 'backpack';
    document.getElementById('backpack-overlay').classList.remove('hidden');
    const title = document.querySelector('#backpack-overlay .inventory-titlebar h2');
    if (title) title.textContent = 'Backpack';
    this.updateBackpackUI();
  },

  closeBackpack() {
    if (this.state !== 'backpack') return;
    this.state = 'playing';
    document.getElementById('backpack-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  updateBackpackUI() {
    const listContainer = document.getElementById('backpack-items-list');
    const countEl = document.getElementById('backpack-item-count');
    if (!listContainer || !countEl) return;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('backpack-pebbles', this.player.pebbles);
    setText('backpack-bottlecaps', this.player.bottleCaps);
    setText('backpack-hydration', `${Math.round(this.player.hydration)}%`);
    setText('backpack-area', this.world?.areaName || 'Camp');
    setText('backpack-bag-size', `${this.player.backpackCapacity} slots`);
    countEl.textContent = `${this.player.items.length}/${this.player.backpackCapacity}`;

    const matsEl = document.getElementById('backpack-materials');
    if (matsEl) {
      const entries = Object.entries(this.player.materials);
      matsEl.innerHTML = entries.length
        ? entries.map(([id, n]) => {
            const mat = MATERIALS[id] || { emoji: '📦', name: id };
            return `<span class="mat-chip">${mat.emoji} ${mat.name} <b>x${n}</b></span>`;
          }).join('')
        : '<span class="inventory-empty-note">No materials yet</span>';
    }

    const toolsEl = document.getElementById('backpack-tools');
    if (toolsEl) {
      const owned = Object.entries(this.player.tools).filter(([, n]) => n > 0);
      toolsEl.innerHTML = owned.length ? '' : '<span class="inventory-empty-note">No tools yet</span>';
      owned.forEach(([id, n]) => {
        const t = TOOLS[id] || { emoji: '🧰', name: id, use: null };
        const row = document.createElement('span');
        row.className = 'mat-chip tool-chip';
        row.innerHTML = `${t.emoji} ${t.name} <b>x${n}</b>` +
          (t.use ? ` <button class="btn-use" data-tool="${id}">${t.use}</button>` : '');
        const btn = row.querySelector('.btn-use');
        if (btn) btn.addEventListener('click', () => this.useTool(id));
        toolsEl.appendChild(row);
      });
    }

    listContainer.innerHTML = '';
    const visibleSlots = Math.max(24, this.player.backpackCapacity);
    for (let index = 0; index < visibleSlots; index++) {
      const item = this.player.items[index];
      const unlocked = index < this.player.backpackCapacity;
      const card = document.createElement('div');
      card.className = 'backpack-card inventory-slot';

      if (!unlocked) {
        card.classList.add('slot-locked');
        card.innerHTML = '<div class="slot-lock">🔒</div><div class="slot-name">Locked</div>';
        listContainer.appendChild(card);
        continue;
      }

      if (!item) {
        card.classList.add('slot-empty');
        card.innerHTML = '<div class="slot-plus">+</div>';
        listContainer.appendChild(card);
        continue;
      }

      const qty = item.qty || 1;
      const value = item.value || 0;
      card.title = `${item.name} (${item.type || 'item'})`;
      const note = this._itemNoteText(item);
      card.innerHTML = `
        <div class="backpack-card-emoji">${item.emoji || '📦'}${qty > 1 ? `<span class="backpack-card-qty">x${qty}</span>` : ''}</div>
        <div class="backpack-card-details">
          <h3>${item.name}</h3>
          <p class="item-note">${note}</p>
          <p>✨ ${value}${qty > 1 ? ` ea / ${value * qty} total` : ''}</p>
        </div>
        <div class="backpack-card-actions">
          ${(item.type === 'food' || item.type === 'drink') ? '<button class="btn-eat">Snack</button>' : ''}
          <button class="btn-drop">Drop</button>
        </div>
      `;

      card.querySelector('.btn-drop')?.addEventListener('click', () => this.dropItem(index));
      card.querySelector('.btn-eat')?.addEventListener('click', () => {
        if (this.player.eatItem(index)) {
          this.playSound('refill');
          this.showAlert('Yum! Hydration up + speed boost!');
          this.updateHUD();
          this.updateBackpackUI();
        }
      });
      listContainer.appendChild(card);
    }
  },
};
