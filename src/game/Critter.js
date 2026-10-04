/**
 * Critter — ambient wildlife (chickens, cows) that wander the resort's
 * grass, peck/graze, and scatter when the player gets close. Pure
 * atmosphere: no gameplay effect, they just make the world feel alive.
 */
import {
  Sprites, spriteReady,
  CHICKEN_IDLE, CHICKEN_WALK, COW_WALK, COW_GRAZE,
  FANTASY_CRITTER_IDLE, FANTASY_CRITTER_WALK,
  CHICKEN_SHEETS, CHICKEN_BABY_SHEETS, COW_SHEETS, COW_BABY_SHEETS,
  CRITTER_SHEETS, CHICKEN_COLORS, COW_COLORS,
} from './AssetLoader.js';

const CRITTER_TRAITS = {
  chicken: { speed: 45, fleeSpeed: 130, size: 40, cell: 16 },
  cow: { speed: 28, fleeSpeed: 70, size: 72, cell: 32 },
  pig: { speed: 38, fleeSpeed: 95, size: 44, cell: 32 },
  sheep: { speed: 32, fleeSpeed: 82, size: 48, cell: 32 },
};

export class Critter {
  /**
   * @param {'chicken'|'cow'|'pig'|'sheep'} kind
   * @param {number} x @param {number} y - spawn position (world px)
   * @param {object} [opts]
   * @param {string} [opts.color] - premium color variant (see CHICKEN_COLORS/COW_COLORS)
   * @param {boolean} [opts.baby] - draws smaller using the baby sprite sheet
   */
  constructor(kind, x, y, opts = {}) {
    this.kind = kind;
    this.color = opts.color || 'default';
    this.baby = !!opts.baby;
    this.x = x; this.y = y;
    this.homeX = x; this.homeY = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left (sheets face left natively)
    this.state = 'idle'; // 'idle' | 'walk' | 'graze' | 'flee'
    this.stateTimer = 1 + Math.random() * 2;
    this.animTime = Math.random() * 10;
    const traits = CRITTER_TRAITS[kind] || CRITTER_TRAITS.chicken;
    this.speed = traits.speed * (this.baby ? 0.8 : 1);
    this.fleeSpeed = traits.fleeSpeed * (this.baby ? 0.85 : 1);
    this.size = traits.size * (this.baby ? 0.65 : 1); // draw size (px)
    this.wanderRadius = 260;
    this.leashed = false;
  }

  update(dt, player, world) {
    this.animTime += dt;
    this.stateTimer -= dt;

    // Leashed critters ignore normal wander/flee AI and just trail the player
    if (this.leashed) {
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      const followDist = 46;
      if (d > followDist) {
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        const speed = this.fleeSpeed * 0.7;
        const nx = this.x + Math.cos(a) * speed * dt;
        const ny = this.y + Math.sin(a) * speed * dt;
        const resolved = world.checkCollisions(nx, ny, 10);
        this.x = resolved.x; this.y = resolved.y;
        this.state = 'walk';
        this.facing = Math.cos(a) >= 0 ? 1 : -1;
      } else {
        this.state = 'idle';
      }
      return;
    }

    // Scatter if the player rushes in
    const pd = Math.hypot(player.x - this.x, player.y - this.y);
    if (pd < 70 && !player.isHiding) {
      if (this.state !== 'flee') {
        this.state = 'flee';
        this.stateTimer = 0.8;
        // Startled chickens sometimes shed a feather (crafting material)
        if (this.kind === 'chicken' && Math.random() < 0.25) {
          this.featherDrop = { x: this.x, y: this.y };
        }
      }
      const a = Math.atan2(this.y - player.y, this.x - player.x);
      this.vx = Math.cos(a) * this.fleeSpeed;
      this.vy = Math.sin(a) * this.fleeSpeed;
    } else if (this.state === 'flee' && this.stateTimer <= 0) {
      this.state = 'idle';
      this.stateTimer = 1 + Math.random() * 2;
    }

    // Cycle idle -> walk -> graze on a lazy timer
    if (this.state !== 'flee' && this.stateTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.4) {
        this.state = 'walk';
        this.stateTimer = 1 + Math.random() * 2.5;
        // Head somewhere near home so flocks don't drift across the map
        const a = Math.atan2(this.homeY - this.y, this.homeX - this.x) +
                  (Math.random() - 0.5) * (pd > this.wanderRadius ? 0.6 : Math.PI * 2);
        this.vx = Math.cos(a) * this.speed;
        this.vy = Math.sin(a) * this.speed;
      } else if (roll < 0.7) {
        this.state = 'graze';
        this.stateTimer = 1.5 + Math.random() * 2;
        this.vx = this.vy = 0;
      } else {
        this.state = 'idle';
        this.stateTimer = 1 + Math.random() * 2;
        this.vx = this.vy = 0;
      }
    }

    if (this.state === 'walk' || this.state === 'flee') {
      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;
      // Stay on grass and out of water/buildings
      const tile = world.getTileAt(nx, ny);
      const walkable = tile === world.TILE_GRASS || tile === world.TILE_BUSH || tile === world.TILE_BEACH;
      if (walkable) {
        const resolved = world.checkCollisions(nx, ny, 10);
        this.x = resolved.x; this.y = resolved.y;
      } else {
        // Bounce back toward home
        this.vx = -this.vx; this.vy = -this.vy;
        this.stateTimer = Math.min(this.stateTimer, 0.4);
      }
      if (Math.abs(this.vx) > 1) this.facing = this.vx > 0 ? 1 : -1;
    }
  }

  draw(ctx) {
    const isChicken = this.kind === 'chicken';
    const isCow = this.kind === 'cow';
    const sheets = this.baby
      ? (isChicken ? CHICKEN_BABY_SHEETS : COW_BABY_SHEETS)
      : (isChicken ? CHICKEN_SHEETS : COW_SHEETS);
    const sheet = (isChicken || isCow)
      ? (sheets[this.color] || (isChicken ? Sprites.chicken : Sprites.cow))
      : CRITTER_SHEETS[this.kind];
    const cell = CRITTER_TRAITS[this.kind]?.cell || 32;
    if (!spriteReady(sheet)) return;

    let frames;
    if (this.kind === 'chicken') {
      frames = (this.state === 'walk' || this.state === 'flee') ? CHICKEN_WALK : CHICKEN_IDLE;
    } else if (this.kind === 'cow') {
      frames = this.state === 'graze' ? COW_GRAZE : COW_WALK;
    } else {
      frames = (this.state === 'walk' || this.state === 'flee') ? FANTASY_CRITTER_WALK : FANTASY_CRITTER_IDLE;
    }
    const rate = this.state === 'flee' ? 12 : (this.state === 'walk' ? 7 : 3);
    const f = frames[Math.floor(this.animTime * rate) % frames.length];

    // Ground shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, this.size * 0.3, this.size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1); // sheets face right natively; flip for left
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, f.sx, f.sy, cell, cell,
      -this.size / 2, -this.size + 10, this.size, this.size);
    ctx.restore();
  }
}

/**
 * Spawn a small flock of critters on random grass tiles.
 * @returns {Critter[]}
 */
export function spawnCritters(world, chickens = 5, cows = 2, pigs = 0, sheep = 0) {
  const critters = [];
  // Keep spawns off the home farm plots (Whispering Woods) — otherwise a
  // chicken or cow can land right on top of a planted square.
  const onFarmPlot = (c, r) => {
    if (!world.farmPlots?.length) return false;
    const px = c * world.tileSize, py = r * world.tileSize;
    return world.farmPlots.some(p =>
      px + world.tileSize > p.x && px < p.x + p.w &&
      py + world.tileSize > p.y && py < p.y + p.h
    );
  };
  const grassTiles = [];
  for (let r = 2; r < world.rows - 2; r++) {
    for (let c = 2; c < world.cols - 2; c++) {
      if (world.map[r * world.cols + c] === world.TILE_GRASS && !onFarmPlot(c, r)) grassTiles.push([c, r]);
    }
  }
  if (!grassTiles.length) return critters;
  // ~12% chance any given spawn is a smaller baby variant of its color
  const BABY_CHANCE = 0.12;
  const place = (kind) => {
    const [c, r] = grassTiles[Math.floor(Math.random() * grassTiles.length)];
    const colors = kind === 'chicken' ? CHICKEN_COLORS : (kind === 'cow' ? COW_COLORS : ['default']);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const baby = kind === 'cow'
      ? (color !== 'default' && Math.random() < BABY_CHANCE)
      : ((kind === 'chicken') && Math.random() < BABY_CHANCE);
    critters.push(new Critter(kind,
      c * world.tileSize + world.tileSize / 2,
      r * world.tileSize + world.tileSize / 2,
      { color, baby }));
  };
  for (let i = 0; i < chickens; i++) place('chicken');
  for (let i = 0; i < cows; i++) place('cow');
  for (let i = 0; i < pigs; i++) place('pig');
  for (let i = 0; i < sheep; i++) place('sheep');
  return critters;
}
