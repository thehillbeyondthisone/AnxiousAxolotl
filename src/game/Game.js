import { UIStateMethods } from './UIState.js';
import { InteractionsMethods } from './Interactions.js';
import { EnvironmentMethods } from './Environment.js';
import { RenderingMethods } from './Rendering.js';
import { MilestoneUIMethods } from './MilestoneUI.js';
import { ProgressionTracker } from './Progression.js';
import { preloadGroup } from './ImageRegistry.js';
import { Input } from './Input.js';
import { FriendlyUI } from './FriendlyUI.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { NPC } from './NPC.js';
import { WorldGenerator } from './WorldGenerator.js';
import { AudioManager } from './AudioManager.js';

import { buildInterior } from './Interior.js';
import { buildUnderwaterZone } from './Underwater.js';

import { AchievementTracker } from './Achievements.js';
import { SaveManager } from './SaveManager.js';
import { findSkin } from './Unlockables.js';
import { Pet, PET_KINDS, TAME_REQUIREMENTS } from './Pet.js';
import { ShopMethods } from './ShopUI.js';
import { FarmMethods } from './Farming.js';
import { MinigameMethods } from './Minigames.js';
import { DISC_CATALOG, findDisc } from './DiscCatalog.js';
import { Sprites } from './AssetLoader.js';

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
    this.hasSprinkler = false;
    this.hasExtraPlots = false;
    this.helperServicedDay = 0;
    this.ownedFurniture = [];
    this.furnitureLayout = {};
    this.guidanceHidden = false;
    this.progression = new ProgressionTracker();
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
    this.saveManager = new SaveManager('resortRogueProfile', { onStatus: (status, message) => {
      this._saveStatusMessage = message;
      const el = document.getElementById('save-status');
      if (el) { el.textContent = message; el.classList.toggle('hidden', !message); }
    } });
    this._registerSaveFields();
    this.loadProfile();
    this.player.onInventoryChange = () => {
      if (this._inventorySaveQueued) return;
      this._inventorySaveQueued = true;
      queueMicrotask(() => { this._inventorySaveQueued = false; this.saveProfile(); });
    };
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
    this.setupMilestoneUI();
    this._autosave = setInterval(() => { if (!document.hidden && this.state !== 'menu') this.saveProfile(); }, 30000);
    window.addEventListener('pagehide', () => this.saveProfile());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveProfile(); });

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

    for (const key of ['items','materials','tools']) s.register(key, () => p()[key], v => { p()[key] = v; });
    for (const key of ['dayCount','timeOfDay','selectedCropType','quest','_lastQuestId','guidanceHidden','hasSprinkler','hasExtraPlots','helperServicedDay','ownedFurniture','furnitureLayout']) s.register(key, () => this[key] ?? null, v => { this[key] = v; });
    s.register('progression', () => this.progression.serialize(), v => { this.progression = new ProgressionTracker(v); });
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

  saveProfile() {
    if (this.activeDisc && !this._activeDiscResolved) this.discProgress[this.activeDisc.id] = this.activeDisc.serialize();
    return this.saveManager.save();
  }
  loadProfile() {
    const result = this.saveManager.load();
    if (!this.saveManager.extra.progression && ['loaded','migrated','recovered'].includes(result.status)) this.progression.reconcile(this.saveManager.extra);
    this.player.hydration = this.player.maxHydration;
    this.player.oxygen = this.player.maxOxygen;
    return result;
  }

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
    if (box.type === 'homecabin') this.recordProgress('home');

    let interior = this._interiors.get(box);
    if (!interior) {
      interior = new World(buildInterior(box, { homeUpgrades: this._homeUpgradeSnapshot(), furnitureLayout: this.furnitureLayout, ownedFurniture: this.ownedFurniture }));
      this._interiors.set(box, interior);
    }

    this._outside = {
      building: box,
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
      pet._homePath = null; pet._homeActivity = null; pet.climbOffset = 0;
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
    this._applyHomeFarmState();
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
   * Dialogue option: sell backpack items to the Sewer Rat
   */

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

  async bootDisc(id) {
    if (!this.ownedDiscs.includes(id) || this.state !== 'computer') return;
    const previous = this.state;
    this.state = 'disc-loading'; this.input.reset();
    const status = document.getElementById('disc-load-status');
    let createDiscExperience;
    try {
      ({ createDiscExperience } = await import('./Discs.js'));
      await preloadGroup(id, (n,total) => { status.textContent = `Loading ${n}/${total} pictures…`; });
    } catch (e) { this.state = previous; status.textContent = e.message + ' Choose Play to retry.'; return; }
    status.textContent = '';
    document.getElementById('computer-overlay')?.classList.add('hidden');
    this.activeDisc = createDiscExperience(id, this.discProgress[id] || {});
    this._activeDiscResolved = false;
    this.state = 'disc';
    document.getElementById('game-container')?.classList.add('disc-mode');
    document.getElementById('game-hud')?.classList.remove('hidden');
    document.getElementById('btn-disc-back')?.classList.remove('hidden');
    const actionBtn = document.getElementById('btn-action');
    actionBtn?.classList.add('hidden');
    const label = document.getElementById('btn-action-label');
    const icon = document.getElementById('btn-action-icon');
    if (label) label.innerText = 'Action';
    if (icon) icon.innerText = '▣';
    if (typeof this.activeDisc.mountHud === 'function') this.activeDisc.mountHud();
    this.playSound('ui');
  }

  updateDisc(dt) {
    if (!this.activeDisc) {
      this.exitDiscToComputer();
      return;
    }
    this.activeDisc.update(dt, this.input.keys, this.camera);
    if (this.activeDisc.exitRequested) {
      this.exitDiscToComputer();
      return;
    }
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
    if (typeof this.activeDisc?.unmountHud === 'function') this.activeDisc.unmountHud();
    if (this.activeDisc && !this._activeDiscResolved && this.activeDisc.done) {
      this.resolveActiveDisc();
    } else if (this.activeDisc && !this.activeDisc.done) {
      this.discProgress[this.activeDisc.id] = this.activeDisc.serialize();
      this.saveProfile();
    }
    this.activeDisc = null;
    this._activeDiscResolved = false;
    this.state = 'computer';
    document.getElementById('game-container')?.classList.remove('disc-mode');
    document.getElementById('btn-disc-back')?.classList.add('hidden');
    document.getElementById('computer-overlay')?.classList.remove('hidden');
    this.updateComputerUI();
    this.lastTime = performance.now();
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
      this.updateMilestoneHUD();
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
      } else if (['journal','decorating','disc-loading'].includes(this.state) || this.state === 'menu' || this.state === 'gameover' || this.state === 'paused' || this.state === 'backpack' || this.state === 'computer') {
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

    const isMovingNow = mv.x !== 0 || mv.y !== 0;
    this.updateAmbientBeforeMove(dt,isMovingNow,inWater);

    // Apply movement
    this.player.update(dt, mv, inWater);

    this.updateAmbientAfterMove(dt);

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
    this.updateMilestoneHUD();

    // 5. Context-aware interaction triggers
    this.pollContextInteraction();
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

  /** Range of the reusable knockout tool. */
  static STUNNER_RANGE = 90;

}

// Shop, fish-market, and raccoon-shop methods live in ShopUI.js and are
// mixed onto the prototype so `this` still resolves to the Game instance.
Object.assign(Game.prototype, ShopMethods);
Object.assign(Game.prototype, FarmMethods);
Object.assign(Game.prototype, MinigameMethods);

Object.assign(Game.prototype, RenderingMethods);

Object.assign(Game.prototype, EnvironmentMethods);

Object.assign(Game.prototype, InteractionsMethods);

Object.assign(Game.prototype, UIStateMethods);

Object.assign(Game.prototype, MilestoneUIMethods);
