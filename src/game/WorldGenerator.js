/**
 * WorldGenerator — Procedural map generation for Anxious Axolotl.
 * 
 * Inspired by Zelda's overworld: distinct themed zones with natural
 * transitions, hidden areas, and strategic resource placement.
 * 
 * Uses a zone-stamping approach: the map is divided into biome regions
 * that are placed according to configurable rules, then populated with
 * objects, NPCs, and decorations.
 */
export class WorldGenerator {
  /**
   * @param {object} config - Generation parameters from dev menu
   * @param {number} config.cols - Map width in tiles
   * @param {number} config.rows - Map height in tiles
   * @param {number} config.zoneSpacing - Min gap between zone centers (tiles)
   * @param {number} config.treeDensity - Number of trees to scatter
   * @param {number} config.guardCount - Number of guards to spawn
   */
  constructor(config = {}) {
    this.cols = config.cols || 32;
    this.rows = config.rows || 24;
    this.zoneSpacing = config.zoneSpacing || 12;
    this.treeDensity = config.treeDensity || 11;
    this.guardCount = config.guardCount || 4;
    // Explicit override for how many buildings (camps/shops) to place —
    // falls back to the zoneSpacing-derived count when not specified.
    this.buildingCount = config.buildingCount || null;
    this.tileSize = 64;
    this.seed = config.seed || Math.floor(Math.random() * 999999);
    this.areaType = config.areaType || 'campsite'; // 'campsite' | 'town'
  }

  /**
   * Simple seeded pseudo-random number generator (Mulberry32).
   * Gives us reproducible worlds from a seed.
   */
  _initRng() {
    let s = this.seed;
    this._rng = () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** Random float in [min, max) */
  _rand(min = 0, max = 1) { return this._rng() * (max - min) + min; }

  /** Random int in [min, max] inclusive */
  _randInt(min, max) { return Math.floor(this._rand(min, max + 1)); }

  /** Pick random element from array */
  _pick(arr) { return arr[this._randInt(0, arr.length - 1)]; }

  // ─── Tile Constants ───
  static TILE_LAKE = 0;
  static TILE_BEACH = 1;
  static TILE_GRASS = 2;
  static TILE_CONCRETE = 3;
  static TILE_POOL = 4;
  static TILE_BUSH = 5;
  static TILE_ROAD = 6;
  static TILE_SIDEWALK = 7;

  /**
   * Generate a complete world. Returns all data needed by World constructor.
   */
  generate() {
    this._initRng();

    if (this.areaType === 'town') {
      return this._generateTown();
    }
    if (this.areaType === 'woods') {
      return this._generateWoods();
    }
    return this._generateCampsite();
  }

  /** Generate the Campsite area (original behavior) */
  _generateCampsite() {
    const map = this._generateTerrain();
    const zones = this._placeZones(map);
    const colliders = this._generateColliders(map, zones);
    const containers = this._generateContainers(zones);
    const items = this._generateItems(zones);
    const decorations = this._generateDecorations(map, colliders, zones);
    const guardPatrols = this._generateGuardPatrols(zones);
    const rat = this._placeRat(map);

    // Campfires near camps — cook spots for the cooking minigame
    zones.filter(z => z.type === 'camp').forEach((camp, i) => {
      if (i % 2 !== 0) return; // roughly one fire per two camps
      decorations.push({
        x: (camp.centerX || (camp.c + 2) * this.tileSize) + this._randInt(70, 110),
        y: (camp.centerY || (camp.r + 1) * this.tileSize) + this._randInt(40, 80),
        type: 'campfire'
      });
    });

    // Add bus stop transition point at bottom of map (road to town)
    const swampStart = this.rows - Math.max(2, Math.floor(this.rows * 0.08));
    // Woods trailhead — gated on the Water Helmet: that's what actually
    // lets Axel survive on dry land indefinitely, so it's the mechanical
    // (not arbitrary) reason the homestead only opens up once you own one.
    const meadowZone = zones.find(z => z.type === 'grass');
    const trailR = meadowZone ? meadowZone.r + Math.floor(meadowZone.h / 2) : 10;
    const transitionPoints = [
      {
        x: Math.floor(this.cols * 0.75) * this.tileSize,
        y: (swampStart - 2) * this.tileSize,
        w: 96, h: 64,
        targetArea: 'town',
        label: '🚌 Bus to Town'
      },
      {
        x: 0,
        y: trailR * this.tileSize,
        w: 64, h: 160,
        targetArea: 'woods',
        requires: 'helmet',
        label: '🌲 Trail into the Woods'
      }
    ];

    return {
      cols: this.cols, rows: this.rows, tileSize: this.tileSize,
      areaType: 'campsite', areaName: 'Resort Campsite',
      map, colliders, containers, items, decorations, rat,
      guardPatrols, zones, transitionPoints, seed: this.seed
    };
  }

  /**
   * Generate the Boardwalk Town — a separate area with shops,
   * streets, alleys, and a pier. Like Sneaky Sasquatch's town!
   */
  _generateTown() {
    const T = WorldGenerator;
    const map = new Array(this.rows * this.cols).fill(T.TILE_SIDEWALK);

    // === Town Terrain Layout ===
    // Top rows: park/grass strip
    const parkDepth = Math.max(3, Math.floor(this.rows * 0.15));
    // Middle: streets + sidewalks (default fill is sidewalk)
    // Bottom rows: pier/boardwalk over water
    const pierStart = this.rows - Math.max(3, Math.floor(this.rows * 0.15));

    // Paint park
    for (let r = 0; r < parkDepth; r++) {
      for (let c = 0; c < this.cols; c++) {
        map[r * this.cols + c] = T.TILE_GRASS;
      }
    }

    // Paint main roads (horizontal)
    const mainRoadY = Math.floor(this.rows * 0.45);
    for (let r = mainRoadY; r < mainRoadY + 2 && r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        map[r * this.cols + c] = T.TILE_ROAD;
      }
    }

    // Paint cross roads (vertical) — creates grid blocks
    const crossRoadCount = Math.max(2, Math.floor(this.cols / 10));
    const crossRoads = [];
    for (let i = 0; i < crossRoadCount; i++) {
      const cx = Math.floor((i + 1) * this.cols / (crossRoadCount + 1));
      crossRoads.push(cx);
      for (let r = parkDepth; r < pierStart; r++) {
        if (cx < this.cols) map[r * this.cols + cx] = T.TILE_ROAD;
        if (cx + 1 < this.cols) map[r * this.cols + cx + 1] = T.TILE_ROAD;
      }
    }

    // Paint pier / boardwalk
    for (let r = pierStart; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        map[r * this.cols + c] = (r === this.rows - 1) ? T.TILE_LAKE : T.TILE_BEACH;
      }
    }

    // Small fountain pool in the park — guarded against ever painting over
    // a road tile (water shouldn't interrupt a drivable/walkable street)
    const fountainC = Math.floor(this.cols / 2);
    const fountainR = Math.floor(parkDepth / 2);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = fountainR + dr, cc = fountainC + dc;
        if (rr >= 0 && rr < this.rows && cc >= 0 && cc < this.cols && map[rr * this.cols + cc] !== T.TILE_ROAD) {
          map[rr * this.cols + cc] = T.TILE_POOL;
        }
      }
    }

    // === Town Zones ===
    const zones = [];
    zones.push({
      name: 'Town Park', type: 'park',
      r: 0, c: 0, h: parkDepth, w: this.cols,
      spawnX: Math.floor(this.cols / 2) * this.tileSize,
      spawnY: Math.floor(parkDepth / 2) * this.tileSize
    });
    zones.push({
      name: 'Main Street', type: 'street',
      r: parkDepth, c: 0, h: pierStart - parkDepth, w: this.cols
    });
    zones.push({
      name: 'Boardwalk Pier', type: 'pier',
      r: pierStart, c: 0, h: this.rows - pierStart, w: this.cols
    });

    // === Town Colliders (Shops, Benches, Trees) ===
    const colliders = [];
    const occupied = new Set();
    const markOccupied = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize);
      const r1 = Math.floor(y / this.tileSize);
      const c2 = Math.ceil((x + w) / this.tileSize);
      const r2 = Math.ceil((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) occupied.add(`${r},${c}`);
    };
    const isOccupied = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize);
      const r1 = Math.floor(y / this.tileSize);
      const c2 = Math.ceil((x + w) / this.tileSize);
      const r2 = Math.ceil((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (occupied.has(`${r},${c}`)) return true;
      return false;
    };

    // Does a building footprint overlap any water tile (lake/pool)? Buildings
    // should never spawn sitting in the fountain pool or the lake.
    const overlapsWater = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize), r1 = Math.floor(y / this.tileSize);
      const c2 = Math.floor((x + w) / this.tileSize), r2 = Math.floor((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
          const t = map[r * this.cols + c];
          if (t === T.TILE_LAKE || t === T.TILE_POOL) return true;
        }
      }
      return false;
    };

    // Place shops along upper sidewalk blocks (between park and main road).
    // Town storefronts carry interior metadata so their doors open into
    // themed rooms instead of the campsite's generic upgrade menu.
    const shopCatalog = [
      { name: 'Fish Market', kind: 'fish_market', color: '#1e40af', accent: '#38bdf8', sign: 'FISH' },
      { name: 'Surf Shop', kind: 'surf_shop', color: '#0f766e', accent: '#67e8f9', sign: 'SURF' },
      { name: 'Ice Cream', kind: 'ice_cream', color: '#be185d', accent: '#f9a8d4', sign: 'ICE' },
      { name: 'Souvenir Shop', kind: 'souvenir_shop', color: '#7c3aed', accent: '#c4b5fd', sign: 'GIFTS' },
      { name: 'Juice Bar', kind: 'juice_bar', color: '#c2410c', accent: '#fdba74', sign: 'JUICE' },
      { name: 'Bait & Tackle', kind: 'bait_tackle', color: '#4338ca', accent: '#a5b4fc', sign: 'BAIT' },
    ];
    const makeTownShop = (shopX, shopY, w, h, idx) => {
      const spec = shopCatalog[idx % shopCatalog.length];
      return {
        x: shopX, y: shopY, w, h,
        type: 'shop',
        shopName: spec.name,
        shopKind: spec.kind,
        interiorKind: 'town_shop',
        color: spec.color,
        accentColor: spec.accent,
        signShort: spec.sign,
      };
    };
    let shopIdx = 0;
    for (let blockStart = 1; blockStart < this.cols - 4; blockStart += Math.floor(this.cols / crossRoadCount)) {
      const shopX = (blockStart + 1) * this.tileSize;
      const shopY = (parkDepth + 1) * this.tileSize;
      if (!isOccupied(shopX, shopY, 160, 96) && !overlapsWater(shopX, shopY, 160, 96)) {
        colliders.push(makeTownShop(shopX, shopY, 160, 96, shopIdx));
        markOccupied(shopX, shopY, 160, 96);
        shopIdx++;
      }
    }

    // Place shops along lower sidewalk blocks (between main road and pier)
    for (let blockStart = 2; blockStart < this.cols - 5; blockStart += Math.floor(this.cols / crossRoadCount) + 1) {
      const shopX = (blockStart + 1) * this.tileSize;
      const shopY = (mainRoadY + 3) * this.tileSize;
      if (!isOccupied(shopX, shopY, 140, 96) && !overlapsWater(shopX, shopY, 140, 96)) {
        colliders.push(makeTownShop(shopX, shopY, 140, 96, shopIdx));
        markOccupied(shopX, shopY, 140, 96);
        shopIdx++;
      }
    }

    // Seeded surprise: exactly one town storefront gets the meta computer.
    // The host changes with the world seed, but is stable for a given run.
    const computerCandidates = colliders.filter(c => c.type === 'shop' && c.interiorKind === 'town_shop');
    if (computerCandidates.length) {
      const idx = Math.abs((this.seed * 2654435761 + this.cols * 97 + this.rows * 193) | 0) % computerCandidates.length;
      computerCandidates[idx].hasComputer = true;
    }

    // Park trees
    const parkTrees = Math.max(3, Math.floor(this.treeDensity * 0.5));
    for (let i = 0; i < parkTrees; i++) {
      const tx = this._randInt(1, this.cols - 2) * this.tileSize;
      const ty = this._randInt(0, parkDepth - 1) * this.tileSize;
      if (!isOccupied(tx, ty, 24, 24)) {
        colliders.push({ x: tx, y: ty, w: 24, h: 24, type: 'tree', variant: this._randInt(0, 3) });
        markOccupied(tx, ty, 48, 48);
      }
    }

    // Benches along sidewalks
    for (let i = 0; i < 4; i++) {
      const bx = this._randInt(2, this.cols - 3) * this.tileSize;
      const by = (mainRoadY - 1) * this.tileSize;
      if (!isOccupied(bx, by, 48, 24)) {
        colliders.push({ x: bx, y: by, w: 48, h: 24, type: 'table' });
        markOccupied(bx, by, 48, 24);
      }
    }

    // Bushes in park (hiding spots)
    for (let i = 0; i < 4; i++) {
      const bc = this._randInt(1, this.cols - 2);
      const br = this._randInt(0, parkDepth - 1);
      const bx = bc * this.tileSize + 16;
      const by = br * this.tileSize + 16;
      if (!isOccupied(bx, by, 48, 32) && map[br * this.cols + bc] === T.TILE_GRASS) {
        colliders.push({ x: bx, y: by, w: 48, h: 32, type: 'bush' });
        map[br * this.cols + bc] = T.TILE_BUSH;
        markOccupied(bx, by, 48, 32);
      }
    }

    // === Town Containers (Dumpsters behind shops, trash cans) ===
    const containers = [];
    const townLoot = [
      { name: 'Sushi Roll', type: 'food', value: 30 },
      { name: 'Lobster Tail', type: 'food', value: 45 },
      { name: 'Smoothie', type: 'drink', value: 20 },
      { name: 'Fish Fillet', type: 'food', value: 35 },
      { name: 'Crab Cake', type: 'food', value: 28 }
    ];
    const trashLoot = [
      [{ name: 'Day-Old Sushi', type: 'food', value: 18 }, { name: 'Receipt', type: 'trash', value: 2 }],
      [{ name: 'Leftover Pasta', type: 'food', value: 22 }],
      [{ name: 'Cold Coffee', type: 'drink', value: 12 }, { name: 'Newspaper', type: 'trash', value: 5 }],
      [{ name: 'Stale Bread', type: 'food', value: 8 }]
    ];

    // Dumpsters behind shops
    colliders.filter(c => c.type === 'shop').forEach(shop => {
      containers.push({
        x: shop.x + shop.w + 10, y: shop.y + 20,
        w: 36, h: 28, type: 'trashcan', looted: false,
        contents: [...this._pick(trashLoot)]
      });
    });

    // Coolers on the pier
    for (let i = 0; i < 2; i++) {
      containers.push({
        x: this._randInt(3, this.cols - 4) * this.tileSize,
        y: (pierStart + 1) * this.tileSize,
        w: 32, h: 24, type: 'cooler', looted: false,
        content: { ...this._pick(townLoot) }
      });
    }

    // Trash cans along streets
    for (let i = 0; i < 5; i++) {
      containers.push({
        x: this._randInt(2, this.cols - 3) * this.tileSize,
        y: (mainRoadY + this._pick([-1, 2])) * this.tileSize,
        w: 28, h: 32, type: 'trashcan', looted: false,
        contents: [...this._pick(trashLoot)]
      });
    }

    // A locked harbor chest at the end of the pier — rich loot for
    // anyone who braves the lockpicking minigame
    containers.push({
      x: (this.cols - 3) * this.tileSize,
      y: (pierStart + 1) * this.tileSize,
      w: 36, h: 28, type: 'cooler', looted: false,
      locked: true, rich: true
    });

    // === Town Items ===
    const items = [];
    const townItems = [
      { name: 'Gold Watch', type: 'treasure', value: 40, emoji: '⌚' },
      { name: 'Pearl Necklace', type: 'treasure', value: 50, emoji: '📿' },
      { name: 'Fish Taco', type: 'food', value: 22, emoji: '🌮' },
      { name: 'Seashell', type: 'treasure', value: 15, emoji: '🐚' }
    ];
    for (let i = 0; i < 3; i++) {
      const def = this._pick(townItems);
      items.push({
        x: this._randInt(2, this.cols - 2) * this.tileSize,
        y: this._randInt(parkDepth, pierStart - 1) * this.tileSize,
        radius: 10, ...def
      });
    }

    // A small amount of litter scattered around town — the Sewer Rat will
    // recycle it for Bottle Caps, spendable at the Raccoon Shop.
    const trashDefs = [
      { name: 'Plastic Bottle', recycleFrame: 0 },
      { name: 'Soda Can', recycleFrame: 1 },
      { name: 'Crumpled Wrapper', recycleFrame: 2 },
      { name: 'Glass Bottle', recycleFrame: 3 },
      { name: 'Tin Can', recycleFrame: 4 },
    ];
    for (let i = 0; i < 4; i++) {
      const def = this._pick(trashDefs);
      items.push({
        x: this._randInt(2, this.cols - 2) * this.tileSize,
        y: this._randInt(parkDepth, pierStart - 1) * this.tileSize,
        radius: 10, type: 'trash', value: 0, emoji: '🗑️', ...def
      });
    }

    // === Town Decorations ===
    const decorations = [];
    // Lamp posts along streets
    for (let c = 2; c < this.cols - 1; c += 4) {
      decorations.push({ x: c * this.tileSize, y: (mainRoadY - 1) * this.tileSize + 20, type: 'lamp' });
    }
    // Flowers in park
    const flowerColors = ['#f43f5e', '#a855f7', '#f59e0b', '#ec4899'];
    for (let i = 0; i < 8; i++) {
      decorations.push({
        x: this._randInt(1, this.cols - 2) * this.tileSize + this._randInt(8, 56),
        y: this._randInt(0, parkDepth - 1) * this.tileSize + this._randInt(8, 56),
        type: 'flower', color: this._pick(flowerColors)
      });
    }
    // Rocks on pier
    for (let i = 0; i < 3; i++) {
      decorations.push({
        x: this._randInt(1, this.cols - 1) * this.tileSize,
        y: (pierStart + this._randInt(0, 1)) * this.tileSize + 20,
        type: 'rock'
      });
    }
    // Park fountain centerpiece — sits on the pool tiles, replenishes
    // hydration and marks the water source visually
    decorations.push({
      x: (fountainC + 0.5) * this.tileSize,
      y: (fountainR + 0.5) * this.tileSize,
      type: 'fountain'
    });
    // Public grill on the pier — cook your catch right off the rod
    decorations.push({
      x: Math.floor(this.cols * 0.6) * this.tileSize,
      y: (pierStart + 1) * this.tileSize + 30,
      type: 'grill'
    });

    // === Town Guards (more security!) ===
    const guardPatrols = [];
    for (let i = 0; i < this.guardCount; i++) {
      let role, points;
      if (i === 0) {
        // Park ranger
        role = 'lifeguard';
        const y = Math.floor(parkDepth / 2) * this.tileSize;
        points = [
          { x: 3 * this.tileSize, y },
          { x: (this.cols - 4) * this.tileSize, y }
        ];
      } else {
        // Street security
        role = 'security';
        const streetY = (mainRoadY + this._pick([-2, 3])) * this.tileSize;
        const x1 = this._randInt(2, Math.floor(this.cols / 2)) * this.tileSize;
        const x2 = this._randInt(Math.floor(this.cols / 2), this.cols - 3) * this.tileSize;
        points = [{ x: x1, y: streetY }, { x: x2, y: streetY }];
      }
      guardPatrols.push({ role, points });
    }

    // === Sewer Rat hangs out in an alley ===
    const rat = {
      x: 3 * this.tileSize,
      y: (mainRoadY + 3) * this.tileSize,
      radius: 20, name: 'Sewer Rat', emoji: '🐀'
    };

    // === Bus stop back to campsite ===
    const transitionPoints = [{
      x: 1 * this.tileSize,
      y: (parkDepth + 1) * this.tileSize,
      w: 96, h: 64,
      targetArea: 'campsite',
      label: '🚌 Bus to Campsite'
    }];

    return {
      cols: this.cols, rows: this.rows, tileSize: this.tileSize,
      areaType: 'town', areaName: 'Boardwalk Town',
      map, colliders, containers, items, decorations, rat,
      guardPatrols, zones, transitionPoints, seed: this.seed
    };
  }

  /**
   * Generate the Whispering Woods — a calm homestead area unlocked once
   * the player owns the Water Helmet. Dense forest with a cleared
   * homestead around the player's own cabin, and a small pond for
   * hydration. No rat (placed off-map, matching Interior.js's convention),
   * and only a single distant patrol so the area reads as genuinely safe.
   */
  _generateWoods() {
    const T = WorldGenerator;
    const map = new Array(this.rows * this.cols).fill(T.TILE_GRASS);

    // Homestead clearing: centered, roomy enough for the cabin + a future farm plot
    const homeC = Math.floor(this.cols / 2);
    const homeR = Math.floor(this.rows / 2);
    const clearRadius = 6;

    // Sunken-cabin pond: the home cabin sits right in the middle of it —
    // the pond is centered on the homestead and sized to comfortably
    // swallow the cabin footprint (roughly double the old side-pond).
    const pondC = homeC;
    const pondR = homeR;
    const pondRadius = 2;
    for (let dr = -pondRadius; dr <= pondRadius; dr++) {
      for (let dc = -pondRadius; dc <= pondRadius; dc++) {
        const rr = pondR + dr, cc = pondC + dc;
        if (rr >= 1 && rr < this.rows - 1 && cc >= 1 && cc < this.cols - 1) {
          map[rr * this.cols + cc] = T.TILE_POOL;
        }
      }
    }

    // === Zones ===
    const zones = [{
      name: 'Whispering Woods', type: 'woods',
      r: 0, c: 0, h: this.rows, w: this.cols,
      spawnX: 2 * this.tileSize, spawnY: homeR * this.tileSize
    }];

    // === Colliders: the home cabin + dense trees, clearing a homestead radius ===
    const colliders = [];
    const occupied = new Set();
    const markOccupied = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize), r1 = Math.floor(y / this.tileSize);
      const c2 = Math.ceil((x + w) / this.tileSize), r2 = Math.ceil((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) occupied.add(`${r},${c}`);
    };
    const isOccupied = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize), r1 = Math.floor(y / this.tileSize);
      const c2 = Math.ceil((x + w) / this.tileSize), r2 = Math.ceil((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (occupied.has(`${r},${c}`)) return true;
      return false;
    };
    const nearClearing = (c, r) => Math.hypot(c - homeC, r - homeR) < clearRadius;
    const decorationsPond = [];

    // Whispering Woods' cabin is deliberately lore-flooded (see Interior.js)
    // and now sits right in the middle of its pond on the overworld map too
    // — the water tiles under its footprint are intentional, not cleared.
    const cabinX = (homeC - 1) * this.tileSize - 16;
    const cabinY = (homeR - 1) * this.tileSize - 20;
    colliders.push({ x: cabinX, y: cabinY, w: 160, h: 112, type: 'homecabin', color: '#166534', variant: 3 });
    markOccupied(cabinX, cabinY, 160, 112);

    // Cozy starter farm: deliberately placed south-west of the pond/cabin so
    // the homestead reads as a usable home area instead of random wilderness.
    const farmPlots = [];
    const farmStartC = Math.max(2, homeC - 6);
    const farmStartR = Math.min(this.rows - 6, homeR + 3);
    for (let pr = 0; pr < 3; pr++) {
      for (let pc = 0; pc < 4; pc++) {
        const x = (farmStartC + pc) * this.tileSize + 10;
        const y = (farmStartR + pr) * this.tileSize + 10;
        farmPlots.push({
          id: `home-${pr}-${pc}`,
          x, y, w: 44, h: 44,
          crop: null,
          stage: 0,
          watered: false,
          plantedDay: 0
        });
      }
    }
    // Claim the whole farm grid (plus a one-tile buffer) so nothing placed
    // afterward — trees, bushes, flowers — spawns on top of the plots. The
    // farm sits just outside nearClearing's radius, so without this the
    // occupancy checks below never even considered it off-limits.
    markOccupied(
      farmStartC * this.tileSize - this.tileSize,
      farmStartR * this.tileSize - this.tileSize,
      4 * this.tileSize + 2 * this.tileSize,
      3 * this.tileSize + 2 * this.tileSize
    );

    // A few lily pads dotting the pond's edges (skip tiles under the cabin)
    const frogSpots = [];
    for (let dr = -pondRadius; dr <= pondRadius; dr++) {
      for (let dc = -pondRadius; dc <= pondRadius; dc++) {
        const rr = pondR + dr, cc = pondC + dc;
        if (rr < 1 || rr >= this.rows - 1 || cc < 1 || cc >= this.cols - 1) continue;
        if (map[rr * this.cols + cc] !== T.TILE_POOL) continue;
        if (isOccupied(cc * this.tileSize, rr * this.tileSize, 1, 1)) continue;
        if (Math.abs(dr) === pondRadius || Math.abs(dc) === pondRadius) frogSpots.push({ rr, cc });
        if (this._randInt(0, 100) < 55) continue;
        decorationsPond.push({
          x: cc * this.tileSize + this._randInt(8, 40), y: rr * this.tileSize + this._randInt(8, 40),
          type: 'lilypad', v: this._randInt(0, 1), scale: 0.8 + this._randInt(0, 6) / 10
        });
      }
    }
    for (let i = 0; i < Math.min(3, frogSpots.length); i++) {
      const spot = this._pick(frogSpots);
      decorationsPond.push({
        x: spot.cc * this.tileSize + this._randInt(12, 48),
        y: spot.rr * this.tileSize + this._randInt(12, 48),
        type: 'frog',
        v: this._randInt(0, 1),
        phase: this._rand(0, Math.PI * 2)
      });
    }

    // Dense trees everywhere except the homestead clearing and the pond
    const treeCount = Math.floor(this.cols * this.rows * 0.09);
    for (let i = 0; i < treeCount; i++) {
      const c = this._randInt(0, this.cols - 1);
      const r = this._randInt(0, this.rows - 1);
      if (nearClearing(c, r) || map[r * this.cols + c] !== T.TILE_GRASS) continue;
      const tx = c * this.tileSize + this._randInt(-10, 10);
      const ty = r * this.tileSize + this._randInt(-10, 10);
      if (!isOccupied(tx, ty, 24, 24)) {
        colliders.push({ x: tx, y: ty, w: 24, h: 24, type: 'tree', variant: this._randInt(0, 3) });
        markOccupied(tx, ty, 40, 40);
      }
    }

    // A few bushes for hiding, scattered just outside the clearing
    const bushCount = Math.max(4, Math.floor(this.cols * 0.12));
    for (let i = 0; i < bushCount; i++) {
      const c = this._randInt(1, this.cols - 2), r = this._randInt(1, this.rows - 2);
      if (nearClearing(c, r) || map[r * this.cols + c] !== T.TILE_GRASS) continue;
      const bx = c * this.tileSize + 16, by = r * this.tileSize + 16;
      if (!isOccupied(bx, by, 48, 32)) {
        colliders.push({ x: bx, y: by, w: 48, h: 32, type: 'bush', variant: this._randInt(0, 2) });
        map[r * this.cols + c] = T.TILE_BUSH;
        markOccupied(bx, by, 48, 32);
      }
    }

    // === Containers: a couple of foraged-food coolers near the clearing ===
    const forageLoot = [
      { name: 'Wild Berries', type: 'food', value: 10 },
      { name: 'Mushroom Cap', type: 'food', value: 14 },
      { name: 'Honeycomb', type: 'food', value: 18 }
    ];
    const containers = [
      {
        x: (homeC + 2) * this.tileSize, y: (homeR - 2) * this.tileSize,
        w: 32, h: 24, type: 'cooler', looted: false, content: { ...this._pick(forageLoot) }
      }
    ];

    // === Items: light forage near the farm ===
    const items = [{
      x: (farmStartC + 4.6) * this.tileSize, y: farmStartR * this.tileSize + 18,
      radius: 10, name: 'Pinecone', type: 'trash', value: 3, emoji: '🌰'
    }];

    // === Wild companions: a puppy and a kitten wandering the clearing,
    // each tameable with a different food (see Pet.js TAME_REQUIREMENTS) ===
    const wildPets = [
      { kind: 'puppy', x: homeC * this.tileSize, y: (homeR + 3) * this.tileSize },
      { kind: 'kitten', x: (homeC - 3) * this.tileSize, y: (homeR - 2) * this.tileSize },
    ];

    // === Decorations: flowers for flavor ===
    const decorations = [];
    for (let i = 0; i < 6; i++) {
      const c = this._randInt(1, this.cols - 2), r = this._randInt(1, this.rows - 2);
      if (map[r * this.cols + c] !== T.TILE_GRASS) continue;
      if (isOccupied(c * this.tileSize, r * this.tileSize, this.tileSize, this.tileSize)) continue;
      decorations.push({
        x: c * this.tileSize + this._randInt(8, 56), y: r * this.tileSize + this._randInt(8, 56),
        type: 'flower', color: this._pick(['#f43f5e', '#a855f7', '#f59e0b'])
      });
    }
    decorations.push(
      { x: (farmStartC - 0.4) * this.tileSize, y: (farmStartR + 0.2) * this.tileSize, type: 'flower', color: '#f59e0b' },
      { x: (farmStartC + 4.6) * this.tileSize, y: (farmStartR + 2.5) * this.tileSize, type: 'flower', color: '#a855f7' },
      { x: (farmStartC + 4.4) * this.tileSize, y: (farmStartR + 1.4) * this.tileSize, type: 'smallplant' },
      { x: (farmStartC + 4.85) * this.tileSize, y: (farmStartR + 0.55) * this.tileSize, type: 'homevendor' },
      { x: (homeC + 3.05) * this.tileSize, y: (homeR + 1.9) * this.tileSize, type: 'turtlecove', hidden: true },
      { x: (homeC + 3.75) * this.tileSize, y: (homeR + 2.45) * this.tileSize, type: 'shellhelpers', hidden: true }
    );
    decorations.push(...decorationsPond);

    // A single distant, short-range patrol — enough tension to keep the
    // stealth identity, not enough to make "home" feel unsafe.
    const guardPatrols = [{
      role: 'security',
      points: [
        { x: 2 * this.tileSize, y: 2 * this.tileSize },
        { x: 5 * this.tileSize, y: 3 * this.tileSize }
      ]
    }];

    // No Sewer Rat out here — off-map, matching Interior.js's convention.
    const rat = { x: -99999, y: -99999, radius: 1, name: 'Sewer Rat', emoji: '🐀' };

    // Trail back to the campsite, near the entrance edge (always free)
    const transitionPoints = [{
      x: 0, y: (homeR - 1) * this.tileSize,
      w: 64, h: 160,
      targetArea: 'campsite',
      label: '🌲 Trail back to Camp'
    }];

    return {
      cols: this.cols, rows: this.rows, tileSize: this.tileSize,
      areaType: 'woods', areaName: 'Whispering Woods',
      map, colliders, containers, items, decorations, rat,
      guardPatrols, zones, transitionPoints, seed: this.seed, wildPets, farmPlots
    };
  }

  /**
   * Phase 1: Paint base terrain — lake at top, beach transition,
   * grass interior, concrete resort strip, swamp/lake at bottom.
   * Like Zelda: water borders the overworld creating natural boundaries.
   */
  _generateTerrain() {
    const T = WorldGenerator;
    const map = new Array(this.rows * this.cols).fill(T.TILE_GRASS);

    // Top lake band (always rows 0–4 scaled to map size)
    const lakeDepth = Math.max(3, Math.floor(this.rows * 0.18));
    const beachDepth = Math.max(1, Math.floor(this.rows * 0.08));
    
    // Bottom swamp lake band
    const swampStart = this.rows - Math.max(2, Math.floor(this.rows * 0.08));

    // Concrete resort strip in the lower-middle area
    const concreteStart = Math.floor(this.rows * 0.62);
    const concreteEnd = Math.min(swampStart - 1, concreteStart + Math.max(3, Math.floor(this.rows * 0.18)));

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;

        if (r < lakeDepth) {
          map[idx] = T.TILE_LAKE;
        } else if (r < lakeDepth + beachDepth) {
          map[idx] = T.TILE_BEACH;
        } else if (r >= concreteStart && r < concreteEnd) {
          map[idx] = T.TILE_CONCRETE;
        } else if (r >= swampStart) {
          map[idx] = T.TILE_LAKE;
        }
      }
    }

    // Scatter some puddles in the grass area (like Zelda's fairy fountains — small water oases)
    const puddleCount = Math.floor(this.cols * this.rows * 0.003);
    for (let i = 0; i < puddleCount; i++) {
      const r = this._randInt(lakeDepth + beachDepth + 2, concreteStart - 2);
      const c = this._randInt(1, this.cols - 2);
      const idx = r * this.cols + c;
      if (map[idx] === T.TILE_GRASS) {
        map[idx] = T.TILE_POOL;
        // Make puddles 1-2 tiles to feel natural
        if (this._rng() > 0.5 && c + 1 < this.cols) {
          map[r * this.cols + c + 1] = T.TILE_POOL;
        }
      }
    }

    // Place a swimming pool in the concrete zone
    const poolW = Math.min(5, Math.floor(this.cols * 0.15));
    const poolH = Math.min(3, concreteEnd - concreteStart - 1);
    const poolStartC = this._randInt(Math.floor(this.cols * 0.3), Math.floor(this.cols * 0.6));
    const poolStartR = concreteStart + 1;
    for (let r = poolStartR; r < poolStartR + poolH && r < concreteEnd; r++) {
      for (let c = poolStartC; c < poolStartC + poolW && c < this.cols; c++) {
        map[r * this.cols + c] = T.TILE_POOL;
      }
    }

    return map;
  }

  /**
   * Phase 2: Identify logical zones for object placement.
   * Each zone is a named rectangular region with a biome type.
   * Think of these like Zelda's named map regions.
   */
  _placeZones(map) {
    const T = WorldGenerator;
    const lakeDepth = Math.max(3, Math.floor(this.rows * 0.18));
    const beachDepth = Math.max(1, Math.floor(this.rows * 0.08));
    const concreteStart = Math.floor(this.rows * 0.62);
    const concreteEnd = Math.min(
      this.rows - Math.max(2, Math.floor(this.rows * 0.08)) - 1,
      concreteStart + Math.max(3, Math.floor(this.rows * 0.18))
    );
    const swampStart = this.rows - Math.max(2, Math.floor(this.rows * 0.08));

    const zones = [];

    // Lake zone (spawn area)
    zones.push({
      name: 'Lake',
      type: 'lake',
      r: 0, c: 0,
      h: lakeDepth, w: this.cols,
      spawnX: Math.floor(this.cols / 2) * this.tileSize,
      spawnY: Math.floor(lakeDepth / 2) * this.tileSize
    });

    // Beach zone
    zones.push({
      name: 'Beach',
      type: 'beach',
      r: lakeDepth, c: 0,
      h: beachDepth, w: this.cols
    });

    // Grass/Forest zone — the main exploration area (like Zelda's field)
    const grassStart = lakeDepth + beachDepth;
    const grassEnd = concreteStart;
    zones.push({
      name: 'Meadow',
      type: 'grass',
      r: grassStart, c: 0,
      h: grassEnd - grassStart, w: this.cols
    });

    // Now stamp campground sub-zones within the meadow
    // These are like Zelda's villages/camps — clusters of cabins + tables
    const campCount = this.buildingCount || Math.max(1, Math.floor(this.cols / this.zoneSpacing));
    for (let i = 0; i < campCount; i++) {
      const cx = this._randInt(3, this.cols - 5);
      const cy = this._randInt(grassStart + 1, grassEnd - 3);
      zones.push({
        name: `Camp ${i + 1}`,
        type: 'camp',
        r: cy, c: cx,
        h: 3, w: 4,
        centerX: (cx + 2) * this.tileSize,
        centerY: (cy + 1) * this.tileSize
      });
    }

    // Resort/Concrete zone
    zones.push({
      name: 'Resort',
      type: 'resort',
      r: concreteStart, c: 0,
      h: concreteEnd - concreteStart, w: this.cols,
      centerX: Math.floor(this.cols / 2) * this.tileSize,
      centerY: Math.floor((concreteStart + concreteEnd) / 2) * this.tileSize
    });

    // Swamp zone (secret area — like Zelda's hidden grottos)
    zones.push({
      name: 'Swamp',
      type: 'swamp',
      r: swampStart, c: 0,
      h: this.rows - swampStart, w: this.cols
    });

    return zones;
  }

  /**
   * Phase 3: Generate colliders — cabins, trees, tables, bushes, fences.
   */
  _generateColliders(map, zones) {
    const T = WorldGenerator;
    const colliders = [];
    const occupied = new Set(); // Track occupied grid cells

    const markOccupied = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize);
      const r1 = Math.floor(y / this.tileSize);
      const c2 = Math.ceil((x + w) / this.tileSize);
      const r2 = Math.ceil((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          occupied.add(`${r},${c}`);
        }
      }
    };

    const isOccupied = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize);
      const r1 = Math.floor(y / this.tileSize);
      const c2 = Math.ceil((x + w) / this.tileSize);
      const r2 = Math.ceil((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (occupied.has(`${r},${c}`)) return true;
        }
      }
      return false;
    };

    // Dock on lake
    const dockC = this._randInt(Math.floor(this.cols * 0.25), Math.floor(this.cols * 0.75));
    const dockX = dockC * this.tileSize;
    const lakeDepth = Math.max(3, Math.floor(this.rows * 0.18));
    const dockY = (lakeDepth - 3) * this.tileSize;
    colliders.push({ x: dockX, y: dockY, w: 10, h: 128, type: 'fence', isDock: true, dockBaseX: dockX, dockBaseY: dockY });
    colliders.push({ x: dockX + 64, y: dockY, w: 10, h: 128, type: 'fence', isDock: true });
    markOccupied(dockX, dockY, 74, 128);

    // Does a building footprint overlap any water tile (lake/pool)? Buildings
    // should never spawn sitting in the lake or a puddle.
    const overlapsWater = (x, y, w, h) => {
      const c1 = Math.floor(x / this.tileSize), r1 = Math.floor(y / this.tileSize);
      const c2 = Math.floor((x + w) / this.tileSize), r2 = Math.floor((y + h) / this.tileSize);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
          const t = map[r * this.cols + c];
          if (t === T.TILE_LAKE || t === T.TILE_POOL) return true;
        }
      }
      return false;
    };

    // Place cabins at camp zones
    const campZones = zones.filter(z => z.type === 'camp');
    campZones.forEach(camp => {
      const cabinX = camp.c * this.tileSize;
      const cabinY = camp.r * this.tileSize;
      if (!isOccupied(cabinX, cabinY, 160, 112) && !overlapsWater(cabinX, cabinY, 160, 112)) {
        colliders.push({
          x: cabinX, y: cabinY,
          w: 160, h: 112,
          type: 'cabin',
          color: this._pick(['#b45309', '#92400e', '#78350f', '#7c2d12']),
          variant: this._randInt(0, 3)
        });
        markOccupied(cabinX, cabinY, 160, 112);
      }
    });

    // Place a café in the resort zone
    const resortZone = zones.find(z => z.type === 'resort');
    if (resortZone) {
      const cafeX = this._randInt(3, this.cols - 6) * this.tileSize;
      const cafeY = resortZone.r * this.tileSize;
      if (!isOccupied(cafeX, cafeY, 192, 128) && !overlapsWater(cafeX, cafeY, 192, 128)) {
        colliders.push({
          x: cafeX, y: cafeY,
          w: 192, h: 128,
          type: 'cafe',
          color: '#1e293b',
          variant: 4
        });
        markOccupied(cafeX, cafeY, 192, 128);
      }
    }

    // Picnic tables near camps — rendered as mossy log benches, so a light
    // scatter reads as "a few fallen logs near camp"; the old cols*0.2 was
    // dense enough to litter the whole meadow with them.
    const meadowZone = zones.find(z => z.type === 'grass');
    const tableCount = Math.max(2, Math.floor(this.cols * 0.05));
    for (let i = 0; i < tableCount; i++) {
      const tx = this._randInt(2, this.cols - 4) * this.tileSize;
      const ty = this._randInt(meadowZone.r + 1, meadowZone.r + meadowZone.h - 2) * this.tileSize;
      if (!isOccupied(tx, ty, 80, 48)) {
        colliders.push({ x: tx, y: ty, w: 80, h: 48, type: 'table' });
        markOccupied(tx, ty, 80, 48);
      }
    }

    // Trees — scattered throughout grass (like Zelda's Lost Woods feel)
    for (let i = 0; i < this.treeDensity; i++) {
      const tx = this._randInt(1, this.cols - 2) * this.tileSize + this._randInt(-20, 20);
      const ty = this._randInt(meadowZone.r, meadowZone.r + meadowZone.h - 1) * this.tileSize + this._randInt(-10, 10);
      if (!isOccupied(tx, ty, 24, 24)) {
        colliders.push({ x: tx, y: ty, w: 24, h: 24, type: 'tree', variant: this._randInt(0, 3) });
        markOccupied(tx, ty, 48, 48);
      }
    }

    // A few trees in resort area edges for aesthetics
    for (let i = 0; i < Math.floor(this.treeDensity * 0.3); i++) {
      const tx = this._randInt(0, this.cols - 1) * this.tileSize;
      const ty = (resortZone ? resortZone.r : this.rows - 6) * this.tileSize + this._randInt(-10, 10);
      if (!isOccupied(tx, ty, 24, 24)) {
        colliders.push({ x: tx, y: ty, w: 24, h: 24, type: 'tree', variant: this._randInt(0, 3) });
        markOccupied(tx, ty, 48, 48);
      }
    }

    // Bushes — hiding spots (like Zelda's tall grass!)
    const bushCount = Math.max(6, Math.floor(this.cols * this.rows * 0.006));
    for (let i = 0; i < bushCount; i++) {
      const br = this._randInt(meadowZone.r, meadowZone.r + meadowZone.h - 1);
      const bc = this._randInt(1, this.cols - 2);
      const bx = bc * this.tileSize + 16;
      const by = br * this.tileSize + 16;
      if (!isOccupied(bx, by, 48, 32) && map[br * this.cols + bc] === T.TILE_GRASS) {
        colliders.push({ x: bx, y: by, w: 48, h: 32, type: 'bush' });
        map[br * this.cols + bc] = T.TILE_BUSH;
        markOccupied(bx, by, 48, 32);
      }
    }

    // Short decorative fence posts along beach — leave wide gaps for free movement
    // Like Zelda: terrain changes ARE the boundaries, not invisible walls
    const beachY = (lakeDepth + 1) * this.tileSize;
    const fencePostCount = Math.max(2, Math.floor(this.cols / 10));
    for (let i = 0; i < fencePostCount; i++) {
      const fx = this._randInt(0, this.cols - 2) * this.tileSize;
      // Skip if near dock (keep dock approach clear)
      if (Math.abs(fx - dockX) < this.tileSize * 3) continue;
      // Short 2-tile fence segments with big gaps between them
      colliders.push({ x: fx, y: beachY, w: this.tileSize, h: 12, type: 'fence' });
    }

    // --- New world decor (Sprout Lands premium pack) ---
    // Water well: one decorative landmark in the meadow
    {
      const wx = this._randInt(3, this.cols - 4) * this.tileSize;
      const wy = this._randInt(meadowZone.r + 1, meadowZone.r + meadowZone.h - 2) * this.tileSize;
      if (!isOccupied(wx, wy, 32, 32)) {
        colliders.push({ x: wx, y: wy, w: 32, h: 32, type: 'well' });
        markOccupied(wx, wy, 40, 40);
      }
    }

    // Piknik set (basket + blanket), tucked into the meadow
    {
      const px = this._randInt(3, this.cols - 4) * this.tileSize;
      const py = this._randInt(meadowZone.r + 1, meadowZone.r + meadowZone.h - 2) * this.tileSize;
      if (!isOccupied(px, py, 48, 48)) {
        colliders.push({ x: px, y: py, w: 48, h: 48, type: 'piknik' });
        markOccupied(px, py, 48, 48);
      }
    }

    // Chicken house + water trough near the first camp — visually "explains"
    // where the wandering chicken critters come from. Cabins are 160px wide
    // and markOccupied rounds up to whole tiles, so the cabin's occupied
    // columns extend to camp.c+3 (160/64=2.5 → ceil 3) — offset by a full
    // 4 tiles (256px) to clear that, not just the raw 160px footprint.
    if (campZones.length) {
      const camp = campZones[0];
      const hx = camp.c * this.tileSize + 256;
      const hy = camp.r * this.tileSize;
      if (hx + 64 <= this.cols * this.tileSize &&
          !isOccupied(hx, hy, 64, 128) && !overlapsWater(hx, hy, 64, 128)) {
        colliders.push({ x: hx, y: hy, w: 64, h: 128, type: 'coop' });
        markOccupied(hx, hy, 64, 128);
        colliders.push({ x: hx + 10, y: hy + 132, w: 32, h: 16, type: 'watertray' });
        markOccupied(hx + 10, hy + 132, 32, 16);
      }
    }

    // A mailbox at each camp cluster — decorative. Offset a full tile+
    // past the cabin's left edge so tile-rounding in isOccupied doesn't
    // land it in the cabin's own occupied column (see coop comment above).
    campZones.forEach(camp => {
      const mx = camp.c * this.tileSize - 80;
      const my = camp.r * this.tileSize + 40;
      if (mx >= 0 && !isOccupied(mx, my, 14, 22)) {
        colliders.push({ x: mx, y: my, w: 14, h: 22, type: 'mailbox' });
        markOccupied(mx, my, 14, 22);
      }
    });

    // A rowboat moored near the dock
    colliders.push({ x: dockX - 60, y: dockY + 100, w: 48, h: 40, type: 'boat' });

    // Signs labeling the resort entrance
    if (resortZone) {
      colliders.push({ x: 2 * this.tileSize, y: resortZone.r * this.tileSize, w: 16, h: 16, type: 'sign', label: resortZone.name });
    }

    return colliders;
  }

  /**
   * Phase 4: Place interactive containers (coolers, trash cans)
   * near camps and in the resort — like Zelda's breakable pots!
   */
  _generateContainers(zones) {
    const containers = [];
    const foodItems = [
      { name: 'Hot Dog', type: 'food', value: 12 },
      { name: 'Burger', type: 'food', value: 25 },
      { name: 'Sandwich', type: 'food', value: 18 },
      { name: 'Pizza Slice', type: 'food', value: 20 },
      { name: 'Fish Taco', type: 'food', value: 22 }
    ];

    const trashLoot = [
      [{ name: 'Soggy Fries', type: 'food', value: 8 }, { name: 'Empty Soda Can', type: 'trash', value: 3 }],
      [{ name: 'Half-Eaten Donut', type: 'food', value: 10 }, { name: 'Glow Ring', type: 'trash', value: 15 }],
      [{ name: 'Cold Ice Cream', type: 'food', value: 16 }],
      [{ name: 'Fresh Soda', type: 'drink', value: 10 }],
      [{ name: 'Apple Core', type: 'food', value: 5 }, { name: 'Shiny Wrapper', type: 'trash', value: 7 }]
    ];

    // Place coolers near camp zones
    const campZones = zones.filter(z => z.type === 'camp');
    campZones.forEach(camp => {
      const cx = camp.centerX || (camp.c + 2) * this.tileSize;
      const cy = camp.centerY || (camp.r + 1) * this.tileSize;
      containers.push({
        x: cx + this._randInt(40, 80),
        y: cy + this._randInt(20, 60),
        w: 32, h: 24,
        type: 'cooler',
        looted: false,
        content: { ...this._pick(foodItems) }
      });
    });

    // Extra coolers in resort
    const resortZone = zones.find(z => z.type === 'resort');
    if (resortZone) {
      for (let i = 0; i < 2; i++) {
        containers.push({
          x: this._randInt(3, this.cols - 3) * this.tileSize,
          y: (resortZone.r + 1) * this.tileSize + this._randInt(20, 60),
          w: 32, h: 24,
          type: 'cooler',
          looted: false,
          content: { ...this._pick(foodItems) }
        });
      }
    }

    // Trash cans scattered in grass and resort
    const trashCount = Math.max(3, Math.floor((this.cols + this.rows) * 0.12));
    const meadowZone = zones.find(z => z.type === 'grass');
    for (let i = 0; i < trashCount; i++) {
      const inResort = this._rng() > 0.5 && resortZone;
      const zone = inResort ? resortZone : meadowZone;
      if (!zone) continue;
      containers.push({
        x: this._randInt(2, this.cols - 3) * this.tileSize,
        y: (zone.r + this._randInt(1, zone.h - 1)) * this.tileSize,
        w: 28, h: 32,
        type: 'trashcan',
        looted: false,
        contents: [...this._pick(trashLoot)]
      });
    }

    return containers;
  }

  /**
   * Phase 5: Scatter ground items — like Zelda's rupees in the grass
   */
  _generateItems(zones) {
    const items = [];
    const itemDefs = [
      { name: 'Watermelon Slice', type: 'food', value: 15, emoji: '🍉' },
      { name: 'Soda Pop', type: 'drink', value: 8, emoji: '🥤' },
      { name: 'Pretzel', type: 'food', value: 12, emoji: '🥨' },
      { name: 'Corn Dog', type: 'food', value: 14, emoji: '🌽' },
      { name: 'Cookie', type: 'food', value: 10, emoji: '🍪' }
    ];

    const meadowZone = zones.find(z => z.type === 'grass');
    if (!meadowZone) return items;

    const count = Math.max(2, Math.floor(this.cols * 0.12));
    for (let i = 0; i < count; i++) {
      const def = this._pick(itemDefs);
      items.push({
        x: this._randInt(2, this.cols - 2) * this.tileSize + this._randInt(-20, 20),
        y: (meadowZone.r + this._randInt(1, meadowZone.h - 2)) * this.tileSize + this._randInt(-10, 10),
        radius: 10,
        ...def
      });
    }

    return items;
  }

  /**
   * Phase 6: Decorations — flowers, rocks, lamp posts.
   * Purely visual, no collision. Makes the world feel alive.
   */
  _generateDecorations(map, colliders, zones) {
    const T = WorldGenerator;
    const decorations = [];
    const flowerColors = ['#f43f5e', '#a855f7', '#f59e0b', '#ec4899', '#8b5cf6'];

    // Flowers on grass tiles
    const flowerCount = Math.floor(this.cols * this.rows * 0.008);
    for (let i = 0; i < flowerCount; i++) {
      const r = this._randInt(4, this.rows - 3);
      const c = this._randInt(0, this.cols - 1);
      if (map[r * this.cols + c] === T.TILE_GRASS) {
        decorations.push({
          x: c * this.tileSize + this._randInt(8, 56),
          y: r * this.tileSize + this._randInt(8, 56),
          type: 'flower',
          color: this._pick(flowerColors)
        });
      }
    }

    // Rocks on beach
    const rockCount = Math.max(3, Math.floor(this.cols * 0.15));
    const lakeDepth = Math.max(3, Math.floor(this.rows * 0.18));
    const beachDepth = Math.max(1, Math.floor(this.rows * 0.08));
    for (let i = 0; i < rockCount; i++) {
      decorations.push({
        x: this._randInt(1, this.cols - 1) * this.tileSize + this._randInt(0, 40),
        y: (lakeDepth + this._randInt(0, beachDepth - 1)) * this.tileSize + this._randInt(10, 50),
        type: 'rock'
      });
    }

    // Raccoon's den — tucked into the meadow, hiding out in nature rather
    // than running a proper storefront. One per map, away from buildings.
    const meadowZone = zones.find(z => z.type === 'grass');
    if (meadowZone) {
      decorations.push({
        x: this._randInt(2, this.cols - 3) * this.tileSize + 32,
        y: (meadowZone.r + this._randInt(1, Math.max(1, meadowZone.h - 2))) * this.tileSize + 32,
        type: 'raccoonden',
      });
    }

    // Lamp posts along concrete
    const concreteStart = Math.floor(this.rows * 0.62);
    const lampCount = Math.max(3, Math.floor(this.cols * 0.15));
    const lampSpacing = Math.floor(this.cols / lampCount);
    for (let i = 0; i < lampCount; i++) {
      decorations.push({
        x: (i * lampSpacing + 2) * this.tileSize,
        y: concreteStart * this.tileSize + this._randInt(10, 30),
        type: 'lamp'
      });
    }

    return decorations;
  }

  /**
   * Phase 7: Generate guard patrol routes.
   * Returns arrays of patrol points for NPC construction.
   */
  _generateGuardPatrols(zones) {
    const patrols = [];
    const meadowZone = zones.find(z => z.type === 'grass');
    const resortZone = zones.find(z => z.type === 'resort');
    const beachZone = zones.find(z => z.type === 'beach');

    for (let i = 0; i < this.guardCount; i++) {
      let role, points;

      if (i === 0 && beachZone) {
        // First guard: beach patrol lifeguard
        role = 'lifeguard';
        const y = (beachZone.r + 1) * this.tileSize;
        points = [
          { x: 3 * this.tileSize, y },
          { x: Math.floor(this.cols / 2) * this.tileSize, y },
          { x: (this.cols - 4) * this.tileSize, y }
        ];
      } else if (i === 1 && resortZone) {
        // Second guard: pool/resort patrol
        role = 'lifeguard';
        const y1 = resortZone.r * this.tileSize + 40;
        const y2 = (resortZone.r + resortZone.h - 1) * this.tileSize;
        const x1 = Math.floor(this.cols * 0.3) * this.tileSize;
        const x2 = Math.floor(this.cols * 0.7) * this.tileSize;
        points = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
      } else if (meadowZone) {
        // Remaining guards: security patrols in the meadow
        role = 'security';
        const cx = this._randInt(3, this.cols - 4) * this.tileSize;
        const cy = (meadowZone.r + this._randInt(1, meadowZone.h - 2)) * this.tileSize;
        const range = this._randInt(3, 6) * this.tileSize;
        points = [
          { x: cx - range, y: cy - range * 0.5 },
          { x: cx + range, y: cy - range * 0.5 },
          { x: cx + range, y: cy + range * 0.5 },
          { x: cx - range, y: cy + range * 0.5 }
        ];
      } else {
        role = 'security';
        points = [{ x: 200, y: 400 }, { x: 600, y: 400 }];
      }

      patrols.push({ role, points });
    }

    return patrols;
  }

  /**
   * Phase 8: Place the Sewer Rat — always near the swamp edge (secret area).
   * Like Zelda's hidden merchants in caves.
   */
  _placeRat(map) {
    const swampStart = this.rows - Math.max(2, Math.floor(this.rows * 0.08));
    return {
      x: this._randInt(2, 6) * this.tileSize,
      y: (swampStart - 1) * this.tileSize,
      radius: 20,
      name: 'Sewer Rat',
      emoji: '🐀'
    };
  }
}
