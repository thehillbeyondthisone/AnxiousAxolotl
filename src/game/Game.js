import { Input } from './Input.js';
import { FriendlyUI } from './FriendlyUI.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { NPC } from './NPC.js';
import { WorldGenerator } from './WorldGenerator.js';
import { AudioManager } from './AudioManager.js';
import { spawnCritters } from './Critter.js';
import { buildInterior } from './Interior.js';
import { buildUnderwaterZone } from './Underwater.js';
import { MATERIALS, RECIPES, TOOLS, canCraft } from './Crafting.js';
import { FishingMinigame, FISH } from './Fishing.js';
import { CookingMinigame, COOK_MULT } from './Cooking.js';
import { LockpickMinigame } from './Lockpicking.js';
import { AchievementTracker, ACHIEVEMENTS } from './Achievements.js';
import { SaveManager } from './SaveManager.js';
import { SKINS, isSkinUnlocked, findSkin } from './Unlockables.js';
import { Pet, PET_KINDS, TAME_REQUIREMENTS } from './Pet.js';
import { ShopMethods } from './ShopUI.js';
import { FarmMethods } from './Farming.js';
import { MinigameMethods } from './Minigames.js';
import { createDiscExperience } from './Discs.js';
import { DISC_CATALOG, findDisc } from './DiscCatalog.js';
import {
  Sprites,
  spriteReady,
  FURNITURE,
  RUG_PIECES,
  HOME_BED_SPRITE,
  WARDROBE_SPRITE,
  PETBED_SPRITE,
  COUNTER_SPRITE,
  WORKSTATION_SPRITE,
  CLOCK_SPRITE,
  DOGBONE_SPRITE,
  SMALL_PLANT_SPRITE,
  SEED_ICON_SPRITE,
  HUD_ICON_SPRITES,
  NAV_ICON_SPRITES,
  NAV_ITEM_SPRITES,
  RECYCLE_SPRITES
} from './AssetLoader.js';

export class Game {
  constructor() {
    // 1. Setup Canvas
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    // Recover if the tab was hidden/unlaid-out at construction time (camera would be 0x0).
    // Also reset the frame clock on resume: the rAF loop is throttled to a stop while the
    // tab is hidden, so without this the first frame back would bill the entire away-time
    // as one delta — jerking the day/night clock and physics forward. Same guard the
    // overlay-close paths use.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.resizeCanvas();
        this.lastTime = performance.now();
      }
    });

    // 2. Game State
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'
    this.lastTime = 0;
    this.scorePebbles = 0;
    this.scoreFoodSold = 0;

    // Achievements: lifetime counters (persisted) + the unlock tracker.
    // New achievements are pure data in Achievements.js — no new call sites
    // needed, checkAll() runs every updateHUD() tick.
    this.stats = {
      fishCaught: 0, dishesCooked: 0, perfectDishes: 0,
      locksOpened: 0, locksBroken: 0, marketFishSold: 0,
      questsCompleted: 0, maxDayReached: 1, leviathanCaught: 0
    };
    this.achievements = new AchievementTracker();
    this._achvQueue = [];
    this._achvToastBusy = false;

    // Home cabin storage shed (Whispering Woods) — unlimited, persistent
    this.cabinStorage = { items: [] };
    this.homeFarmState = null;
    this.farmSeedCount = 12;
    this.hasScarecrow = false;
    this.hasHomePump = false;
    this.hasCatTree = false;
    this.hasTurtleCove = false;
    this.hasShellShelf = false;
    this.hasSunPatch = false;
    this.selectedCropType = 'sproutroot';
    this.cropPests = [];
    this.selectedActionSlot = 0;
    this.actionSlots = [
      { id: 'seeds', label: 'Seeds', icon: '🌱' },
      { id: 'water', label: 'Water', icon: '💧' },
      { id: 'snack', label: 'Snack', icon: '🍪' },
    ];

    // 3. Initialize Game Components
    this.input = new Input({
      canMove: () => this.state === 'playing' && document.getElementById('dialogue-overlay').classList.contains('hidden'),
      canAct: () => ['playing', 'minigame', 'disc'].includes(this.state) && document.getElementById('dialogue-overlay').classList.contains('hidden')
    });
    this.isTransitioning = false;
    this.dropAmount = 1; // Items per container loot (dev menu tunable)
    this.materialLootMult = 1; // Crafting-material loot weight multiplier (dev menu tunable)

    // Visual juice: particle bursts + screen shake
    this.particles = [];
    this.screenShake = { timeLeft: 0, duration: 0, magnitude: 0 };
    this.devSweetSpotMult = 1; // dev-menu slider: widens/narrows all minigame sweet spots
    this._wasChased = false;
    
    // Generate the world procedurally
    this._worldConfig = { cols: 32, rows: 24, zoneSpacing: 12, treeDensity: 11, guardCount: 4 };
    const genData = new WorldGenerator(this._worldConfig).generate();
    this.world = new World(genData);
    
    // Spawn player in the Lake (Safe zone)
    const lakeZone = this.world.zones.find(z => z.type === 'lake');
    const spawnX = lakeZone ? lakeZone.spawnX : 600;
    const spawnY = lakeZone ? lakeZone.spawnY : 150;
    this.player = new Player(spawnX, spawnY);

    // Camera viewport {x, y, w, h} — logical (CSS-pixel) size, matches resizeCanvas
    this.camera = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };

    // 4. Create Guards from generated patrol data
    this.guards = [];
    this.initGuards(genData.guardPatrols);

    // 4b. Ambient wildlife + weather
    this.critters = [];
    this._spawnWorldLife();
    this.weather = { mode: 'clear', timer: 40 + Math.random() * 50 };
    this.rainDrops = [];

    // Per-run stats for the results screen
    this.runStats = { time: 0, pebbles: 0, food: 0, spotted: 0 };

    // Building interiors: cached per building so loot stays looted,
    // plus the saved outside state while the player is indoors.
    this._interiors = new Map();
    this._outside = null;
    this._wokeCamper = false;
    this.decoys = []; // active Decoy Ducks {x, y, t}
    this._stunnerCooldown = 0; // seconds until the Sneak Stun Slingshot can fire again
    this.pets = [];      // tamed companions (puppy/kitten), following the player
    this.wildPets = [];  // untamed animals currently in the loaded world (Woods only)

    // Floating pickup text (world-space "+1 Driftwood" popups)
    this.floaters = [];

    // Rising bubbles for the flooded home cabin (screen-space ambiance)
    this.bubbles = [];

    // Rat quests: the rat offers one objective at a time for bonus pebbles
    this.quest = null;
    this.dayCount = 1;

    // Active minigame (fishing, cooking, lockpicking, ... — while
    // state === 'minigame'). Each minigame implements the shared contract:
    // update(dt, held) -> sound|null, onAction(), draw(ctx, camera, player),
    // done, result. _onMinigameDone receives the finished instance.
    this.minigame = null;
    this._onMinigameDone = null;
    this.ownedDiscs = [];
    this.discProgress = {};
    this.activeDisc = null;
    this._activeDiscResolved = false;

    // 5. Minimap canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // 6. Sound System — sample-based SFX + a looping music track
    this.audio = new AudioManager();
    this.audio.init();
    const unlock = () => {
      this.audio.unlock();
      // Only default to the title track if nothing else has already
      // claimed a track this tick — e.g. clicking "Play Game" as your
      // very first interaction fires this same click's bubble-phase
      // handler *after* startGame() already called playGameplay(), and
      // an unconditional playTitle() here would stomp it back to title.
      if (!this.audio._activeTrack) this.audio.playTitle();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });

    // Day/night cycle: 0 = midnight, 0.5 = noon. Start mid-morning (0.35 ≈ 8:24 AM).
    // dayLengthSeconds controls how long a full 24h cycle takes in real time — a
    // relaxed pace so the sun and clock read as a gentle progression, not a fast-forward.
    this.timeOfDay = 0.35;
    this.dayLengthSeconds = 1200; // 20 real minutes per in-game day
    this._wasInWater = true;
    this._dustTimer = 0;

    // Persistent profile (pebbles, upgrades, lifetime stats). Each field owns
    // its own read/write (including any side effects), so adding a new
    // persisted value going forward is one `register()` call, not two
    // hand-written functions kept in sync by memory.
    this.saveManager = new SaveManager('resortRogueProfile');
    this._registerSaveFields();
    this.loadProfile();
    this._applyHomeUpgradeState();

    // 5b. Diagnostics / debug system (surface silent failures)
    this.initDebug();
    window.__game = this; // console/debug access

    // 6. Bind UI button click events
    this.bindUIEvents();
    this.renderActionBar();

    // 7. Bind Action Input triggers
    this.input.onAction(() => this.handleActionInteraction());
    this.friendlyUI = new FriendlyUI(this);

    // 8. Start Game Loop animation
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Set canvas width/height to fill container, adjusting viewport size.
   * Scales the backing store for devicePixelRatio so art stays crisp on
   * retina/high-DPI screens, while all game logic keeps using CSS-pixel
   * (logical) coordinates via camera.w/h.
   */
  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    if (this.camera) {
      this.camera.w = w;
      this.camera.h = h;
    }
  }

  /**
   * Initialize guard patrol routes and spawn them
   */
  /**
   * Initialize guards from generated patrol data, or use defaults.
   * @param {Array} patrols - Array of { role, points } from WorldGenerator
   */
  initGuards(patrols) {
    this.guards = [];
    if (patrols && patrols.length > 0) {
      patrols.forEach(p => {
        this.guards.push(new NPC(p.role, p.points));
      });
    } else {
      // Fallback defaults
      this.guards.push(new NPC('lifeguard', [{ x: 300, y: 360 }, { x: 900, y: 360 }]));
      this.guards.push(new NPC('security', [{ x: 300, y: 650 }, { x: 600, y: 900 }]));
    }
  }

  /**
   * Populate the current world with ambient critters.
   * Called after every world (re)generation.
   */
  _spawnWorldLife() {
    const isTown = this.world.areaType === 'town';
    this.critters = spawnCritters(
      this.world,
      isTown ? 2 : 4,
      isTown ? 0 : 1,
      isTown ? 0 : 1,
      isTown ? 0 : 1
    );
  }

  /**
   * Synthesize game sound effects programmatically
   */
  playSound(type) {
    this.audio.play(type);
  }

  /**
   * Register every persisted field once. get() reads live state for save();
   * set(value) applies a loaded value (plus any side effects) for load().
   * Add a new persisted value by adding one register() call here — nothing
   * else needs to change.
   */
  _registerSaveFields() {
    const s = this.saveManager;
    const p = () => this.player;

    s.register('pebbles', () => p().pebbles, (v) => { p().pebbles = v || 0; });
    s.register('bottleCaps', () => p().bottleCaps, (v) => { p().bottleCaps = v || 0; });
    s.register('hasBooties', () => p().hasBooties, (v) => { p().hasBooties = !!v; });
    s.register('hasCanteen', () => p().hasCanteen, (v) => {
      p().hasCanteen = !!v;
      if (p().hasCanteen) p().canteenCharge = 1;
    });
    s.register('backpackCapacity', () => p().backpackCapacity, (v) => { p().backpackCapacity = v || 3; });
    s.register('hasHelmet', () => p().hasHelmet, (v) => {
      p().hasHelmet = !!v;
      if (p().hasHelmet) document.getElementById('helmet-indicator').classList.remove('hidden');
    });
    s.register('hasAirHelmet', () => p().hasAirHelmet, (v) => { p().hasAirHelmet = !!v; });
    s.register('hasRod', () => p().hasRod, (v) => { p().hasRod = !!v; });
    s.register('hasSturdyLine', () => p().hasSturdyLine, (v) => { p().hasSturdyLine = !!v; });
    s.register('baitCharges', () => p().baitCharges, (v) => { p().baitCharges = v || 0; });
    s.register('scorePebbles', () => this.scorePebbles, (v) => { this.scorePebbles = v || 0; });
    s.register('scoreFoodSold', () => this.scoreFoodSold, (v) => { this.scoreFoodSold = v || 0; });
    s.register('stats', () => this.stats, (v) => { if (v) this.stats = { ...this.stats, ...v }; });
    s.register('achievements', () => this.achievements.serialize(), (v) => {
      if (v) this.achievements = new AchievementTracker(v);
    });
    s.register('minimapHidden', () => this._minimapHidden || false, (v) => {
      if (v) this.setMinimapHidden(true, false);
    });
    s.register('minimapDefaultHidden', () => this._minimapDefaultHidden || false, (v) => {
      this._minimapDefaultHidden = v || false;
    });
    s.register('joystickScale', () => this.input.joystickScale || 1, (v) => { this.input.setJoystickScale(v || 1); });
    s.register('volMaster', () => this.audio.masterVolume ?? 0.8, (v) => { this.audio.masterVolume = v ?? 0.8; });
    s.register('volMusic', () => this.audio.musicVolume ?? 0.6, (v) => { this.audio.musicVolume = v ?? 0.6; });
    s.register('volSfx', () => this.audio.sfxVolume ?? 0.8, (v) => { this.audio.sfxVolume = v ?? 0.8; });
    s.register('skinId', () => p().skinId, (v) => {
      const skin = findSkin(v);
      p().skinId = skin.id;
      p().skinHue = skin.hue;
    });
    s.register('cabinStorage', () => this.cabinStorage, (v) => { if (v) this.cabinStorage = v; });
    s.register('farmSeedCount', () => this.farmSeedCount, (v) => {
      const n = Number(v);
      this.farmSeedCount = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 12;
    });
    s.register('hasScarecrow', () => this.hasScarecrow, (v) => { this.hasScarecrow = !!v; });
    s.register('hasHomePump', () => this.hasHomePump, (v) => { this.hasHomePump = !!v; });
    s.register('hasCatTree', () => this.hasCatTree, (v) => { this.hasCatTree = !!v; });
    s.register('hasTurtleCove', () => this.hasTurtleCove, (v) => { this.hasTurtleCove = !!v; });
    s.register('hasShellShelf', () => this.hasShellShelf, (v) => { this.hasShellShelf = !!v; });
    s.register('hasSunPatch', () => this.hasSunPatch, (v) => { this.hasSunPatch = !!v; });
    s.register('homeFarmState', () => this._serializeHomeFarmState(), (v) => {
      this.homeFarmState = this._normalizeHomeFarmState(v);
    });
    s.register('pets', () => this.pets.map(p => p.serialize()), (v) => {
      this.pets = (v || []).map((d, i) => Pet.fromData(d, this.player.x - 26 - i * 20, this.player.y + 16));
      this.updatePetChip();
    });
    s.register('ownedDiscs', () => this.ownedDiscs, (v) => {
      const valid = new Set(DISC_CATALOG.map(d => d.id));
      this.ownedDiscs = Array.isArray(v) ? v.filter(id => valid.has(id)) : [];
    });
    s.register('discProgress', () => this.discProgress, (v) => {
      this.discProgress = v && typeof v === 'object' ? v : {};
    });
  }

  saveProfile() { this.saveManager.save(); }
  loadProfile() { this.saveManager.load(); }

  _homeUpgradeSnapshot() {
    return {
      hasHomePump: this.hasHomePump,
      hasCatTree: this.hasCatTree,
      hasTurtleCove: this.hasTurtleCove,
      hasShellShelf: this.hasShellShelf,
      hasSunPatch: this.hasSunPatch,
    };
  }

  _applyHomeUpgradeState() {
    const upgrades = this._homeUpgradeSnapshot();
    if (!this.world) return;
    this.world.colliders?.forEach(box => {
      if (box.type === 'homecabin') box.homePumped = upgrades.hasHomePump;
    });
    this.world.decorations?.forEach(d => {
      if (d.type === 'turtlecove') d.hidden = !upgrades.hasTurtleCove;
      if (d.type === 'shellhelpers') d.hidden = !upgrades.hasShellShelf;
    });
  }

  /**
   * Bind event listeners for UI Buttons
   */
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
      if (confirm('Are you sure? This will reset all upgrades and progress (you keep your current items).')) {
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
  }

  /** Dev Menu cheat: instantly mature every planted crop at the home farm (watered or not). */
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
  }

  /** Dev Menu cheat: water every planted, unwatered crop at the home farm. */
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
  }

  /** Dev Menu cheat: force-spawn a crow pest for testing the scarecrow mechanic. */
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
  }

  /** Dev Menu cheat: send every tamed companion back to the wild so taming can be re-tested. */
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
  }

  /** Collapse/expand the minimap; optionally persist the preference. */
  setMinimapHidden(hidden, save = true) {
    this._minimapHidden = hidden;
    const mmC = document.getElementById('minimap-container');
    if (mmC) mmC.classList.toggle('collapsed', hidden);
    const btn = document.getElementById('btn-minimap-toggle');
    if (btn) btn.innerText = hidden ? '▸' : '▾';
    this.playSound('ui');
    if (save) this.saveProfile();
  }

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
  }

  closeSettings() {
    this.state = this._settingsReturnState || 'playing';
    this.input.reset();
    document.getElementById('settings-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

  /**
   * Fade to black, run setupFn once the screen is covered, then fade back
   * in — used whenever gameplay starts or resumes from a menu screen, so
   * the audio crossfade (also kicked off here) isn't a jarring hard cut.
   */
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
  }

  /**
   * Start gameplay
   */
  startGame() {
    this._fadeIntoGame(() => this._doStartGame());
  }

  _doStartGame() {
    this.state = 'playing';
    this.runStats = { time: 0, pebbles: 0, food: 0, spotted: 0 };
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    this.lastTime = performance.now();
  }

  /**
   * Open the developer menu
   */
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
  }

  /**
   * Close the developer menu
   */
  closeDevMenu() {
    this.state = 'playing';
    document.getElementById('dev-menu').classList.add('hidden');
    this.lastTime = performance.now();
    clearInterval(this._debugInterval);
    clearTimeout(this._spriteGalleryRetry);
  }

  /**
   * Update the speed ratio display in the dev menu
   */
  updateSpeedRatio() {
    const playerSpeed = parseFloat(document.getElementById('dev-player-speed').value);
    const chaseSpeed = parseFloat(document.getElementById('dev-chase-speed').value);
    const ratio = (playerSpeed / chaseSpeed).toFixed(2);
    const el = document.getElementById('dev-speed-ratio');
    if (el) el.textContent = ratio + 'x';
  }

  /**
   * Reset game elements on retry — PRESERVES inventory and pebbles
   */
  resetGame() {
    this._fadeIntoGame(() => this._doResetGame());
  }

  _doResetGame() {
    this.state = 'playing';
    this._outside = null;      // discard any interior we died inside
    this._wokeCamper = false;
    this._interiors = new Map();
    this.decoys = [];
    this.floaters = [];
    this.quest = null;
    this.dayCount = 1;
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
    this.lastTime = performance.now();
  }

  /**
   * Regenerate the entire world from dev menu parameters.
   * Like Zelda's randomizer — same game, fresh layout every time.
   */
  regenerateWorld() {
    // Read current dev menu slider values
    const seedInput = document.getElementById('dev-seed').value;
    this._worldConfig = {
      cols: parseInt(document.getElementById('dev-map-cols').value),
      rows: parseInt(document.getElementById('dev-map-rows').value),
      zoneSpacing: parseInt(document.getElementById('dev-zone-spacing').value),
      treeDensity: parseInt(document.getElementById('dev-tree-density').value),
      guardCount: parseInt(document.getElementById('dev-guard-count').value),
      buildingCount: parseInt(document.getElementById('dev-building-count').value),
      seed: seedInput ? parseInt(seedInput) : undefined
    };
    this.materialLootMult = parseFloat(document.getElementById('dev-material-loot').value) / 100;

    // Generate a fresh world
    const gen = new WorldGenerator(this._worldConfig);
    const genData = gen.generate();
    this.world = new World(genData);

    // Display current seed so player can share it
    document.getElementById('dev-current-seed').textContent = genData.seed;

    // Reset player to new spawn
    const lakeZone = this.world.zones.find(z => z.type === 'lake');
    const spawnX = lakeZone ? lakeZone.spawnX : 600;
    const spawnY = lakeZone ? lakeZone.spawnY : 150;

    const savedItems = [...this.player.items];
    const savedPebbles = this.player.pebbles;
    this.player.reset(spawnX, spawnY);
    this.player.items = savedItems;
    this.player.pebbles = savedPebbles;
    this.player.baseSpeed = parseFloat(document.getElementById('dev-player-speed').value);

    // Spawn new guards from generated patrol data
    this.initGuards(genData.guardPatrols);
    this._applyDevSettingsToGuards();
    this._spawnWorldLife();

    // Close dev menu and resume
    this.closeDevMenu();
    this.updateHUD();
  }

  /** One-time dropdown population for the Dev Menu's "Spawn Item" cheat. */
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
  }

  /** Dev Menu cheat: spawn a chosen item/material/tool straight into the player's possession. */
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
  }

  /**
   * Find an enterable building whose door the player is standing near.
   * Doors sit at the bottom-center of cabin/café/shop footprints.
   * @returns {object|null} the building collider
   */
  _findDoorAt() {
    if (this.world.isInterior) return null;
    for (const box of this.world.colliders) {
      if (box.type !== 'cabin' && box.type !== 'cafe' && box.type !== 'shop' && box.type !== 'homecabin') continue;
      const dx = this.player.x - (box.x + box.w / 2);
      const dy = this.player.y - (box.y + box.h + 14);
      if (Math.hypot(dx, dy) < 52) return box;
    }
    return null;
  }

  /**
   * Step inside a building: saves the outside world/guards/critters and
   * swaps in a (cached) interior world. Shops open the shop UI instead.
   */
  enterBuilding(box) {
    if (box.type === 'shop' && box.interiorKind !== 'town_shop') {
      this.playSound('ui');
      if (box.shopName === 'Fish Market') this.openFishMarket();
      else this.openShop();
      return;
    }
    this.questEvent('enter');

    let interior = this._interiors.get(box);
    if (!interior) {
      interior = new World(buildInterior(box, { homeUpgrades: this._homeUpgradeSnapshot() }));
      this._interiors.set(box, interior);
    }

    this._outside = {
      world: this.world,
      guards: this.guards,
      critters: this.critters,
      px: this.player.x,
      py: box.y + box.h + 26, // step back out just below the door
    };
    this.world = interior;

    // Interior staff become the active "guards" (empty for cabins)
    this.guards = (interior.staffPatrols || []).map(p => {
      const npc = new NPC(p.role, p.points);
      npc.visionDist = 150;
      return npc;
    });
    this.critters = [];

    // Player enters just inside the door
    this.player.x = interior.width / 2;
    this.player.y = interior.height - 70;
    this.player.isHiding = false;
    this.snapPetToPlayer();
    this._spawnWildPets();

    this.playSound('ui');
    this.updateHUD();
  }

  /**
   * Dive mode: fade out, swap in a standalone underwater "world" (built by
   * Underwater.js the same way Interior.js builds building rooms), and
   * start the oxygen countdown. Surfacing restores the cached outside world.
   */
  enterDive() {
    this._fadeIntoGame(() => {
      const surfaceWorld = this.world;
      // Where the player dove in, as a fraction of the surface map — used
      // to place them at the *matching* spot underwater, so the two spaces
      // feel like one continuous place instead of a fixed teleport pad.
      const nx = this.player.x / surfaceWorld.width;
      const ny = this.player.y / surfaceWorld.height;

      this._diveOutside = {
        world: surfaceWorld,
        guards: this.guards,
        critters: this.critters,
        px: this.player.x,
        py: this.player.y,
      };
      this.world = new World(buildUnderwaterZone());
      this.guards = [];
      this.critters = [];
      const margin = 60;
      this.player.x = margin + nx * (this.world.width - margin * 2);
      this.player.y = margin + ny * (this.world.height - margin * 2);
      this.player.isDiving = true;
      this.player.oxygen = this.player.maxOxygen;
      this.snapPetToPlayer();
      this.showAlert('🤿 Diving in!');
      this.playSound('splash');
      this.spawnBurst(this.player.x, this.player.y, 'rgba(186, 230, 253, ALPHA)', 18);
      this.updateHUD();
    });
  }

  /** Surface from a dive, either voluntarily or forced by an empty oxygen tank. */
  surfaceFromDive(forced) {
    this.player.isDiving = false;
    const o = this._diveOutside;
    this._diveOutside = null;
    if (o) {
      this.world = o.world;
      this.guards = o.guards;
      this.critters = o.critters;
      this.player.x = o.px;
      this.player.y = o.py;
      this.snapPetToPlayer();
    }
    if (forced) {
      this.player.hydration = Math.max(0, this.player.hydration - 15);
      this.showAlert('😮 Gasping for air!');
    } else {
      this.showAlert('🏖️ Back to the surface.');
    }
    this.playSound('splash');
    this.spawnBurst(this.player.x, this.player.y, 'rgba(224, 242, 254, ALPHA)', 14);
    this.updateHUD();
  }

  /** Teleport tamed companions to the player's side across area transitions. */
  snapPetToPlayer() {
    let i = 0;
    this.pets.forEach(pet => {
      if (pet.atHome) return;
      pet.x = this.player.x - 26 - i * 20;
      pet.y = this.player.y + 16;
      i++;
    });
    // Pets left home park themselves at the cabin's pet bed, if we're there
    if (this.world.isHomeCabin && this.world.petBedSpot) {
      let h = 0;
      this.pets.forEach(pet => {
        if (!pet.atHome) return;
        pet.x = this.world.petBedSpot.x + h * 22;
        pet.y = this.world.petBedSpot.y;
        h++;
      });
    }
  }

  /**
   * Refresh the wild (untamed) animals present in the currently loaded
   * world. Whispering Woods holds one wild puppy and one wild kitten;
   * whichever kinds are already tamed (in this.pets) don't respawn.
   * Called on every world swap, so it also clears wildlife when leaving
   * the Woods for another area or a building interior.
   */
  _spawnWildPets() {
    this.wildPets = [];
    if (this.world.areaType !== 'woods') return;
    (this.world.wildPets || []).forEach(wp => {
      if (this.pets.some(p => p.kind === wp.kind)) return; // already tamed
      this.wildPets.push(new Pet(wp.kind, PET_KINDS[wp.kind].name, wp.x, wp.y, false));
    });
  }

  /** Leave the interior and restore the outside world. */
  exitBuilding() {
    if (!this._outside) return;
    const o = this._outside;
    this._outside = null;
    this.world = o.world;
    this.guards = o.guards;
    this.critters = o.critters;
    this.player.x = o.px;
    this.player.y = o.py;
    this.snapPetToPlayer();
    this._spawnWildPets();
    this.playSound('ui');

    // Woke a camper? The nearest guard comes straight for you.
    if (this._wokeCamper) {
      this._wokeCamper = false;
      let nearest = null, best = Infinity;
      this.guards.forEach(g => {
        const d = Math.hypot(g.x - this.player.x, g.y - this.player.y);
        if (d < best) { best = d; nearest = g; }
      });
      if (nearest) {
        nearest.state = 'chase';
        nearest.alertLevel = 100;
        this.showAlert('😱 The camper called security! RUN!');
      }
    }
    this.updateHUD();
  }

  /**
   * Smoothly transitions the player to a different world area (campsite <-> town)
   */
  switchArea(targetArea) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const fromArea = this.world.areaType; // captured before this.world is replaced below
    if (fromArea === 'woods') {
      this._saveHomeFarmState();
      this.saveProfile();
    }

    // Display transit screen overlay
    const transitOverlay = document.getElementById('transit-screen');
    const transitHeading = document.getElementById('transit-heading');

    transitHeading.textContent = targetArea === 'town' ? 'Taking Bus to Town...'
      : targetArea === 'woods' ? 'Hiking into the Woods...'
      : 'Returning to Campsite...';
    transitOverlay.classList.remove('hidden');

    setTimeout(() => {
      // Switch config areaType
      this._worldConfig.areaType = targetArea;

      // Keep current seed to preserve the world structure relation
      const gen = new WorldGenerator(this._worldConfig);
      const genData = gen.generate();
      this.world = new World(genData);
      this._applyHomeUpgradeState();
      this._applyHomeFarmState();

      // Position player just off the transition point in the new area
      let spawnX, spawnY;
      if (targetArea === 'town') {
        const parkZone = this.world.zones.find(z => z.type === 'park');
        spawnX = 1.5 * this.world.tileSize;
        spawnY = ((parkZone ? parkZone.h : 3) + 2.5) * this.world.tileSize;
      } else if (targetArea === 'woods') {
        const woodsZone = this.world.zones.find(z => z.type === 'woods');
        spawnX = 2.5 * this.world.tileSize;
        spawnY = woodsZone ? woodsZone.spawnY : Math.floor(this.world.rows / 2) * this.world.tileSize;
      } else if (fromArea === 'woods') {
        // Returning from the woods: arrive near the trailhead, not the bus stop
        spawnX = Math.floor(this.world.cols * 0.05) * this.world.tileSize + 60;
        spawnY = Math.floor(this.world.rows / 2) * this.world.tileSize;
      } else {
        const swampStart = this.world.rows - Math.max(2, Math.floor(this.world.rows * 0.08));
        spawnX = Math.floor(this.world.cols * 0.75) * this.world.tileSize + 48;
        spawnY = (swampStart - 3.5) * this.world.tileSize;
      }

      const savedItems = [...this.player.items];
      const savedPebbles = this.player.pebbles;
      this.player.reset(spawnX, spawnY);
      this.player.items = savedItems;
      this.player.pebbles = savedPebbles;

      // Spawn guards
      this.initGuards(genData.guardPatrols);
      this._applyDevSettingsToGuards();
      this._spawnWorldLife();
      this.snapPetToPlayer();
      this._spawnWildPets();

      this.updateHUD();
      this.saveProfile();
      
      // Keep state clean and fade back in
      setTimeout(() => {
        transitOverlay.classList.add('hidden');
        this.isTransitioning = false;
      }, 500);
    }, 1200);
  }

  /**
   * Apply dev menu slider settings to all current guards
   */
  _applyDevSettingsToGuards() {
    const patrolSpeed = parseFloat(document.getElementById('dev-guard-speed').value);
    const chaseSpeed = parseFloat(document.getElementById('dev-chase-speed').value);
    const visionDist = parseFloat(document.getElementById('dev-vision-dist').value);
    const visionFov = parseFloat(document.getElementById('dev-vision-fov').value);
    const alertSpeed = parseFloat(document.getElementById('dev-alert-speed').value);
    this.guards.forEach(g => {
      g.patrolSpeed = patrolSpeed;
      g.chaseSpeed = chaseSpeed;
      g.visionDist = visionDist;
      g.visionFov = visionFov;
      g.alertSpeed = alertSpeed;
    });
  }

  /**
   * Triggered when player is caught by a guard or dies (dehydrates)
   */
  triggerGameOver(reason) {
    this.state = 'gameover';
    this.playSound('caught');
    this.audio.setChase(false);
    this.saveProfile();

    // UI overlays
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
    
    document.getElementById('game-over-title').innerText = reason === 'guards' ? 'Caught!' : 'Dried Out!';
    document.getElementById('game-over-reason').innerText = reason === 'guards'
      ? 'A lifeguard found you and put you back in the lake.'
      : 'You spent too much time on dry land without water!';

    // Per-run results
    const rs = this.runStats;
    document.getElementById('stat-pebbles-earned').innerText = rs.pebbles;
    document.getElementById('stat-food-sold').innerText = rs.food;
    const mins = Math.floor(rs.time / 60), secs = Math.floor(rs.time % 60);
    document.getElementById('stat-time-survived').innerText = `${mins}:${String(secs).padStart(2, '0')}`;
    document.getElementById('stat-times-spotted').innerText = rs.spotted;

    // Letter grade: earnings rate matters most, getting spotted costs you
    const minutes = Math.max(0.5, rs.time / 60);
    const score = rs.pebbles / minutes - rs.spotted * 5;
    const grade = score >= 40 ? 'S' : score >= 25 ? 'A' : score >= 12 ? 'B' : score >= 5 ? 'C' : 'D';
    const gradeEl = document.getElementById('run-grade');
    gradeEl.textContent = grade;
    gradeEl.className = `run-grade grade-${grade}`;
  }

  /**
   * Handles keyboard Space/E or touch Action button interact triggers
   */
  handleActionInteraction() {
    // Active minigame consumes action presses
    if (this.state === 'minigame') {
      if (this.minigame) this.minigame.onAction();
      return;
    }
    if (this.state === 'disc') {
      if (this.activeDisc?.done) this.exitDiscToComputer();
      else if (this.activeDisc) this.activeDisc.onAction();
      return;
    }
    if (this.state !== 'playing') return;

    const farmPlot = this._findFarmPlotAt();
    if (farmPlot && this._interactFarmPlot(farmPlot)) return;

    // 1. Check Sewer Rat interaction (talk / open trade window)
    const distToRat = Math.hypot(this.player.x - this.world.rat.x, this.player.y - this.world.rat.y);
    if (distToRat < 50) {
      this.playSound('collect');
      // Hand out a fresh quest whenever the player has none
      let questLine = '';
      if (!this.quest) {
        this.assignQuest();
        questLine = ` Psst — new job for you: ${this.quest.text} and I'll pay ${this.quest.reward} bonus pebbles!`;
      }
      const bagCount = this.player.items.reduce((n, i) => n + (i.qty || 1), 0);
      const text = (bagCount > 0
        ? `Squeak! Wow, you have ${bagCount} snacks in your bag! I will buy them all. Want to sell?`
        : `Hey Axel! Sneak into the campground and loot those coolers and trash cans. Bring the food back to me!`) + questLine;

      this.setDialogueText(text);
      document.getElementById('btn-dialogue-action').style.display = this.player.items.length > 0 ? 'inline-block' : 'none';
      document.getElementById('dialogue-overlay').classList.remove('hidden');
      return;
    }

    // 1b. Check building door (enter cabin/café, or open the shop)
    const homeVendor = this._findHomeUpgradeVendor();
    if (homeVendor) {
      this.playSound('ui');
      this.openHomeUpgradeShop();
      return;
    }

    const door = this._findDoorAt();
    if (door) {
      this.enterBuilding(door);
      return;
    }

    // 1b2. Dive / surface toggle while standing in open water (large lake,
    // outdoors only — the flooded home cabin's lake tile is decorative).
    if (!this.player.isDiving) {
      const tileType = this.world.getTileAt(this.player.x, this.player.y);
      if (!this.world.isInterior && tileType === this.world.TILE_LAKE) {
        this.enterDive();
        return;
      }
    } else {
      this.surfaceFromDive(false);
      return;
    }

    // 1c. Check wild (untamed) animal — feed it the food it wants
    const wildPet = this._findWildPetAt();
    if (wildPet) {
      this._tryFeedWildPet(wildPet);
      return;
    }

    // 1d. Check leashable critter — tether it with a Critter Leash from the bag
    const leashTarget = this._findLeashableCritterAt();
    if (leashTarget) {
      this._leashCritter(leashTarget);
      return;
    }

    // 1e. Pet bed — send a following companion to stay at the cabin
    const stayPet = this._findFollowingPetNearBed();
    if (stayPet) {
      if (this.world.isFlooded && !this.player.hasAirHelmet) {
        this.playSound('ui');
        this.showAlert('🫧 Needs an Air Helmet from the Shop before they can stay safely underwater.');
        return;
      }
      const idx = this.pets.indexOf(stayPet);
      this.toggleHomePet(idx);
      return;
    }

    // 1f. Town shop interiors: computer desk and sales register
    const computer = this._findComputerAt();
    if (computer) {
      this.playSound('ui');
      this.openComputer(computer);
      return;
    }
    const register = this._findRegisterAt();
    if (register) {
      this.useShopRegister(register);
      return;
    }

    // 2. Check Item pick-ups
    for (let i = this.world.items.length - 1; i >= 0; i--) {
      const item = this.world.items[i];
      const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
      if (dist < 40) {
        // Materials go straight to the pouch, no slot needed
        if (item.type === 'material') {
          this.player.addMaterial(item.matId);
          this.playSound('collect');
          this.spawnBurst(item.x, item.y, 'rgba(163, 230, 53, ALPHA)', 6);
          this.spawnFloater(item.x, item.y - 16, `+1 ${item.name}`, '#a3e635');
          this.world.items.splice(i, 1);
          this.questEvent('material');
          this.updateHUD();
          return;
        }
        if (item.type === 'seeds') {
          const n = item.qty || 1;
          this.farmSeedCount += n;
          this.playSound('collect');
          this.spawnBurst(item.x, item.y, 'rgba(132, 204, 22, ALPHA)', 8);
          this.spawnFloater(item.x, item.y - 16, `+${n} Seeds`, '#a3e635');
          this.world.items.splice(i, 1);
          this.updateHUD();
          this.saveProfile();
          return;
        }
        if (this.player.addItem(item)) {
          this.playSound('collect');
          this.spawnBurst(item.x, item.y, 'rgba(251, 191, 36, ALPHA)', 8);
          this.spawnFloater(item.x, item.y - 16, `+ ${item.name}`, '#fde047');
          this.world.items.splice(i, 1);
          this.updateHUD();
        } else {
          this._notifyBackpackFull(`${item.name} is still on the ground.`);
        }
        return;
      }
    }

    // 3. Check Containers (Coolers, Trash Cans)
    for (const c of this.world.containers) {
      const centerX = c.x + c.w / 2;
      const centerY = c.y + c.h / 2;
      const dist = Math.hypot(this.player.x - centerX, this.player.y - centerY);

      if (dist < 50) {
        // The home cabin's storage shed — a persistent inventory, not a
        // one-time loot roll, so it opens its own overlay instead.
        if (c.type === 'homechest') {
          this.playSound('ui');
          this.openCabinStorage();
          return;
        }

        if (c.looted) return;

        // Locked containers: play the lockpicking minigame (needs a pick)
        if (c.locked) {
          if ((this.player.tools.lockpick || 0) > 0) {
            this.playSound('ui');
            this.startMinigame(new LockpickMinigame({ sweetMult: this.devSweetSpotMult }), (mg) => this._resolveLockpick(mg, c),
              { actionLabel: 'Pick', actionIcon: '🗝️' });
          } else {
            this.playSound('ui');
            this.showAlert('🔒 Locked! Buy a Lockpick at the Shop.');
          }
          return;
        }

        c.looted = true;
        this.playSound('collect');
        this.spawnBurst(centerX, centerY, 'rgba(56, 189, 248, ALPHA)', 14);
        this.questEvent('loot');

        // Master loot table — rolled at loot time for true randomness
        const lootTable = [
          { name: 'Hot Dog', type: 'food', value: 12, emoji: '🌭', weight: 10 },
          { name: 'Burger', type: 'food', value: 25, emoji: '🍔', weight: 7 },
          { name: 'Sandwich', type: 'food', value: 18, emoji: '🥪', weight: 9 },
          { name: 'Pizza Slice', type: 'food', value: 20, emoji: '🍕', weight: 8 },
          { name: 'Fish Taco', type: 'food', value: 22, emoji: '🌮', weight: 6 },
          { name: 'Soggy Fries', type: 'food', value: 8, emoji: '🍟', weight: 12 },
          { name: 'Half-Eaten Donut', type: 'food', value: 10, emoji: '🍩', weight: 10 },
          { name: 'Cold Ice Cream', type: 'food', value: 16, emoji: '🍦', weight: 5 },
          { name: 'Apple Core', type: 'food', value: 5, emoji: '🍏', weight: 11 },
          { name: 'Fresh Soda', type: 'drink', value: 10, emoji: '🥤', weight: 8 },
          { name: 'Glow Ring', type: 'treasure', value: 15, emoji: '💍', weight: 3 },
          { name: 'Shiny Wrapper', type: 'trash', value: 7, emoji: '✨', weight: 6 },
          { name: 'Empty Can', type: 'trash', value: 1, emoji: '🥫', weight: 15 },
          { name: 'Crumpled Receipt', type: 'trash', value: 2, emoji: '🧾', weight: 14 },
          { name: 'Banana Peel', type: 'trash', value: 3, emoji: '🍌', weight: 12 },
          { name: 'Nothing', type: 'empty', value: 0, emoji: '💨', weight: 10 },
          // Crafting materials (stack in the pouch, no loot slot)
          { name: 'Driftwood', type: 'material', matId: 'driftwood', value: 0, emoji: '🪵', weight: 7 },
          { name: 'String', type: 'material', matId: 'string', value: 0, emoji: '🧵', weight: 7 },
          { name: 'Bottle Cap', type: 'material', matId: 'bottlecap', value: 0, emoji: '🔩', weight: 6 },
          { name: 'Shell', type: 'material', matId: 'shell', value: 0, emoji: '🐚', weight: 5 },
          { name: 'Candle Wax', type: 'material', matId: 'wax', value: 0, emoji: '🕯️', weight: 4 },
          { name: 'Shiny Scrap', type: 'material', matId: 'scrap', value: 0, emoji: '📎', weight: 5 }
        ];

        // Dev-menu tunable: scale how often crafting materials turn up in loot
        const matMult = this.materialLootMult ?? 1;
        if (matMult !== 1) {
          lootTable.forEach(i => { if (i.type === 'material') i.weight *= matMult; });
        }

        // Café counters only hold food/drink; interior chests skip junk
        let table = lootTable;
        if (c.lootKind === 'food') {
          table = lootTable.filter(i => i.type === 'food' || i.type === 'drink');
        } else if (c.rich) {
          table = lootTable.filter(i => i.type !== 'empty' && i.type !== 'trash');
        }

        // Weighted random pick
        const pickWeighted = () => {
          const totalWeight = table.reduce((s, i) => s + i.weight, 0);
          let roll = Math.random() * totalWeight;
          for (const item of table) {
            roll -= item.weight;
            if (roll <= 0) return { ...item };
          }
          return { ...table[table.length - 1] };
        };

        // Roll drops (interior containers are richer)
        const dropCount = (this.dropAmount || 1) + (c.rich ? 1 : 0);
        let droppedAny = false;
        let spilledAny = false;

        for (let d = 0; d < dropCount; d++) {
          const foundItem = pickWeighted();

          // Skip "Nothing" drops
          if (foundItem.type === 'empty') continue;

          // Materials go straight to the pouch
          if (foundItem.type === 'material') {
            this.player.addMaterial(foundItem.matId);
            this.spawnBurst(this.player.x, this.player.y - 10, 'rgba(163, 230, 53, ALPHA)', 6);
            this.spawnFloater(this.player.x, this.player.y - 30 - d * 14, `+1 ${foundItem.name}`, '#a3e635');
            this.questEvent('material');
            droppedAny = true;
            continue;
          }
          this.spawnFloater(this.player.x, this.player.y - 30 - d * 14, `+ ${foundItem.name}`, '#fde047');

          droppedAny = true;

          // Try to add to backpack, otherwise drop on the ground
          if (!this.player.addItem(foundItem)) {
            spilledAny = true;
            this.world.items.push({
              x: this.player.x + (Math.random() - 0.5) * 60,
              y: this.player.y + 30 + d * 20,
              radius: 10,
              ...foundItem
            });
          }
        }

        if (!droppedAny) {
          // Show "empty" feedback — nothing found
          this.world.items.push({
            x: this.player.x, y: this.player.y - 20,
            radius: 10, name: 'Nothing', type: 'empty', value: 0, emoji: '💨'
          });
        }

        this.updateHUD();
        if (spilledAny) this._notifyBackpackFull('Some loot spilled at your feet.');

        // Outdoor containers (trash cans, coolers) despawn once looted
        // instead of lingering as an empty prop — interior room containers
        // stay put, since they're part of a fixed room layout.
        if (!this.world.isInterior) {
          const idx = this.world.containers.indexOf(c);
          if (idx >= 0) this.world.containers.splice(idx, 1);
        }
        return;
      }
    }

    // 4. Toggle Hiding in Bush (if standing in a bush tile)
    const tileType = this.world.getTileAt(this.player.x, this.player.y);
    if (tileType === this.world.TILE_BUSH) {
      this.player.isHiding = !this.player.isHiding;
      if (!this.player.isHiding) this.player.inPortableBush = false;
      this.playSound('hide');
      return;
    }

    // 5. Cook at a campfire/grill
    if (this._findCookSpot()) {
      this.startCooking();
      return;
    }

    // 5a2. The raccoon's den — trade Bottle Caps for cooked fish
    if (this._findRaccoonDen()) {
      this.playSound('ui');
      this.openRaccoonShop();
      return;
    }

    // 5b. Home cabin furniture: wardrobe / crafting bench
    if (this._findCabinDecor('wardrobe')) {
      this.playSound('ui');
      this.openWardrobe();
      return;
    }
    if (this._findCabinDecor('workbench')) {
      this.playSound('ui');
      this.openCrafting();
      return;
    }
    if (this._findCabinBed()) {
      this.sleepInBed();
      return;
    }

    // 6. Cast the fishing rod at the water's edge
    const spot = this._findFishingSpot();
    if (spot) {
      this.startFishing(spot);
      return;
    }

    this.useSelectedActionSlot();
  }

  /**
   * Find a campfire/grill the player is standing near.
   * @returns {object|null} the decoration
   */
  _findCookSpot() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'campfire' && d.type !== 'grill') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 60) return d;
    }
    return null;
  }

  /** Find a cabin decoration of the given type near the player (home cabin interior only). */
  _findCabinDecor(type) {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== type) continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 55) return d;
    }
    return null;
  }

  _findComputerAt() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'computer') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 62) return d;
    }
    return null;
  }

  _findRegisterAt() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'register') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 62) return d;
    }
    return null;
  }

  /** The raccoon's den, if the player is standing near it (any area, no building required). */
  _findRaccoonDen() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'raccoonden') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 60) return d;
    }
    return null;
  }

  /** The baby turtle home-upgrade stand in Whispering Woods. */
  _findHomeUpgradeVendor() {
    if (this.world.areaType !== 'woods' || !this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'homevendor') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 62) return d;
    }
    return null;
  }

  /** The home cabin's bed collider, if the player is standing near it. */
  _findCabinBed() {
    if (!this.world.isHomeCabin) return null;
    for (const c of this.world.colliders) {
      if (c.type !== 'bed') continue;
      const cx = c.x + (c.w || 0) / 2, cy = c.y + (c.h || 0) / 2;
      if (Math.hypot(this.player.x - cx, this.player.y - cy) < 60) return c;
    }
    return null;
  }

  /** Sleep through the night: skip to morning and cheer up every companion. */
  sleepInBed() {
    this.playSound('ui');
    const overlay = document.getElementById('game-fade-overlay');
    overlay.classList.add('active');
    setTimeout(() => {
      this.dayCount++;
      this.timeOfDay = 0.3; // ~7:12 AM
      this.stats.maxDayReached = Math.max(this.stats.maxDayReached, this.dayCount);
      this._advanceFarmDay();
      this.pets.forEach(p => { p.happiness = 100; });
      this.updateHUD();
      this.updatePetChip();
      this.saveProfile();
      this.showAlert(`☀️ Day ${this.dayCount} — you slept well, and your companions are delighted to see you!`);
      setTimeout(() => overlay.classList.remove('active'), 30);
    }, 400);
  }

  /**
   * Dialogue option: sell backpack items to the Sewer Rat
   */
  handleRatTrade() {
    // Crafting materials live in their own pouch (this.player.materials) and
    // never enter this.player.items, but guard against it defensively —
    // they're for the recipe book, not the rat's food scale.
    const trash = this.player.items.filter(i => i.type === 'trash');
    const sellable = this.player.items.filter(i => i.type !== 'material' && i.type !== 'trash');
    if (sellable.length === 0 && trash.length === 0) return;

    let totalEarnings = 0;
    let soldCount = 0;
    sellable.forEach(item => {
      const qty = item.qty || 1;
      totalEarnings += item.value * qty;
      soldCount += qty;
      this.scoreFoodSold += qty;
      this.runStats.food += qty;
    });

    // Litter gets recycled into Bottle Caps instead of Pebbles — one cap
    // per piece — spendable at the Raccoon Shop.
    let totalCaps = 0;
    trash.forEach(item => { totalCaps += item.qty || 1; });

    this.player.pebbles += totalEarnings;
    this.player.bottleCaps += totalCaps;
    this.scorePebbles += totalEarnings;
    this.runStats.pebbles += totalEarnings;
    this.player.items = this.player.items.filter(i => i.type === 'material'); // Clear backpack (materials, if any, stay)

    this.playSound('sell');
    if (totalEarnings > 0) this.spawnFloater(this.player.x, this.player.y - 34, `+${totalEarnings} ✨`, '#fbbf24');
    if (totalCaps > 0) this.spawnFloater(this.player.x, this.player.y - 50, `+${totalCaps} ♻️`, '#a3e635');
    this.questEvent('sell', soldCount);
    this.updateHUD();
    this.saveProfile();

    const capsLine = totalCaps > 0 ? ` And ${totalCaps} Bottle Caps for that litter — the Raccoon down the street will trade those for treats!` : '';
    this.setDialogueText(totalEarnings > 0
      ? `Squeak! Fantastic! Here is your ${totalEarnings} Shiny Pebbles.${capsLine} Come back when you find more food!`
      : `Squeak! Thanks for tidying up!${capsLine}`);
    document.getElementById('btn-dialogue-action').style.display = 'none';
  }

  useShopRegister(register) {
    const name = register.shopName || this.world.areaName || 'Shop';
    if (name === 'Fish Market') {
      this.playSound('ui');
      this.openFishMarket();
      return;
    }
    if (name === 'Ice Cream' || name === 'Juice Bar') {
      this.buyCounterSnack(name);
      return;
    }
    this.playSound('ui');
    this.openShop(`${name} Counter`);
  }

  buyCounterSnack(shopName) {
    const offer = shopName === 'Juice Bar'
      ? { name: 'Citrus Splash', type: 'drink', value: 16, emoji: '🥤', cost: 14 }
      : { name: 'Boardwalk Scoop', type: 'food', value: 18, emoji: '🍦', cost: 16 };
    if (this.player.pebbles < offer.cost) {
      this.playSound('ui');
      this.showAlert(`${shopName}: ${offer.name} costs ${offer.cost} Pebbles.`);
      return;
    }
    const item = { name: offer.name, type: offer.type, value: offer.value, emoji: offer.emoji };
    if (!this.player.addItem(item)) {
      this._notifyBackpackFull(`${offer.name} stayed on the counter.`);
      return;
    }
    this.player.pebbles -= offer.cost;
    this.playSound('collect');
    this.showAlert(`${shopName}: bought ${offer.name} for ${offer.cost} Pebbles.`);
    this.updateHUD();
    this.saveProfile();
  }

  openComputer(computer) {
    this.state = 'computer';
    this._computerHostName = computer?.hostName || this.world.areaName || 'Town Shop';
    document.getElementById('computer-overlay')?.classList.remove('hidden');
    this.updateComputerUI();
  }

  closeComputer() {
    if (this.state !== 'computer') return;
    this.state = 'playing';
    document.getElementById('computer-overlay')?.classList.add('hidden');
    this.lastTime = performance.now();
  }

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
  }

  buyDisc(id) {
    const disc = findDisc(id);
    if (this.ownedDiscs.includes(id)) return;
    if (this.player.pebbles < disc.cost) {
      this.playSound('ui');
      this.showAlert(`${disc.name} costs ${disc.cost} Pebbles.`);
      return;
    }
    this.player.pebbles -= disc.cost;
    this.ownedDiscs.push(id);
    this.playSound('upgrade');
    this.showAlert(`${disc.name} installed.`);
    this.saveProfile();
    this.updateHUD();
    this.updateComputerUI();
  }

  bootDisc(id) {
    if (!this.ownedDiscs.includes(id)) return;
    document.getElementById('computer-overlay')?.classList.add('hidden');
    this.activeDisc = createDiscExperience(id, this.discProgress[id] || {});
    this._activeDiscResolved = false;
    this.state = 'disc';
    const actionBtn = document.getElementById('btn-action');
    actionBtn?.classList.remove('hidden');
    const label = document.getElementById('btn-action-label');
    const icon = document.getElementById('btn-action-icon');
    if (label) label.innerText = 'Action';
    if (icon) icon.innerText = '▣';
    this.playSound('ui');
  }

  updateDisc(dt) {
    if (!this.activeDisc) {
      this.exitDiscToComputer();
      return;
    }
    this.activeDisc.update(dt, this.input.keys, this.camera);
    if (this.activeDisc.done && !this._activeDiscResolved) this.resolveActiveDisc();
    if (this.activeDisc.done) {
      const label = document.getElementById('btn-action-label');
      if (label) label.innerText = 'Eject';
    }
  }

  resolveActiveDisc() {
    const disc = this.activeDisc;
    if (!disc || this._activeDiscResolved) return;
    this.discProgress[disc.id] = disc.serialize();
    const reward = disc.result?.rewardPebbles || 0;
    if (reward > 0) {
      this.player.pebbles += reward;
      this.scorePebbles += reward;
      this.runStats.pebbles += reward;
      this.playSound('sell');
    }
    this._activeDiscResolved = true;
    this.saveProfile();
    this.updateHUD();
  }

  exitDiscToComputer() {
    if (this.activeDisc && !this._activeDiscResolved && this.activeDisc.done) {
      this.resolveActiveDisc();
    } else if (this.activeDisc && !this.activeDisc.done) {
      this.discProgress[this.activeDisc.id] = this.activeDisc.serialize();
      this.saveProfile();
    }
    this.activeDisc = null;
    this._activeDiscResolved = false;
    this.state = 'computer';
    document.getElementById('computer-overlay')?.classList.remove('hidden');
    this.updateComputerUI();
    this.lastTime = performance.now();
  }

  drawDisc() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.camera.w, this.camera.h);
    if (!this.activeDisc) return;
    this.activeDisc.draw(ctx, this.camera);
  }

  /**
   * Update HUD interface values
   */
  _flashBackpackHud() {
    const btn = document.getElementById('btn-open-backpack-hud');
    if (!btn) return;
    btn.classList.remove('bag-attention');
    void btn.offsetWidth;
    btn.classList.add('bag-attention');
    clearTimeout(this._bagAttentionTimer);
    this._bagAttentionTimer = setTimeout(() => btn.classList.remove('bag-attention'), 800);
  }

  _notifyBackpackFull(message = 'Backpack full - make room or drop something.') {
    this._flashBackpackHud();
    this.showAlert(`${message} Open the backpack with I.`);
  }

  _compassDir(dx, dy) {
    const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    const angle = Math.atan2(dy, dx);
    const index = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    return dirs[index];
  }

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
  }

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
  }

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
  }

  /** === Achievements: checked every HUD refresh, so new entries in
   * Achievements.js need zero wiring — just add a condition there. === */
  _unlockCheck() {
    const stats = { ...this.stats, pebblesLifetime: this.scorePebbles, foodSoldLifetime: this.scoreFoodSold };
    const newly = this.achievements.checkAll(stats, this.player);
    if (newly.length) {
      newly.forEach(a => this._queueAchievementToast(a));
      this.saveProfile();
    }
  }

  _queueAchievementToast(a) {
    this._achvQueue.push(a);
    if (!this._achvToastBusy) this._advanceAchvToast();
  }

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
  }

  openAchievements() {
    this.state = 'paused';
    document.getElementById('achievements-overlay').classList.remove('hidden');
    this.updateAchievementsUI();
  }

  closeAchievements() {
    this.state = 'playing';
    document.getElementById('achievements-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

  /** === Wardrobe: cosmetic skins, unlocked automatically via achievements === */
  openWardrobe() {
    this.state = 'paused';
    document.getElementById('wardrobe-overlay').classList.remove('hidden');
    this.updateWardrobeUI();
  }

  closeWardrobe() {
    this.state = 'playing';
    document.getElementById('wardrobe-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

  /**
   * === Pet companions ===
   * Nothing is adoptable from a menu — puppies and kittens are tamed by
   * finding them wandering Whispering Woods and feeding them the food
   * they want (see Pet.js TAME_REQUIREMENTS). This overlay is care-only:
   * once a pet is tamed it shows up here for feeding/playing.
   */
  openPet() {
    this.state = 'paused';
    document.getElementById('pet-overlay').classList.remove('hidden');
    this.updatePetUI();
  }

  closePet() {
    this.state = 'playing';
    document.getElementById('pet-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

  /** Rebuild the companion cards (or the empty-state hint) in the overlay. */
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
          <button class="btn-secondary btn-pet-play">🎾 Play</button>
          ${homeBtnHtml}
        </div>`;
      card.querySelector('.btn-pet-feed').addEventListener('click', () => this.feedPet(idx));
      card.querySelector('.btn-pet-play').addEventListener('click', () => this.playWithPet(idx));
      const homeBtn = card.querySelector('.btn-pet-home');
      if (homeBtn && !homeBtn.disabled) homeBtn.addEventListener('click', () => this.toggleHomePet(idx));
      list.appendChild(card);
    });
  }

  /** Toggle a companion between following the player and staying at the home cabin. */
  toggleHomePet(idx) {
    const pet = this.pets[idx];
    if (!pet) return;
    if (!this.world.isHomeCabin) return;
    if (!pet.atHome && this.world.isFlooded && !this.player.hasAirHelmet) return;
    pet.atHome = !pet.atHome;
    this.snapPetToPlayer();
    this.playSound('ui');
    const stayMessage = this.world.isFlooded
      ? `🫧 ${pet.name} settles in at the cabin with the Air Helmet on.`
      : `🏡 ${pet.name} settles into the dry cabin.`;
    this.showAlert(pet.atHome ? stayMessage : `🐾 ${pet.name} bounds over to join you!`);
    this.saveProfile();
    this.updatePetChip();
    this.updatePetUI();
  }

  /** Feed a tamed companion with the first food/drink item in the bag. */
  feedPet(idx) {
    const pet = this.pets[idx];
    if (!pet) return;
    const itemIdx = this.player.items.findIndex(it => it.type === 'food' || it.type === 'drink');
    if (itemIdx < 0) return;
    const item = this.player.removeItem(itemIdx, 1);
    pet.feed();
    this.playSound('refill');
    this.showAlert(`🍖 ${pet.name} gobbled up the ${item.name}!`);
    this.saveProfile();
    this.updateHUD();
    this.updatePetChip();
    this.updatePetUI();
  }

  /** Play with a tamed companion for a happiness boost. */
  playWithPet(idx) {
    const pet = this.pets[idx];
    if (!pet) return;
    pet.play();
    this.playSound('collect');
    this.updatePetChip();
    this.updatePetUI();
  }

  /** Refresh the little HUD chip showing every tamed companion + mood. */
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
  }

  /** Nearest wild (untamed) animal within feeding range, or null. */
  _findWildPetAt() {
    for (const wp of this.wildPets) {
      if (Math.hypot(this.player.x - wp.x, this.player.y - wp.y) < 55) return wp;
    }
    return null;
  }

  /** Nearest unleashed critter within leashing range — only if a Critter Leash is on hand. */
  _findLeashableCritterAt() {
    if ((this.player.tools.leash || 0) <= 0) return null;
    let target = null, best = 55;
    for (const c of this.critters) {
      if (c.leashed) continue;
      const d = Math.hypot(this.player.x - c.x, this.player.y - c.y);
      if (d < best) { best = d; target = c; }
    }
    return target;
  }

  /** A following (not-already-home) companion standing at the pet bed spot, or null. */
  _findFollowingPetNearBed() {
    if (!this.world.isHomeCabin || !this.world.petBedSpot) return null;
    const spot = this.world.petBedSpot;
    if (Math.hypot(this.player.x - spot.x, this.player.y - spot.y) > 50) return null;
    return this.pets.find(p => !p.atHome) || null;
  }

  /** Offer backpack food to a wild animal; tames it once it's had enough. */
  _tryFeedWildPet(wp) {
    const req = TAME_REQUIREMENTS[wp.kind];
    const idx = this.player.items.findIndex(it => req.matchesItem(it));
    if (idx < 0) {
      this.playSound('ui');
      this.showAlert(`${PET_KINDS[wp.kind].emoji} The ${wp.name.toLowerCase()} ${req.hint}`);
      return;
    }
    const item = this.player.removeItem(idx, 1);
    const result = wp.feedTame(item);
    this.playSound('collect');
    this.spawnBurst(wp.x, wp.y - 10, 'rgba(244, 114, 182, ALPHA)', 8);
    if (result.tamedNow) {
      this.wildPets = this.wildPets.filter(p => p !== wp);
      this.pets.push(wp);
      this.playSound('upgrade');
      this.showAlert(`🎉 The ${wp.name.toLowerCase()} is tamed! They'll follow you now.`);
      this.saveProfile();
      this.updatePetChip();
    } else {
      this.spawnFloater(wp.x, wp.y - 24, `${result.progress}/${result.needed}`, '#f472b6');
      this.showAlert(`${PET_KINDS[wp.kind].emoji} Munch! (${result.progress}/${result.needed} — fed the ${item.name})`);
    }
    this.updateHUD();
  }

  equipSkin(id) {
    const skin = findSkin(id);
    if (!isSkinUnlocked(skin, this.achievements)) return;
    this.player.skinId = skin.id;
    this.player.skinHue = skin.hue;
    this.playSound('upgrade');
    this.saveProfile();
    this.updateWardrobeUI();
  }

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
  }

  /** === Home Cabin storage shed: unlimited, persistent, separate from the backpack === */
  openCabinStorage() {
    this.state = 'paused';
    document.getElementById('cabin-storage-overlay').classList.remove('hidden');
    this.updateCabinStorageUI();
  }

  closeCabinStorage() {
    this.state = 'playing';
    document.getElementById('cabin-storage-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

  storeItem(index) {
    if (index < 0 || index >= this.player.items.length) return;
    const item = this.player.items.splice(index, 1)[0];
    this.cabinStorage.items.push(item);
    this.playSound('collect');
    this.saveProfile();
    this.updateHUD();
    this.updateCabinStorageUI();
  }

  takeItem(index) {
    if (index < 0 || index >= this.cabinStorage.items.length) return;
    const item = this.cabinStorage.items[index];
    if (!this.player.addItem(item)) { this._notifyBackpackFull('No room to take that item from storage.'); return; }
    this.cabinStorage.items.splice(index, 1);
    this.playSound('collect');
    this.saveProfile();
    this.updateHUD();
    this.updateCabinStorageUI();
  }

  updateCabinStorageUI() {
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
  }

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
  }

  /**
   * Poll dynamic visual states around player (e.g. proximity-aware buttons)
   */
  pollContextInteraction() {
    let showBtn = false;
    let label = 'Interact';
    let icon = '🎯';

    // 1. Check Rat proximity
    const distToRat = Math.hypot(this.player.x - this.world.rat.x, this.player.y - this.world.rat.y);
    if (distToRat < 50) {
      showBtn = true;
      label = 'Talk';
      icon = '🐀';
    }

    if (!showBtn && this._findHomeUpgradeVendor()) {
      showBtn = true;
      label = 'Upgrade';
      icon = '🐢';
    }

    // 1b. Check building doors
    if (!showBtn) {
      const door = this._findDoorAt();
      if (door) {
        showBtn = true;
        const isFishMarket = door.type === 'shop' && door.shopName === 'Fish Market';
        const isTownShop = door.type === 'shop' && door.interiorKind === 'town_shop';
        label = isFishMarket ? 'Market' : door.type === 'shop' ? 'Shop' : door.type === 'homecabin' ? 'Home' : 'Enter';
        icon = isFishMarket ? '🐟' : door.type === 'shop' ? '🛒' : door.type === 'homecabin' ? '🏡' : '🚪';
        if (isTownShop) {
          label = 'Enter';
          icon = '🚪';
        }
      }
    }

    // 1b2. Dive / surface prompt while standing in open water
    if (!showBtn) {
      if (this.player.isDiving) {
        showBtn = true;
        label = 'Surface';
        icon = '🏖️';
      } else if (!this.world.isInterior && this.world.getTileAt(this.player.x, this.player.y) === this.world.TILE_LAKE) {
        showBtn = true;
        label = 'Dive';
        icon = '🤿';
      }
    }

    // 1b3. Homestead farm plot
    if (!showBtn) {
      const plot = this._findFarmPlotAt();
      const farmAction = this._farmActionFor(plot);
      if (farmAction) {
        showBtn = true;
        label = farmAction === 'plant' ? 'Plant'
          : farmAction === 'water' ? 'Water'
          : farmAction === 'harvest' ? 'Harvest'
          : 'Wait';
        icon = farmAction === 'plant' ? '🌱'
          : farmAction === 'water' ? '💧'
          : farmAction === 'harvest' ? '🥕'
          : '⏳';
      }
    }

    // 1c. Check wild animal proximity (feed to tame)
    if (!showBtn) {
      const wildPet = this._findWildPetAt();
      if (wildPet) {
        showBtn = true;
        label = 'Feed';
        icon = PET_KINDS[wildPet.kind].emoji;
      }
    }

    // 1d. Check leashable critter proximity (needs a Critter Leash in the bag)
    if (!showBtn) {
      const critter = this._findLeashableCritterAt();
      if (critter) {
        showBtn = true;
        label = 'Leash';
        icon = '🪢';
      }
    }

    // 1e. Pet bed proximity — offer to leave a following companion home
    if (!showBtn) {
      const stayPet = this._findFollowingPetNearBed();
      if (stayPet) {
        showBtn = true;
        label = 'Stay';
        icon = '🛌';
      }
    }

    // 1f. Town shop props
    if (!showBtn && this._findComputerAt()) {
      showBtn = true;
      label = 'Computer';
      icon = '▣';
    }
    if (!showBtn && this._findRegisterAt()) {
      showBtn = true;
      label = 'Counter';
      icon = '$';
    }

    // 2. Check Item proximity
    if (!showBtn) {
      for (const item of this.world.items) {
        const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
        if (dist < 40) {
          showBtn = true;
          label = 'Grab';
          icon = item.emoji;
          break;
        }
      }
    }

    // 3. Check Container proximity
    if (!showBtn) {
      for (const c of this.world.containers) {
        const centerX = c.x + c.w / 2;
        const centerY = c.y + c.h / 2;
        const dist = Math.hypot(this.player.x - centerX, this.player.y - centerY);
        if (dist < 50 && !c.looted) {
          showBtn = true;
          label = c.type === 'homechest' ? 'Storage' : 'Search';
          icon = c.type === 'homechest' ? '📦' : c.type === 'cooler' ? '🧊' : '🗑️';
          break;
        }
      }
    }

    // 4. Check Bush proximity
    if (!showBtn) {
      const tileType = this.world.getTileAt(this.player.x, this.player.y);
      if (tileType === this.world.TILE_BUSH) {
        showBtn = true;
        label = this.player.isHiding ? 'Stand Up' : 'Hide';
        icon = '🌿';
      }
    }

    // 5. Check for a campfire/grill (cooking)
    if (!showBtn && this._findCookSpot()) {
      showBtn = true;
      label = 'Cook';
      icon = '🍳';
    }

    // 5a2. Raccoon's den
    if (!showBtn && this._findRaccoonDen()) {
      showBtn = true;
      label = 'Trade';
      icon = '🦝';
    }

    // 5b. Home cabin furniture
    if (!showBtn && this._findCabinDecor('wardrobe')) {
      showBtn = true;
      label = 'Wardrobe';
      icon = '👕';
    }
    if (!showBtn && this._findCabinDecor('workbench')) {
      showBtn = true;
      label = 'Craft';
      icon = '🛠️';
    }
    if (!showBtn && this._findCabinBed()) {
      showBtn = true;
      label = 'Sleep';
      icon = '😴';
    }

    // 6. Check for a castable fishing spot
    if (!showBtn && this._findFishingSpot()) {
      showBtn = true;
      label = 'Fish';
      icon = '🎣';
    }

    // Toggle button layout
    const actionBtn = document.getElementById('btn-action');
    if (showBtn) {
      actionBtn.classList.remove('hidden');
      document.getElementById('btn-action-label').innerText = label;
      document.getElementById('btn-action-icon').innerText = icon;
    } else {
      actionBtn.classList.remove('hidden');
      document.getElementById('btn-action-label').innerText = 'Go closer';
      document.getElementById('btn-action-icon').innerText = '·';
    }
    actionBtn.disabled = !showBtn;

    // Knockout Cudgel button: only shown once it's actually clickable —
    // owned, off cooldown, and a guard is in swinging range.
    const knockoutBtn = document.getElementById('btn-knockout');
    if (knockoutBtn) {
      const owned = (this.player.tools.stunner || 0) > 0;
      const ready = owned && this._stunnerCooldown <= 0 && !!this._stunnerTarget();
      knockoutBtn.classList.toggle('hidden', !ready);
      knockoutBtn.classList.toggle('ready', ready);
    }
  }

  /**
   * Set up the diagnostics system: a ring-buffer log plus global handlers so
   * runtime errors surface in the Dev menu instead of failing silently.
   */
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
  }

  /**
   * Append an entry to the debug log (mirrored to the browser console) and,
   * if the Dev menu is open, refresh the on-screen panel.
   * @param {'info'|'warn'|'error'} level
   * @param {string} msg
   */
  logDebug(level, msg) {
    if (!this.debugLog) return;
    const entry = { t: new Date().toLocaleTimeString('en-US', { hour12: false }), level, msg };
    this.debugLog.push(entry);
    if (this.debugLog.length > this.debugMax) this.debugLog.shift();

    const c = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    c(`[Diag] ${msg}`);

    const menu = document.getElementById('dev-menu');
    if (menu && !menu.classList.contains('hidden')) this.refreshDebugPanel();
  }

  /**
   * Render every furniture crop into the Dev menu so bad atlas coordinates are visible.
   */
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
  }

  /**
   * Render the live stats block and event log into the Dev menu Diagnostics section.
   */
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
  }

  /**
   * Escape text, then wrap important game words in colored highlight spans.
   * Used for dialogue, alerts, and the trade result line.
   */
  formatDialogue(text) {
    return this._escapeHtml(text)
      .replace(/(\d+\s+)?(Shiny\s+)?Pebbles?/gi, m => `<span class="hl-pebble">${m}</span>`)
      .replace(/snacks?|food|coolers?|trash cans?/gi, m => `<span class="hl-food">${m}</span>`)
      .replace(/Water Helmet|BACKPACK FULL/gi, m => `<span class="hl-special">${m}</span>`)
      .replace(/guards?|lifeguards?/gi, m => `<span class="hl-danger">${m}</span>`);
  }

  /** Set the rat dialogue text with keyword highlighting. */
  setDialogueText(text) {
    document.getElementById('dialogue-text').innerHTML = this.formatDialogue(text);
  }

  /** Small helper to avoid injecting markup from error messages into the log. */
  _escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /**
   * Main game loop execution
   */
  loop(time) {
    const dt = Math.min(0.1, (time - this.lastTime) / 1000); // Caps time-step spike
    this.lastTime = time;

    // Rolling FPS sample (updated ~4x/sec)
    this._frameAccum += dt;
    this._frameCount++;
    if (this._frameAccum >= 0.25) {
      this._fps = this._frameCount / this._frameAccum;
      this._frameAccum = 0;
      this._frameCount = 0;
    }

    try {
      this.friendlyUI?.update();
      if (this.state === 'playing') {
        if (document.getElementById('dialogue-overlay').classList.contains('hidden')) this.update(dt);
        this.draw();
      } else if (this.state === 'minigame') {
        // World freezes during minigames; only the minigame advances
        this.updateMinigame(dt);
        this.draw();
      } else if (this.state === 'disc') {
        this.updateDisc(dt);
        this.drawDisc();
      } else if (this.state === 'menu' || this.state === 'gameover' || this.state === 'paused' || this.state === 'backpack' || this.state === 'computer') {
        // Just keep rendering background scenes for aesthetic purposes
        this.draw();
      }
    } catch (err) {
      // A throw here would otherwise silently kill the animation loop.
      this._lastError = err.message;
      if (!this._loopErrored) {
        this._loopErrored = true; // log the first occurrence in full, then stay quiet
        this.logDebug('error', `Loop crash (${this.state}): ${err.message}`);
        console.error(err);
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Main game physics/state updates
   */
  update(dt) {
    // 1. Move Player
    const mv = this.input.getMovementVector();
    
    // Check if player is standing in water tile
    const tileType = this.world.getTileAt(this.player.x, this.player.y);
    const inWater = (tileType === this.world.TILE_LAKE || tileType === this.world.TILE_POOL);

    // If standing in water, trigger sound blips occasionally
    if (inWater && this.player.hydration < 100 && Math.random() < 0.03) {
      this.playSound('refill');
    }

    // Dive mode: drain oxygen, force-surface once the tank empties
    if (this.player.isDiving) {
      this.player.oxygen -= dt;
      if (this.player.oxygen <= 0) {
        this.player.oxygen = 0;
        this.surfaceFromDive(true);
      }
      this.updateHUD();
    }

    // Splash burst + sound when diving in or hopping out of water
    if (inWater !== this._wasInWater) {
      this.audio.play('splash', { volume: 0.7 });
      this.spawnBurst(this.player.x, this.player.y + 6, 'rgba(125, 211, 252, ALPHA)', 12);
      this._wasInWater = inWater;
    }

    // Footstep dust puffs while moving on land
    const isMovingNow = mv.x !== 0 || mv.y !== 0;
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
      this._advanceFarmDay();
      this.saveProfile();
      this.showAlert(`🌅 Day ${this.dayCount} at the resort!`);
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

    // Apply movement
    this.player.update(dt, mv, inWater);

    // Rising bubbles inside the flooded cabin (screen-space ambiance)
    this.updateBubbles(dt);

    // Tamed companions trail the player and may fetch a Pebble.
    // Any pet left home (Air Helmet on) just idles at its cabin bed spot.
    if (this.pets.length) {
      this.pets.forEach(pet => {
        if (pet.atHome) {
          pet.animTime += dt;
          pet.state = 'sleep';
          if (pet.happyTimer > 0) pet.happyTimer -= dt;
          return;
        }
        const reward = pet.update(dt, this.player, this.world);
        if (reward > 0) {
          this.player.pebbles += reward;
          this.spawnFloater(pet.x, pet.y - 24, `+${reward} ✨`, '#fde047');
          this.playSound('collect');
          this.updateHUD();
        }
      });
      this._petChipTimer = (this._petChipTimer || 0) - dt;
      if (this._petChipTimer <= 0) { this._petChipTimer = 0.5; this.updatePetChip(); }
    }

    // Wild (untamed) animals wander near their spawn point (Woods only)
    this.wildPets.forEach(wp => wp.update(dt, this.player, this.world));

    // If player starts walking, cancel hiding state automatically
    if (this.player.isHiding && (mv.x !== 0 || mv.y !== 0)) {
      this.player.isHiding = false;
      this.player.inPortableBush = false; // bush kit is single-use
    }

    // Check player-to-world block collisions
    const resolvedPos = this.world.checkCollisions(this.player.x, this.player.y, this.player.radius);
    this.player.x = resolvedPos.x;
    this.player.y = resolvedPos.y;

    // Touching an open campfire/grill flame: startle reaction + knockback
    // (distinct from the wider 60px "cook here" radius used by _findCookSpot)
    if (this.world.decorations && this.player.ouchT <= 0) {
      for (const d of this.world.decorations) {
        if (d.type !== 'campfire' && d.type !== 'grill') continue;
        if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < this.player.radius + 14) {
          this.player.triggerOuch(d.x, d.y);
          this.playSound('caught');
          break;
        }
      }
    }

    // Check for area transition triggers
    if (!this.isTransitioning && this.world.transitionPoints) {
      for (const tp of this.world.transitionPoints) {
        const inside = this.player.x > tp.x && this.player.x < tp.x + tp.w &&
                       this.player.y > tp.y && this.player.y < tp.y + tp.h;
        if (!inside) { tp._warned = false; continue; }

        if (tp.requires === 'helmet' && !this.player.hasHelmet) {
          const now = performance.now();
          if (!tp._warned || now - (tp._lastWarnAt || 0) > 2200) {
            tp._warned = true;
            tp._lastWarnAt = now;
            this.playSound('ui');
            this.showGateNotice(
              'Water Helmet Required',
              "You'll need the Water Helmet before the woods trail opens.",
              '!'
            );
          }
          continue;
        }

        if (tp.targetArea === '__exit') this.exitBuilding();
        else this.switchArea(tp.targetArea);
        break;
      }
    }

    // Sleeping camper: movement nearby fills the wake meter
    const cm = this.world.camper;
    if (cm && !cm.awake) {
      const d = Math.hypot(this.player.x - cm.x, this.player.y - cm.y);
      if (d < 170) {
        cm.wake += (isMovingNow ? 26 : 6) * dt;
      } else {
        cm.wake = Math.max(0, cm.wake - 12 * dt);
      }
      if (cm.wake >= 100) {
        cm.awake = true;
        this._wokeCamper = true;
        this.playSound('alert');
        this.triggerScreenShake(5, 0.4);
        this.showAlert('😱 You woke the camper! Get out before security arrives!');
      }
    }

    // Check game-over condition for dehydration
    if (this.player.isDead) {
      this.triggerGameOver('dehydration');
      return;
    }

    // 2. Update guards AI
    let isChased = false;
    let isCaught = false;

    this.guards.forEach(guard => {
      const caughtThisFrame = guard.update(dt, this.player, this.world);
      if (caughtThisFrame) {
        isCaught = true;
      }
      if (guard.state === 'chase') {
        isChased = true;
      }
    });

    if (isCaught) {
      this.triggerGameOver('guards');
      return;
    }

    // Toggle guard alert sound & HUD banner
    if (isChased) {
      if (!this._wasChased) {
        this.triggerScreenShake(4, 0.3); // jolt the moment you're spotted
        this.runStats.spotted++;
      }
      document.getElementById('alert-banner').classList.remove('hidden');
      if (Math.random() < 0.08) {
        this.playSound('alert');
      }
    } else {
      document.getElementById('alert-banner').classList.add('hidden');
    }
    this._wasChased = isChased;
    this.audio.setChase(isChased);

    // 2b. Advance particle bursts / screen shake timers / text popups
    this.updateParticles(dt);
    this.updateFloaters(dt);

    // 4. Update Camera: smoothly ease toward the player, with a slight
    // lead in the movement direction so you see more of where you're going.
    let targetX = this.player.x - this.camera.w / 2 + mv.x * 40;
    let targetY = this.player.y - this.camera.h / 2 + mv.y * 40;
    // Clamp to world bounds; center instead when the room is smaller than the view
    targetX = this.world.width < this.camera.w
      ? (this.world.width - this.camera.w) / 2
      : Math.max(0, Math.min(this.world.width - this.camera.w, targetX));
    targetY = this.world.height < this.camera.h
      ? (this.world.height - this.camera.h) / 2
      : Math.max(0, Math.min(this.world.height - this.camera.h, targetY));
    const snap = Math.hypot(targetX - this.camera.x, targetY - this.camera.y) > 600;
    const k = snap ? 1 : 1 - Math.exp(-6 * dt);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;

    // 4. Update HUD values
    this.updateHUD();

    // 5. Context-aware interaction triggers
    this.pollContextInteraction();
  }

  /**
   * Spawn a small burst of colored particles at a world position — used
   * for loot pickups and container looting.
   */
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
  }

  /** Spawn a floating world-space text popup ("+1 Driftwood", "+30 ✨"). */
  spawnFloater(x, y, text, color = '#fde047') {
    this.floaters.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
  }

  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

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
  }

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
  }

  /** === Rat quests: one rotating objective at a time for bonus pebbles === */
  static QUESTS = [
    { id: 'sell3', text: 'Sell 3 snacks to the rat', type: 'sell', n: 3, reward: 30 },
    { id: 'loot4', text: 'Loot 4 containers', type: 'loot', n: 4, reward: 25 },
    { id: 'craft1', text: 'Craft any tool', type: 'craft', n: 1, reward: 35 },
    { id: 'enter1', text: 'Sneak inside a building', type: 'enter', n: 1, reward: 20 },
    { id: 'mat5', text: 'Gather 5 crafting materials', type: 'material', n: 5, reward: 25 },
    { id: 'fish2', text: 'Catch 2 fish', type: 'fish', n: 2, reward: 40 },
    { id: 'cook1', text: 'Cook a dish at a campfire', type: 'cook', n: 1, reward: 30 },
    { id: 'marketfish2', text: 'Sell 2 fish to the Fish Market', type: 'marketsell', n: 2, reward: 35 },
  ];

  assignQuest() {
    // Fishing-related quests only make sense once the player owns a rod
    const needsRod = new Set(['fish', 'marketsell']);
    const pool = Game.QUESTS.filter(q =>
      q.id !== this._lastQuestId && (!needsRod.has(q.type) || this.player.hasRod));
    const q = pool[Math.floor(Math.random() * pool.length)];
    this.quest = { ...q, progress: 0 };
    this._lastQuestId = q.id;
    this.updateQuestChip();
  }

  /** Report a gameplay event that may advance the active quest. */
  questEvent(type, n = 1) {
    const q = this.quest;
    if (!q || q.type !== type) return;
    q.progress = Math.min(q.n, q.progress + n);
    if (q.progress >= q.n) {
      this.player.pebbles += q.reward;
      this.scorePebbles += q.reward;
      this.runStats.pebbles += q.reward;
      this.stats.questsCompleted++;
      this.quest = null;
      this.playSound('sell');
      this.spawnFloater(this.player.x, this.player.y - 34, `+${q.reward} ✨`, '#fbbf24');
      this.showAlert(`📜 Quest complete! +${q.reward} Pebbles. See the rat for another.`);
      this.saveProfile();
    }
    this.updateQuestChip();
    this.updateHUD();
  }

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
  }

  /** Kick off a brief camera shake — used when a guard spots the player. */
  triggerScreenShake(magnitude, duration) {
    this.screenShake.magnitude = magnitude;
    this.screenShake.duration = duration;
    this.screenShake.timeLeft = duration;
  }

  /** Advance particle physics/lifetime and the screen shake timer. */
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
  }

  /** Draw active particles (world-space, called between entities and lighting). */
  drawParticles(ctx) {
    this.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color.replace('ALPHA', alpha.toFixed(2));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Weather: occasional rain showers. Rain slowly rehydrates the player on
   * land (free looting window!) but everything darkens and guards see less.
   */
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
  }

  /**
   * Spawn/advance rising bubbles for the flooded cabin. Bubbles live in
   * screen space (like a dive-mask overlay), continuously rising and
   * respawning at the bottom. Cleared when leaving the water.
   */
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
  }

  /**
   * Screen-space underwater wash + rising bubbles for the flooded cabin.
   * Drawn after ctx.restore() so it blankets the whole viewport under the UI.
   */
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
  }

  /** Screen-space rain streaks + a cool gray wash (drawn after ctx.restore). */
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
  }

  /**
   * Darken the visible viewport and punch a soft glowing hole around the
   * player, like a lantern — fits the sneak-past-the-guards night setting
   * and gives fog-of-war-adjacent areas some atmosphere. Runs in
   * camera/world space, so it must be called while the camera translate
   * is still active (before ctx.restore()).
   */
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
  }

  /**
   * Screen-space vignette — a soft dark falloff toward the viewport edges.
   * Cached and only rebuilt when the viewport size changes.
   */
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
  }

  /**
   * Main game rendering
   */
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
      sortableEntities.push({ y: pet.y, draw: (ctx) => pet.draw(ctx, petUnderwater) });
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
        { landmarks: this.world.getLandmarks() }
      );
    }
  }

  showAlert(message, duration = 3000) {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    
    banner.querySelector('.alert-text').innerHTML = this.formatDialogue(message);
    banner.classList.remove('hidden');
    
    if (this._alertTimeout) clearTimeout(this._alertTimeout);
    this._alertTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, duration);
  }

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
  }

  /** === Rat-Crafting === */
  openCrafting() {
    this.state = 'paused';
    document.getElementById('craft-overlay').classList.remove('hidden');
    this.updateCraftUI();
  }

  closeCrafting() {
    this.state = 'playing';
    document.getElementById('craft-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

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
  }

  craftItem(recipe) {
    if (!canCraft(recipe, this.player.materials)) return;
    this.player.spendMaterials(recipe.mats);
    this.player.tools[recipe.id] = (this.player.tools[recipe.id] || 0) + 1;
    this.playSound('upgrade');
    this.questEvent('craft');
    this.updateCraftUI();
  }

  /** Use a crafted tool from the backpack. */
  useTool(id) {
    const p = this.player;
    if ((p.tools[id] || 0) <= 0) return;
    if (id === 'squirt') {
      p.tools[id]--;
      p.hydration = p.maxHydration;
      this.playSound('refill');
      this.showAlert('💧 Glug glug... fully hydrated!');
    } else if (id === 'bushkit') {
      p.tools[id]--;
      p.isHiding = true;
      p.inPortableBush = true;
      this.playSound('hide');
      this.closeBackpack();
      return;
    } else if (id === 'decoy') {
      if (this.world.isInterior) { this.showAlert('🦆 Not enough room in here!'); return; }
      p.tools[id]--;
      this.decoys.push({ x: p.x + 20, y: p.y + 20, t: 9 });
      this.playSound('collect');
      this.showAlert('🦆 Decoy placed! Guards can\'t resist a duck.');
      this.closeBackpack();
      return;
    } else if (id === 'leash') {
      this._leashCritter(this._findLeashableCritterAt());
      this.closeBackpack();
      return;
    } else if (id === 'stunner') {
      this._useStunner();
      this.closeBackpack();
      return;
    }
    this.updateHUD();
    this.updateBackpackUI();
  }

  selectActionSlot(index) {
    if (index < 0 || index >= this.actionSlots.length) return;
    this.selectedActionSlot = index;
    this.renderActionBar();
  }

  /**
   * Rebuild the hotbar's DOM once, then on every later call (this runs
   * every frame via updateHUD) just patch the existing buttons in place.
   * Recreating the nodes each call used to delete the pressed button out
   * from under a mousedown before its mouseup could land, so clicks/taps
   * silently never fired — this keeps the same elements alive across frames.
   */
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
  }

  /**
   * Paint one hotbar slot's icon element — a real sprite crop where we have
   * art for it (seeds, water), an emoji fallback for snack (shows whichever
   * food item the player is carrying — inherently dynamic, no fixed sprite).
   */
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
  }

  /** Paint a sprite crop (from a loaded sheet) into a HUD icon element via CSS background-image. */
  _paintSpriteIcon(iconEl, sheetImg, crop, scale) {
    iconEl.textContent = '';
    iconEl.style.display = 'inline-block';
    iconEl.style.width = `${crop.sw * scale}px`;
    iconEl.style.height = `${crop.sh * scale}px`;
    iconEl.style.backgroundImage = `url(${sheetImg.src})`;
    iconEl.style.backgroundPosition = `-${crop.sx * scale}px -${crop.sy * scale}px`;
    iconEl.style.backgroundSize = `${sheetImg.naturalWidth * scale}px ${sheetImg.naturalHeight * scale}px`;
    iconEl.style.imageRendering = 'pixelated';
  }

  /**
   * One-time swap of the fixed (never-changing) HUD stat-chip icons from
   * emoji to sprites. Sprites load asynchronously (fire-and-forget Image()
   * in AssetLoader), so this is called every updateHUD() tick until all
   * three have actually painted, then it's a no-op forever after.
   */
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
  }

  _actionSlotCount(id) {
    if (id === 'seeds') return this.farmSeedCount;
    if (id === 'snack') {
      const food = this.player.items.find(i => i.type === 'food' || i.type === 'drink');
      return food ? (food.qty || 1) : 0;
    }
    return null;
  }

  useSelectedActionSlot() {
    const slot = this.actionSlots[this.selectedActionSlot];
    if (!slot) return false;
    if (slot.id === 'snack') {
      const idx = this.player.items.findIndex(i => i.type === 'food' || i.type === 'drink');
      if (idx < 0) {
        this.showAlert('No quick snack in your backpack.');
        return true;
      }
      if (this.player.eatItem(idx)) {
        this.playSound('refill');
        this.showAlert('Yum! Hydration up + speed boost!');
        this.updateHUD();
        return true;
      }
    }
    return false;
  }

  static STUNNER_RANGE = 90;

  /** Nearest un-stunned guard within cudgel range, or null. */
  _stunnerTarget() {
    let target = null;
    let bestDist = Game.STUNNER_RANGE;
    for (const g of this.guards) {
      if (g.state === 'stunned') continue;
      const d = Math.hypot(this.player.x - g.x, this.player.y - g.y);
      if (d < bestDist) { bestDist = d; target = g; }
    }
    return target;
  }

  /**
   * Knockout Cudgel: a melee weapon, reusable — never consumed, just goes
   * on a short cooldown so it can't be spammed. Knocks out the nearest
   * guard within swinging range.
   */
  _useStunner() {
    const p = this.player;
    if ((p.tools.stunner || 0) <= 0) return;
    if (this._stunnerCooldown > 0) {
      this.showAlert(`🏏 Recharging... ${this._stunnerCooldown.toFixed(1)}s`);
      return;
    }
    const target = this._stunnerTarget();
    this._stunnerCooldown = 3;
    if (!target) {
      this.showAlert('🏏 No guard close enough to swing at.');
      return;
    }
    target.stun(4);
    this.playSound('collect');
    this.triggerScreenShake(2, 0.15);
    this.showAlert('🏏 Knocked out! Sneak past while they\'re down.');
  }

  /**
   * Unleash! — sic a tamed companion on the nearest guard within range.
   * Cycles through tamed pets (not left at home) each press so, with more
   * than one, repeated taps send a different one. The targeted guard gets
   * startled (alert reset, brief 'idle' stall) rather than a hard stun —
   * a softer, reusable distraction alongside the Sneak Stun Slingshot.
   */
  _unleashPet() {
    const available = this.pets.filter(p => !p.atHome && p.state !== 'unleashed');
    if (!available.length) {
      this.showAlert('🐾 No companion ready to unleash right now.');
      return;
    }
    this._unleashCycle = ((this._unleashCycle || 0) + 1) % available.length;
    const pet = available[this._unleashCycle];

    const range = 260;
    let target = null, bestDist = range;
    for (const g of this.guards) {
      const d = Math.hypot(pet.x - g.x, pet.y - g.y);
      if (d < bestDist) { bestDist = d; target = g; }
    }
    if (!target) {
      this.showAlert(`🐾 ${pet.name} has no one nearby to chase off.`);
      return;
    }
    pet.unleash(target, 4);
    if (target.state !== 'chase') {
      target.state = 'idle';
      target.idleTimer = 1.8;
      target.alertLevel = 0;
      target.speech = '?!';
      target.speechTime = 1.2;
    }
    this.playSound('collect');
    this.showAlert(`🐾 ${pet.name} is on it!`);
  }

  /** Tether a nearby critter with a Critter Leash from the bag. Shared by the backpack's Use button and the on-screen context prompt. */
  _leashCritter(target) {
    if ((this.player.tools.leash || 0) <= 0) return;
    if (!target) {
      this.showAlert('🪢 No animal close enough to leash — get near a chicken or cow first!');
      return;
    }
    this.player.tools.leash--;
    target.leashed = true;
    this.playSound('collect');
    this.showAlert(`🪢 Leashed a ${target.kind}! It'll follow you now.`);
    this.updateHUD();
    this.updateBackpackUI();
  }

  openBackpack() {
    if (this.state !== 'playing') return;
    this.state = 'backpack';
    document.getElementById('backpack-overlay').classList.remove('hidden');
    const title = document.querySelector('#backpack-overlay .inventory-titlebar h2');
    if (title) title.textContent = 'Backpack';
    this.updateBackpackUI();
  }

  closeBackpack() {
    if (this.state !== 'backpack') return;
    this.state = 'playing';
    document.getElementById('backpack-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  }

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
  }

  dropItem(index) {
    if (index < 0 || index >= this.player.items.length) return;

    const droppedItem = this.player.removeItem(index, 1);

    // Spawn close to player
    const angle = Math.random() * Math.PI * 2;
    const distance = 40;
    this.world.items.push({
      x: this.player.x + Math.cos(angle) * distance,
      y: this.player.y + Math.sin(angle) * distance,
      radius: 10,
      ...droppedItem
    });
    
    this.playSound('collect');
    this.updateHUD();
    this.updateBackpackUI();
  }
}

// Shop, fish-market, and raccoon-shop methods live in ShopUI.js and are
// mixed onto the prototype so `this` still resolves to the Game instance.
Object.assign(Game.prototype, ShopMethods);
Object.assign(Game.prototype, FarmMethods);
Object.assign(Game.prototype, MinigameMethods);
