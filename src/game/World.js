/**
 * World class represents the game map and environment.
 * Accepts procedurally generated data from WorldGenerator,
 * or falls back to defaults for backward compatibility.
 * 
 * Handles tile queries, collision resolution, ground rendering,
 * and exposes 2.5D sortable entities for depth-sorted drawing.
 */
import { WorldGenerator } from './WorldGenerator.js';
import { fishSpriteIndex } from './Fishing.js';
import {
  Sprites, spriteReady, TREE_SPRITE, BUSH_SPRITE,
  CABIN_SPRITE, CAFE_SPRITE, HUT_SPRITES, SHOP_SPRITE,
  CONTAINER_CLOSED_SPRITE, CONTAINER_OPEN_SPRITE, FENCE_SPRITE,
  GRASS_TILE, DIRT_TILE, WATER_FRAMES,
  LOG_BENCH_SPRITE, ROCK_SPRITE, LILY_SPRITES, MUSHROOM_SPRITES, SUNFLOWER_SPRITE,
  PREMIUM_TREE_SPRITES, PREMIUM_BUSH_SPRITES, PREMIUM_GROUND_SPRITES,
  FROG_IDLE, FROG_JUMP, FISH_ICON_SPRITES, BIG_FISH_SWIM_FRAMES,
  BED_SPRITE, RUG_SPRITES, POTTED_PLANTS, getCharacterSheet, CHAR_CELL, RECYCLE_SPRITES,
  CABIN_FLOOR_TILE, CABIN_WALL_TILE, CAFE_FLOOR_TILE, CAFE_WALL_TILE,
  HOME_BED_SPRITE, WARDROBE_SPRITE, PETBED_SPRITE, COUNTER_SPRITE, WORKSTATION_SPRITE,
  CLOCK_SPRITE, DOGBONE_SPRITE, SMALL_PLANT_SPRITE,
  FRUIT_TREE_SHEETS, FRUIT_TREE_SPRITE,
  SIGN_SPRITE, BOAT_SPRITE, COOP_SPRITE, WATER_TRAY_SPRITE, MAILBOX_SPRITE,
  CROP_TYPES,
  FURNITURE, RUG_PIECES, CAT_TOWER_SPRITE, PET_PROPS_SPRITE,
} from './AssetLoader.js';

/** Resolve the sheet a catalog furniture piece draws from, honoring room palette. */
function furnitureSheet(piece, roomStyle) {
  if (piece.src === 'basic') return Sprites.furniture;
  if (piece.src === 'modern') return Sprites.modernInteriors;
  return roomStyle === 'cool' ? Sprites.furnitureCool : Sprites.furnitureWarm;
}

/** Collision footprints for decorative objects that are drawn separately. */
export function decorationCollider(d) {
  if (d.type === 'furniture') {
    const piece = FURNITURE[d.piece];
    if (!piece || piece.wall) return null;
    const dw = piece.drawW;
    const dh = dw * (piece.sh / piece.sw);
    const w = Math.max(18, dw * 0.68);
    const h = Math.max(12, Math.min(28, dh * 0.45));
    return { x: d.x - w / 2, y: d.y - h, w, h };
  }
  if (d.type === 'wardrobe') return { x: d.x - 18, y: d.y + 4, w: 36, h: 28 };
  if (d.type === 'workbench') return { x: d.x - 24, y: d.y - 6, w: 48, h: 26 };
  if (d.type === 'petbed') return { x: d.x - 24, y: d.y - 4, w: 48, h: 22 };
  if (d.type === 'homepump') return { x: d.x - 18, y: d.y - 18, w: 36, h: 28 };
  if (d.type === 'cattree') return { x: d.x - 24, y: d.y - 58, w: 48, h: 60 };
  if (d.type === 'turtlecove') return { x: d.x - 30, y: d.y - 12, w: 60, h: 24 };
  if (d.type === 'shellhelpers') return { x: d.x - 30, y: d.y - 26, w: 60, h: 34 };
  if (d.type === 'computer') return { x: d.x - 34, y: d.y - 26, w: 68, h: 34 };
  if (d.type === 'shopDisplay') return { x: d.x - (d.w || 70) / 2, y: d.y - (d.h || 54) + 8, w: d.w || 70, h: Math.max(20, (d.h || 54) - 10) };
  if (d.type === 'potted') return { x: d.x - 14, y: d.y - 20, w: 28, h: 24 };
  if (d.type === 'smallplant') return { x: d.x - 10, y: d.y - 16, w: 20, h: 18 };
  return null;
}

/** Draw a sprite crop scaled to a target width, preserving aspect ratio, bottom-anchored at (anchorX, anchorBottomY). */
function drawBottomAnchoredSprite(ctx, img, crop, anchorX, anchorBottomY, destW) {
  const destH = destW * (crop.sh / crop.sw);
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, anchorX - destW / 2, anchorBottomY - destH, destW, destH);
}

function drawBabyTurtle(ctx, x, y, scale = 1, shell = '#16a34a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath(); ctx.ellipse(0, 7, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#86efac';
  [[-10, 2], [10, 2], [-7, 10], [7, 10]].forEach(([ox, oy]) => {
    ctx.beginPath(); ctx.ellipse(ox, oy, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath(); ctx.ellipse(0, 2, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(5, 46, 22, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(7, 5); ctx.moveTo(7, -1); ctx.lineTo(-7, 5); ctx.stroke();
  ctx.fillStyle = '#052e16';
  ctx.beginPath(); ctx.arc(-2, -10, 1, 0, Math.PI * 2); ctx.arc(2, -10, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Tile-built Sprout Lands exterior with small per-building variations. */
function drawSproutBuilding(ctx, box) {
  const x = box.x;
  const bottom = box.y + box.h;
  const w = box.w;
  const isCafe = box.type === 'cafe';
  const isHome = box.type === 'homecabin';
  const variant = box.variant || 0;
  const crop = (box.type === 'cabin' || box.type === 'homecabin') ? CABIN_SPRITE : CAFE_SPRITE;
  const scale = w / crop.sw;
  const spriteH = crop.sh * scale;
  const y = bottom - spriteH;
  const cx = x + w / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, bottom + 8, w * 0.46, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (spriteReady(Sprites.house)) {
    ctx.drawImage(Sprites.house, crop.sx, crop.sy, crop.sw, crop.sh, x, y, w, spriteH);
  } else {
    ctx.fillStyle = box.color;
    ctx.fillRect(x, y, w, spriteH);
  }

  if (isCafe) {
    const awningY = y + spriteH * 0.47;
    const awningH = 18;
    const awningX = x + 18;
    const awningW = w - 36;
    ctx.fillStyle = variant % 2 === 0 ? '#86b86b' : '#94c973';
    ctx.fillRect(awningX, awningY, awningW, awningH);
    ctx.fillStyle = '#cf8e73';
    for (let px = awningX + 4; px < awningX + awningW - 4; px += 18) {
      ctx.fillRect(px, awningY + 2, 8, awningH - 4);
    }
    ctx.strokeStyle = '#6f8450';
    ctx.lineWidth = 2;
    ctx.strokeRect(awningX, awningY, awningW, awningH);

    const signW = Math.min(w - 60, 112);
    const signH = 30;
    const signX = x + 26;
    const signY = y + 14;
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(signX, signY, signW, signH);
    ctx.strokeStyle = '#7c3f1d';
    ctx.lineWidth = 3;
    ctx.strokeRect(signX, signY, signW, signH);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.fillText('RESORT', signX + signW / 2, signY + 9);
    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.fillText('CAFE', signX + signW / 2, signY + 22);
  }

  if (isHome) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', cx, y - 8);
  }

  ctx.restore();
}

/** Foreground water treatment for the sunken home cabin. */
function drawHomeCabinSubmersion(ctx, box) {
  const waterY = box.y + box.h * 0.56;
  const bottomY = box.y + box.h;
  const surfaceLeft = box.x - 42;
  const surfaceRight = box.x + box.w + 42;
  const t = Date.now() / 520;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // First tint only the part of the cabin that is below the surface. This
  // keeps the upper walls/roof crisp while the lower walls read as underwater.
  ctx.beginPath();
  ctx.rect(box.x, waterY - 1, box.w, bottomY - waterY + 14);
  ctx.clip();
  const submergedGrad = ctx.createLinearGradient(0, waterY, 0, bottomY + 18);
  submergedGrad.addColorStop(0, 'rgba(56, 189, 248, 0.26)');
  submergedGrad.addColorStop(0.55, 'rgba(14, 116, 144, 0.42)');
  submergedGrad.addColorStop(1, 'rgba(8, 47, 73, 0.58)');
  ctx.fillStyle = submergedGrad;
  ctx.fillRect(box.x, waterY - 1, box.w, bottomY - waterY + 18);
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Then draw the pond surface in front of the cabin as a soft, uneven lens.
  // Avoiding a rectangular wash is what makes the water feel like part of the
  // pond instead of a UI overlay.
  ctx.beginPath();
  ctx.moveTo(surfaceLeft, waterY + 3);
  for (let x = surfaceLeft; x <= surfaceRight; x += 10) {
    const y = waterY + Math.sin(t + x * 0.07) * 2.4 + Math.sin(t * 0.7 + x * 0.025) * 1.2;
    ctx.lineTo(x, y);
  }
  ctx.bezierCurveTo(surfaceRight - 10, bottomY + 44, surfaceLeft + 10, bottomY + 44, surfaceLeft, waterY + 3);
  ctx.closePath();

  const surfaceGrad = ctx.createLinearGradient(0, waterY, 0, bottomY + 40);
  surfaceGrad.addColorStop(0, 'rgba(125, 211, 252, 0.38)');
  surfaceGrad.addColorStop(0.45, 'rgba(14, 165, 233, 0.34)');
  surfaceGrad.addColorStop(1, 'rgba(3, 105, 161, 0.2)');
  ctx.fillStyle = surfaceGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(224, 242, 254, 0.82)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = surfaceLeft + 4; x <= surfaceRight - 4; x += 8) {
    const y = waterY + Math.sin(t + x * 0.07) * 2.4;
    if (x === surfaceLeft + 4) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Small moving highlights and bubbles sell depth without hiding the sprite.
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const px = box.x + 18 + i * 30 + Math.sin(t + i) * 5;
    const py = waterY + 16 + ((i * 13 + t * 10) % 34);
    ctx.beginPath();
    ctx.moveTo(px - 8, py);
    ctx.quadraticCurveTo(px, py - 2, px + 12, py);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.12 + i * 0.19) % 1;
    const bx = box.x + 24 + i * 22 + Math.sin(t + i * 1.7) * 4;
    const by = bottomY + 8 - p * 48;
    ctx.beginPath();
    ctx.arc(bx, by, i % 2 ? 1.8 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export class World {
  constructor(generatedData = null) {
    // If no generated data, create a default world
    if (!generatedData) {
      const gen = new WorldGenerator({ cols: 32, rows: 24 });
      generatedData = gen.generate();
    }

    this.tileSize = generatedData.tileSize || 64;
    this.cols = generatedData.cols;
    this.rows = generatedData.rows;
    this.width = this.cols * this.tileSize;
    this.height = this.rows * this.tileSize;
    this.seed = generatedData.seed || 0;
    this.areaType = generatedData.areaType || 'campsite';
    this.areaName = generatedData.areaName || 'Resort Campsite';

    // Tile type constants
    this.TILE_LAKE = 0;
    this.TILE_BEACH = 1;
    this.TILE_GRASS = 2;
    this.TILE_CONCRETE = 3;
    this.TILE_POOL = 4;
    this.TILE_BUSH = 5;
    this.TILE_ROAD = 6;
    this.TILE_SIDEWALK = 7;
    this.TILE_FLOOR = 8; // interior wooden floor

    // Interior-only data
    this.isInterior = !!generatedData.isInterior;
    this.isFlooded = !!generatedData.isFlooded; // sunken flooded cabin
    this.isHomeCabin = !!generatedData.isHomeCabin;
    this.isTownShop = !!generatedData.isTownShop;
    this.shopKind = generatedData.shopKind || null;
    this.hasComputer = !!generatedData.hasComputer;
    this.roomStyle = generatedData.roomStyle || 'warm'; // 'warm' (cabin) | 'cool' (cafe) furniture palette
    this.wildPets = generatedData.wildPets || []; // { kind, x, y } spawn descriptors
    this.rugs = generatedData.rugs || [];
    this.camper = generatedData.camper || null;
    this.staffPatrols = generatedData.staffPatrols || [];

    // Accept generated data
    this.map = generatedData.map;
    this.containers = generatedData.containers;
    this.items = generatedData.items;
    this.decorations = generatedData.decorations;
    this.farmPlots = generatedData.farmPlots || [];
    this.colliders = generatedData.colliders.slice();
    if (this.isInterior) {
      this.decorations.forEach((d) => {
        const box = decorationCollider(d);
        if (box) this.colliders.push({ ...box, type: 'decorBlock', collisionOnly: true, homeId: d.homeId });
      });
      this.containers.forEach((c) => {
        this.colliders.push({
          x: c.x + 4,
          y: c.y + Math.max(6, c.h * 0.35),
          w: Math.max(8, c.w - 8),
          h: Math.max(10, c.h * 0.55),
          type: 'containerBlock',
          collisionOnly: true
        });
      });
    }
    this.rat = generatedData.rat;
    this.zones = generatedData.zones || [];
    this.transitionPoints = generatedData.transitionPoints || [];

    // Cache dock info for ground rendering
    this._dock = this.colliders.find(c => c.isDock) || null;

    // Ambient decor derived deterministically from tile positions:
    // mushrooms/sunflowers on grass, lily pads drifting on the lake.
    this.ambient = [];
    this.lilyPads = [];
    this.rareFish = [];
    const ts = this.tileSize;
    const lakeCandidates = [];
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        const type = this.map[r * this.cols + c];
        const h = ((r * 73856093) ^ (c * 19349663) ^ (this.seed * 83492791)) >>> 0;
        const ox = ts / 2 + ((h >> 8) % 28) - 14;
        const oy = ts / 2 + ((h >> 12) % 28) - 14;
        if (type === this.TILE_GRASS) {
          if (h % 41 === 0) {
            this.ambient.push({ kind: 'mushroom', v: h % 2, x: c * ts + ox, y: r * ts + oy });
          } else if (h % 59 === 0) {
            this.ambient.push({ kind: 'sunflower', x: c * ts + ox, y: r * ts + oy });
          } else if (this.areaType === 'woods' && h % 83 === 0) {
            this.ambient.push({ kind: 'forestClutter', v: h % PREMIUM_GROUND_SPRITES.length, x: c * ts + ox, y: r * ts + oy });
          }
        } else if (type === this.TILE_LAKE && h % 19 === 0 && !generatedData.isUnderwaterZone) {
          this.lilyPads.push({ v: h % 2, x: c * ts + ox, y: r * ts + oy, phase: (h % 100) / 16 });
          if (this.areaType === 'campsite' && h % 97 === 0) {
            lakeCandidates.push({ x: c * ts + ts / 2, y: r * ts + ts / 2, phase: (h % 100) / 9, dir: (h & 1) ? 1 : -1 });
          }
        }
      }
    }
    if (this.areaType === 'campsite' && lakeCandidates.length && (this.seed % 5 === 0)) {
      this.rareFish.push(lakeCandidates[Math.abs(this.seed) % lakeCandidates.length]);
    }

  }

  /**
   * Draw a minimap onto the given canvas context.
   * Shows the full map, player position, guard positions, and zone colors.
   */
  drawMinimap(ctx, mapW, mapH, playerX, playerY, guards, options = {}) {
    const scaleX = mapW / this.width;
    const scaleY = mapH / this.height;

    const tileColors = {
      0: '#0284c7', 1: '#fef08a', 2: '#22c55e',
      3: '#94a3b8', 4: '#06b6d4', 5: '#22c55e',
      6: '#374151', 7: '#d1d5db'
    };

    // Draw tiles
    const pixW = Math.ceil(this.tileSize * scaleX) + 1;
    const pixH = Math.ceil(this.tileSize * scaleY) + 1;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = this.map[r * this.cols + c];
        ctx.fillStyle = tileColors[type] || '#22c55e';
        ctx.fillRect(c * this.tileSize * scaleX, r * this.tileSize * scaleY, pixW, pixH);
      }
    }

    // Draw colliders as dark marks (cabins, café, shops)
    this.colliders.forEach(box => {
      if (box.collisionOnly) return;
      if (box.type === 'cabin' || box.type === 'cafe' || box.type === 'shop' || box.type === 'homecabin') {
        const bx = box.x * scaleX, by = box.y * scaleY;
        ctx.fillStyle = box.type === 'shop' ? '#4f46e5' : box.type === 'homecabin' ? '#4ade80' : '#78350f';
        ctx.fillRect(bx, by, box.w * scaleX, box.h * scaleY);
      }
    });

    // Draw guards as red dots
    if (guards) {
      guards.forEach(g => {
        ctx.fillStyle = g.state === 'chase' ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(g.x * scaleX, g.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const markers = options.landmarks || this.getLandmarks();
    markers.forEach(marker => {
      const x = marker.x * scaleX;
      const y = marker.y * scaleY;
      ctx.fillStyle = marker.color || '#f8fafc';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 7px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.short || '?', x, y + 0.5);
    });

    // Draw player as a bright cyan dot (always visible)
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(playerX * scaleX, playerY * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
    // Pulsing glow
    ctx.fillStyle = `rgba(34, 211, 238, ${0.3 + Math.sin(Date.now() / 300) * 0.2})`;
    ctx.beginPath();
    ctx.arc(playerX * scaleX, playerY * scaleY, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  getLandmarks() {
    const marks = [];
    const add = (id, label, short, x, y, color) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      marks.push({ id, label, short, x, y, color });
    };

    if (this.rat) add('rat', 'Rat', 'R', this.rat.x, this.rat.y, '#f472b6');

    this.colliders.forEach(box => {
      const cx = box.x + (box.w || 0) / 2;
      const cy = box.y + (box.h || 0) / 2;
      if (box.type === 'homecabin') add('home', 'Home', 'H', cx, cy, '#4ade80');
      else if (box.type === 'shop' && box.shopName === 'Fish Market') add('market', 'Market', 'F', cx, cy, '#38bdf8');
      else if (box.type === 'shop') add('shop', 'Shop', 'S', cx, cy, '#a78bfa');
    });

    const den = this.decorations.find(d => d.type === 'raccoonden');
    if (den) add('den', 'Den', 'D', den.x, den.y, '#f59e0b');

    if (this.farmPlots?.length) {
      const avg = this.farmPlots.reduce((acc, plot) => {
        acc.x += plot.x + plot.w / 2;
        acc.y += plot.y + plot.h / 2;
        return acc;
      }, { x: 0, y: 0 });
      add('farm', 'Farm', 'G', avg.x / this.farmPlots.length, avg.y / this.farmPlots.length, '#84cc16');
    }

    return marks;
  }

  getRareFishAt(x, y) {
    if (!this.rareFish?.length) return null;
    return this.rareFish.find(rf => Math.hypot(rf.x - x, rf.y - y) < 90) || null;
  }

  reset() {
    // Re-loot containers
    this.containers.forEach(c => { c.looted = false; });
  }

  getTileAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return this.TILE_LAKE;
    return this.map[Math.floor(y / this.tileSize) * this.cols + Math.floor(x / this.tileSize)];
  }

  checkCollisions(playerX, playerY, radius) {
    let resolvedX = playerX;
    let resolvedY = playerY;
    let collided = false;

    if (resolvedX < radius) { resolvedX = radius; collided = true; }
    if (resolvedX > this.width - radius) { resolvedX = this.width - radius; collided = true; }
    if (resolvedY < radius) { resolvedY = radius; collided = true; }
    if (resolvedY > this.height - radius) { resolvedY = this.height - radius; collided = true; }

    // Use circle vs AABB check
    for (const box of this.colliders) {
      if (box.type === 'bush') continue; // Bushes have no physical block, just hiding

      const closestX = Math.max(box.x, Math.min(resolvedX, box.x + box.w));
      const closestY = Math.max(box.y, Math.min(resolvedY, box.y + box.h));
      const dx = resolvedX - closestX;
      const dy = resolvedY - closestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        collided = true;
        if (dist === 0) {
          const l = resolvedX - box.x, r = (box.x + box.w) - resolvedX, t = resolvedY - box.y, b = (box.y + box.h) - resolvedY;
          const minDist = Math.min(l, r, t, b);
          if (minDist === l) resolvedX = box.x - radius;
          else if (minDist === r) resolvedX = box.x + box.w + radius;
          else if (minDist === t) resolvedY = box.y - radius;
          else resolvedY = box.y + box.h + radius;
        } else {
          resolvedX = closestX + (dx / dist) * radius;
          resolvedY = closestY + (dy / dist) * radius;
        }
      }
    }
    return { x: resolvedX, y: resolvedY, collided };
  }

  /**
   * Draws only the flat ground plane textures
   */
  /**
   * Bake the static ground layer (tile fills, texture flecks, dock, sewer
   * pipe hole) to an offscreen canvas once. None of this changes after
   * world generation, so redrawing it tile-by-tile every frame was wasted
   * work — this bakes it once and drawGround() just blits the visible
   * region from then on.
   */
  _buildGroundCache() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');

    const tileColors = {
      [this.TILE_LAKE]: '#0284c7', [this.TILE_BEACH]: '#fef08a',
      [this.TILE_GRASS]: '#22c55e', [this.TILE_CONCRETE]: '#94a3b8',
      [this.TILE_POOL]: '#06b6d4', [this.TILE_BUSH]: '#22c55e',
      [this.TILE_ROAD]: '#374151', [this.TILE_SIDEWALK]: '#d1d5db',
      [this.TILE_FLOOR]: '#a9743f'
    };

    // Pixel-art terrain (Sprout Lands) when the sheets are decoded;
    // flat colors otherwise. drawGround() rebuilds once sprites arrive.
    const hasCatalogRug = this.rugs.some(r => r.piece);
    const useSprites = spriteReady(Sprites.grass) && spriteReady(Sprites.dirt) &&
      (!this.rugs.length || spriteReady(Sprites.furniture)) &&
      (!hasCatalogRug || this.rugs.every(r => !r.piece || RUG_PIECES[r.piece]?.src === 'basic' || spriteReady(Sprites.modernInteriors)));
    this._cacheHasSprites = useSprites;
    this._foamRects = []; // shoreline foam, drawn live above the animated water
    ctx.imageSmoothingEnabled = false;
    const ts = this.tileSize;
    const isWater = (t) => t === this.TILE_LAKE || t === this.TILE_POOL;
    // Whispering Woods gets the darker/mossy grass variant for a distinct
    // biome look instead of sharing the main meadow's texture. (The
    // campsite's "swamp" zone turns out to be pure water — no grass tiles —
    // so Woods, which is the actual grass biome the player visits outside
    // the meadow, is the meaningful place to apply this.)
    const useDarkerGrass = this.areaType === 'woods' && spriteReady(Sprites.darkerGrass);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = this.map[r * this.cols + c];
        ctx.fillStyle = tileColors[type];
        ctx.fillRect(c * this.tileSize, r * this.tileSize, this.tileSize, this.tileSize);

        if (useSprites && (type === this.TILE_GRASS || type === this.TILE_BUSH)) {
          const grassImg = useDarkerGrass ? Sprites.darkerGrass : Sprites.grass;
          ctx.drawImage(grassImg, GRASS_TILE.sx, GRASS_TILE.sy, GRASS_TILE.sw, GRASS_TILE.sh, c * ts, r * ts, ts, ts);
          // Deterministic per-tile mottling so big lawns don't read flat
          const h = (r * 73856093 ^ c * 19349663) >>> 0;
          const v = h % 7;
          if (v === 0) { ctx.fillStyle = 'rgba(21, 128, 61, 0.10)'; ctx.fillRect(c * ts, r * ts, ts, ts); }
          else if (v === 1) { ctx.fillStyle = 'rgba(254, 240, 138, 0.05)'; ctx.fillRect(c * ts, r * ts, ts, ts); }
          if (v === 2 || v === 5) {
            // Little grass tufts
            ctx.fillStyle = 'rgba(22, 101, 52, 0.5)';
            const tx = c * ts + 8 + (h % 40), ty = r * ts + 8 + ((h >> 4) % 40);
            ctx.fillRect(tx, ty, 3, 7); ctx.fillRect(tx + 5, ty + 2, 3, 5); ctx.fillRect(tx - 5, ty + 3, 3, 5);
          }
          continue;
        }
        if (useSprites && type === this.TILE_BEACH) {
          ctx.drawImage(Sprites.dirt, DIRT_TILE.sx, DIRT_TILE.sy, DIRT_TILE.sw, DIRT_TILE.sh, c * ts, r * ts, ts, ts);
          // Warm sandy wash over the dirt tile so it reads as beach
          ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
          ctx.fillRect(c * ts, r * ts, ts, ts);
          continue;
        }

        if (type === this.TILE_LAKE || type === this.TILE_POOL) {
          // Base water color only — animated frames are drawn live in drawGround
          // Soft shoreline foam where water meets land
          const nbs = [[0, -1, 'top'], [0, 1, 'bottom'], [-1, 0, 'left'], [1, 0, 'right']];
          for (const [dc, dr, side] of nbs) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr >= this.rows || cc < 0 || cc >= this.cols) continue;
            if (isWater(this.map[rr * this.cols + cc])) continue;
            let rect;
            if (side === 'top') rect = [c * ts, r * ts, ts, 5];
            else if (side === 'bottom') rect = [c * ts, r * ts + ts - 5, ts, 5];
            else if (side === 'left') rect = [c * ts, r * ts, 5, ts];
            else rect = [c * ts + ts - 5, r * ts, 5, ts];
            this._foamRects.push(rect);
          }
        } else if (type === this.TILE_GRASS || type === this.TILE_BUSH) {
          ctx.fillStyle = 'rgba(21, 128, 61, 0.2)';
          ctx.fillRect(c * this.tileSize + 16, r * this.tileSize + 16, 4, 8);
          ctx.fillRect(c * this.tileSize + 40, r * this.tileSize + 44, 4, 8);
        } else if (type === this.TILE_BEACH) {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
          ctx.fillRect(c * this.tileSize + 20, r * this.tileSize + 20, 2, 2);
          ctx.fillRect(c * this.tileSize + 48, r * this.tileSize + 36, 2, 2);
        } else if (type === this.TILE_ROAD) {
          // Road lane markings
          ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
          ctx.fillRect(c * this.tileSize + 12, r * this.tileSize + 30, 16, 3);
          ctx.fillRect(c * this.tileSize + 36, r * this.tileSize + 30, 16, 3);
        } else if (type === this.TILE_SIDEWALK) {
          // Subtle sidewalk grid lines
          ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(c * this.tileSize + 1, r * this.tileSize + 1, this.tileSize - 2, this.tileSize - 2);
        } else if (type === this.TILE_FLOOR) {
          if (useSprites && spriteReady(Sprites.floorsWalls)) {
            const floorTile = this.roomStyle === 'cool' ? CAFE_FLOOR_TILE : CABIN_FLOOR_TILE;
            ctx.drawImage(Sprites.floorsWalls, floorTile.sx, floorTile.sy, floorTile.sw, floorTile.sh,
              c * ts, r * ts, ts, ts);
          } else {
            // Wooden floorboards fallback while the sprite sheet loads:
            // horizontal plank seams + staggered joints
            ctx.strokeStyle = 'rgba(69, 26, 3, 0.25)';
            ctx.lineWidth = 2;
            for (let py = 0; py < this.tileSize; py += 16) {
              ctx.beginPath();
              ctx.moveTo(c * ts, r * ts + py); ctx.lineTo(c * ts + ts, r * ts + py);
              ctx.stroke();
              const jx = c * ts + ((c * 31 + r * 17 + py) % ts);
              ctx.beginPath(); ctx.moveTo(jx, r * ts + py); ctx.lineTo(jx, r * ts + py + 16); ctx.stroke();
            }
          }
        }
      }
    }

    // Dock floor (drawn on ground) — if dock exists
    if (this._dock) {
      const d = this._dock;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(d.dockBaseX, d.dockBaseY, 64, 128);
      ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2;
      for (let py = d.dockBaseY; py < d.dockBaseY + 128; py += 16) {
        ctx.beginPath(); ctx.moveTo(d.dockBaseX, py); ctx.lineTo(d.dockBaseX + 64, py); ctx.stroke();
      }
    }

    // Sewer Pipe base (hole)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(this.rat.x, this.rat.y, 40, 0, Math.PI, true); ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 8; ctx.stroke();

    // Interior rugs (baked into the floor once sprites are ready). A rug is
    // either a catalog piece (Modern Interiors, via rug.piece) or one of the
    // three TopDownHouse warm rugs (via rug.v).
    if (this.rugs.length) {
      this.rugs.forEach(rug => {
        if (rug.piece && RUG_PIECES[rug.piece]) {
          const p = RUG_PIECES[rug.piece];
          const img = p.src === 'basic' ? Sprites.furniture : Sprites.modernInteriors;
          if (!spriteReady(img)) return;
          const dw = p.drawW, dh = dw * (p.sh / p.sw);
          ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, rug.x - dw / 2, rug.y - dh / 2, dw, dh);
        } else if (spriteReady(Sprites.furniture)) {
          const s = RUG_SPRITES[rug.v % RUG_SPRITES.length];
          ctx.drawImage(Sprites.furniture, s.sx, s.sy, s.sw, s.sh, rug.x - 80, rug.y - 40, 160, 80);
        }
      });
    }

    this._groundCache = canvas;
  }

  drawGround(ctx, camera, farmExtras) {
    // (Re)bake if missing, or if sprites finished decoding since the last bake
    if (!this._groundCache ||
        (!this._cacheHasSprites && spriteReady(Sprites.grass) && spriteReady(Sprites.dirt))) {
      this._buildGroundCache();
    }

    // Blit only the visible portion of the baked ground layer
    const sx = Math.max(0, camera.x);
    const sy = Math.max(0, camera.y);
    const sw = Math.min(this.width - sx, camera.w);
    const sh = Math.min(this.height - sy, camera.h);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(this._groundCache, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    // Animated water: draw the 4-frame Sprout Lands water cycle over every
    // visible lake/pool tile, staggered per-tile so the surface shimmers.
    if (spriteReady(Sprites.water)) {
      ctx.imageSmoothingEnabled = false;
      const ts = this.tileSize;
      const c0 = Math.max(0, Math.floor(camera.x / ts));
      const c1 = Math.min(this.cols - 1, Math.ceil((camera.x + camera.w) / ts));
      const r0 = Math.max(0, Math.floor(camera.y / ts));
      const r1 = Math.min(this.rows - 1, Math.ceil((camera.y + camera.h) / ts));
      const t = Math.floor(Date.now() / 320);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const type = this.map[r * this.cols + c];
          if (type !== this.TILE_LAKE && type !== this.TILE_POOL) continue;
          const f = WATER_FRAMES[(t + ((r * 7 + c * 3) % 4)) % 4];
          ctx.drawImage(Sprites.water, f.sx, f.sy, f.sw, f.sh, c * ts, r * ts, ts, ts);
          if (type === this.TILE_POOL) {
            // Chlorinated-cyan wash so pools stay distinct from the lake
            ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
            ctx.fillRect(c * ts, r * ts, ts, ts);
          }
        }
      }
      // Lily pads gently bobbing on the lake surface
      if (spriteReady(Sprites.objects)) {
        const now = Date.now() / 700;
        for (const lp of this.lilyPads) {
          if (lp.x < camera.x - 20 || lp.x > camera.x + camera.w + 20 ||
              lp.y < camera.y - 20 || lp.y > camera.y + camera.h + 20) continue;
          const s = LILY_SPRITES[lp.v];
          const bob = Math.sin(now + lp.phase) * 2;
          ctx.drawImage(Sprites.objects, s.sx, s.sy, s.sw, s.sh,
            lp.x - 14 + bob, lp.y - 14, 28, 28);
        }
      }
      if (spriteReady(Sprites.premiumBigFish) && this.rareFish?.length) {
        const now = Date.now() / 1000;
        for (const rf of this.rareFish) {
          const swimX = rf.x + Math.cos(now * 0.6 + rf.phase) * 26;
          const swimY = rf.y + Math.sin(now * 0.9 + rf.phase) * 14;
          if (swimX < camera.x - 40 || swimX > camera.x + camera.w + 40 ||
              swimY < camera.y - 40 || swimY > camera.y + camera.h + 40) continue;
          const frame = BIG_FISH_SWIM_FRAMES[Math.floor(now * 8 + rf.phase * 3) % BIG_FISH_SWIM_FRAMES.length];
          const dir = Math.cos(now * 0.6 + rf.phase) >= 0 ? 1 : -1;
          ctx.save();
          ctx.translate(swimX, swimY);
          ctx.scale(dir, 1);
          ctx.globalAlpha = 0.82;
          ctx.drawImage(Sprites.premiumBigFish, frame.sx, frame.sy, frame.sw, frame.sh, -18, -10, 36, 20);
          ctx.restore();
          ctx.fillStyle = 'rgba(224, 242, 254, 0.18)';
          ctx.beginPath(); ctx.ellipse(swimX, swimY + 4, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Shoreline foam above the animated frames
      if (this._foamRects && this._foamRects.length) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
        for (const [fx, fy, fw, fh] of this._foamRects) {
          if (fx + fw < camera.x || fx > camera.x + camera.w ||
              fy + fh < camera.y || fy > camera.y + camera.h) continue;
          ctx.fillRect(fx, fy, fw, fh);
        }
      }
    }

    // Draw bus stop signs (transition points) on ground layer — animated
    // pulse, so this stays a live per-frame draw rather than baked in.
    // Homestead farm plots: flat ground layer with small Sprout crop sprites.
    if (this.farmPlots && this.farmPlots.length) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (const plot of this.farmPlots) {
        if (plot.x + plot.w < camera.x || plot.x > camera.x + camera.w ||
            plot.y + plot.h < camera.y || plot.y > camera.y + camera.h) continue;

        // Dry soil is a warm tan; watered soil is a distinctly darker,
        // saturated brown so a tended plot reads at a glance.
        ctx.fillStyle = plot.watered ? '#5c3a22' : '#9a673e';
        ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
        ctx.strokeStyle = plot.watered ? '#3f2716' : '#6f4428';
        ctx.lineWidth = 3;
        ctx.strokeRect(plot.x + 1.5, plot.y + 1.5, plot.w - 3, plot.h - 3);
        ctx.strokeStyle = 'rgba(244, 229, 195, 0.16)';
        ctx.lineWidth = 1;
        for (let ry = plot.y + 12; ry < plot.y + plot.h - 4; ry += 10) {
          ctx.beginPath();
          ctx.moveTo(plot.x + 7, ry);
          ctx.lineTo(plot.x + plot.w - 7, ry);
          ctx.stroke();
        }

        if (plot.watered) {
          // Wet sheen + scattered droplet specks — an unmistakable "just
          // watered" cue that fades as the soil implicitly dries next day.
          ctx.fillStyle = 'rgba(120, 190, 230, 0.18)';
          ctx.fillRect(plot.x + 3, plot.y + 3, plot.w - 6, plot.h - 6);
          ctx.fillStyle = 'rgba(191, 232, 252, 0.55)';
          for (let i = 0; i < 5; i++) {
            const dx = plot.x + 8 + ((plot.x * 7 + i * 13) % (plot.w - 16));
            const dy = plot.y + 8 + ((plot.y * 5 + i * 19) % (plot.h - 16));
            ctx.beginPath();
            ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (plot.crop) {
          const cropDef = CROP_TYPES[plot.crop] || CROP_TYPES.sproutroot;
          const stage = Math.max(0, Math.min(cropDef.stages.length - 1, plot.stage || 0));
          const cx = plot.x + plot.w / 2;
          if (stage === 0) {
            // Freshly planted: a small mound of turned earth with seed dots,
            // so an empty-looking sprite frame never reads as bare dirt.
            const my = plot.y + plot.h - 12;
            ctx.fillStyle = plot.watered ? '#432814' : '#7a4f2e';
            ctx.beginPath();
            ctx.ellipse(cx, my, 11, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c8a86a';
            ctx.beginPath(); ctx.arc(cx - 3, my - 1, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 3, my, 1.5, 0, Math.PI * 2); ctx.fill();
            // A single tender sprout poking through
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, my - 1);
            ctx.lineTo(cx, my - 7);
            ctx.stroke();
          } else {
            const crop = cropDef.stages[stage];
            const sheet = plot.watered && spriteReady(Sprites.farmingPlantsWatered)
              ? Sprites.farmingPlantsWatered
              : Sprites.farmingPlants;
            // Ready-to-harvest crops get a soft golden halo to draw the eye.
            if (stage >= 3) {
              const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
              ctx.save();
              ctx.globalAlpha = 0.25 + pulse * 0.2;
              const g = ctx.createRadialGradient(cx, plot.y + plot.h - 20, 4, cx, plot.y + plot.h - 20, 26);
              g.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
              g.addColorStop(1, 'rgba(253, 224, 71, 0)');
              ctx.fillStyle = g;
              ctx.fillRect(plot.x - 6, plot.y - 6, plot.w + 12, plot.h + 12);
              ctx.restore();
            }
            if (spriteReady(sheet)) {
              const size = stage >= 3 ? 44 : 34;
              ctx.drawImage(sheet, crop.sx, crop.sy, crop.sw, crop.sh,
                cx - size / 2,
                plot.y + plot.h - size - 2,
                size, size);
            } else {
              ctx.fillStyle = stage >= 3 ? '#65a30d' : '#84cc16';
              ctx.beginPath();
              ctx.ellipse(cx, plot.y + plot.h / 2 + 4, 8 + stage * 3, 10 + stage * 4, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        if (farmExtras?.focusedPlot?.id === plot.id && farmExtras.focusedPlotHint) {
          const hint = farmExtras.focusedPlotHint;
          const bubbleW = 132;
          const bubbleH = 28;
          const bx = plot.x + plot.w / 2 - bubbleW / 2;
          const by = plot.y - 40;
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
          ctx.beginPath();
          ctx.roundRect(bx, by, bubbleW, bubbleH, 6);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(hint.title, plot.x + plot.w / 2, by + 11);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '600 8px Outfit, sans-serif';
          ctx.fillText(hint.detail, plot.x + plot.w / 2, by + 21);
          ctx.restore();
        }
      }

      // Scarecrow: a simple vector prop (no sprite asset for this yet) that
      // stands at the first plot's corner once the player owns one.
      if (farmExtras?.hasScarecrow) {
        const anchor = this.farmPlots[0];
        const sx = anchor.x - 14;
        const sy = anchor.y + anchor.h - 4;
        ctx.strokeStyle = '#8a6a3f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 34);
        ctx.moveTo(sx - 10, sy - 22);
        ctx.lineTo(sx + 10, sy - 22);
        ctx.stroke();
        ctx.fillStyle = '#d97706';
        ctx.fillRect(sx - 7, sy - 34, 14, 4);
        ctx.fillStyle = '#f5deb3';
        ctx.beginPath();
        ctx.arc(sx, sy - 38, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy - 42);
        ctx.lineTo(sx + 8, sy - 42);
        ctx.lineTo(sx, sy - 50);
        ctx.fill();
      }

      // Crow pests: a quick vector shape so they don't need a new sprite sheet.
      if (farmExtras?.cropPests?.length) {
        for (const crow of farmExtras.cropPests) {
          const bob = crow.state === 'eating' ? Math.sin(Date.now() / 90) * 1.5 : 0;
          ctx.save();
          ctx.translate(crow.x, crow.y + bob);
          ctx.fillStyle = '#1e1b18';
          ctx.beginPath();
          ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          const flap = crow.state === 'flying' || crow.state === 'fleeing'
            ? Math.sin(Date.now() / 60) * 6
            : 0;
          ctx.fillStyle = '#312e2b';
          ctx.beginPath();
          ctx.ellipse(-4, -flap, 7, 3, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(4, -flap, 7, 3, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(8, -1);
          ctx.lineTo(13, 0);
          ctx.lineTo(8, 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    this.transitionPoints.forEach(tp => {
      if (tp.targetArea === '__exit') {
        // Interior exit: a doormat instead of a bus-stop pulse
        ctx.fillStyle = '#7f5233';
        ctx.fillRect(tp.x, tp.y - 14, tp.w, 26);
        ctx.strokeStyle = '#5c3a21'; ctx.lineWidth = 2;
        ctx.strokeRect(tp.x + 3, tp.y - 11, tp.w - 6, 20);
        return;
      }
      const isForest = tp.targetArea === 'woods' || tp.targetArea === 'campsite' && tp.label && tp.label.includes('Camp');
      if (isForest) {
        // Forest transitions read as a soft mossy clearing, not a transit
        // stop — a radial glow feels more like "the treeline opens up"
        // than a hard-edged rectangle.
        const pulse = 0.35 + Math.sin(Date.now() / 500) * 0.12;
        const cx = tp.x + tp.w / 2, cy = tp.y + tp.h / 2;
        const rad = Math.max(tp.w, tp.h) * 0.62;
        const grad = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
        grad.addColorStop(0, `rgba(74, 222, 128, ${pulse + 0.15})`);
        grad.addColorStop(0.6, `rgba(34, 197, 94, ${pulse * 0.6})`);
        grad.addColorStop(1, 'rgba(21, 128, 61, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(134, 239, 172, ${0.5 + pulse * 0.3})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad * 0.92, rad * 0.78, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      const pulse = 0.4 + Math.sin(Date.now() / 400) * 0.15;
      ctx.fillStyle = `rgba(34, 211, 238, ${pulse})`;
      ctx.fillRect(tp.x, tp.y, tp.w, tp.h);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tp.x, tp.y, tp.w, tp.h);
    });
  }

  /**
   * Packages all environmental objects into sortable entities for 2.5D rendering
   */
  getSortableEntities() {
    const entities = [];

    // 1. Colliders (Cabins, Trees, Tables, Bushes, Shops)
    this.colliders.forEach(box => {
      if (box.collisionOnly) return;
      if (box.type === 'fence' && box.isDock) return; // Dock edge guides are invisible collision-only barriers
      if (box.type === 'fence') {
        // Visible low fence/barrier — tile the rail sprite across its width
        entities.push({
          y: box.y + box.h,
          draw: (ctx) => {
            if (spriteReady(Sprites.fence)) {
              const tileW = 24;
              for (let fx = box.x; fx < box.x + box.w; fx += tileW) {
                const w = Math.min(tileW, box.x + box.w - fx);
                ctx.drawImage(Sprites.fence, FENCE_SPRITE.sx, FENCE_SPRITE.sy, FENCE_SPRITE.sw, FENCE_SPRITE.sh, fx, box.y - 8, w, 24);
              }
            } else {
              ctx.fillStyle = '#b45309';
              ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
        });
        return;
      }
      entities.push({
        y: box.y + box.h, // Y-anchor is the bottom of the object (its footprint)
        draw: (ctx) => {
          if (box.type === 'cabin' || box.type === 'cafe' || box.type === 'shop' || box.type === 'homecabin') {
            const cx = box.x + box.w / 2;
            const bottomY = box.y + box.h;
            const houseReady = spriteReady(Sprites.house);
            const brickReady = spriteReady(Sprites.brickHouse);
            const hutReady = spriteReady(Sprites.premiumHuts);

            if ((box.type === 'cabin' || box.type === 'homecabin') && hutReady) {
              const hutIndex = Number.isInteger(box.variant) ? Math.abs(box.variant) % HUT_SPRITES.length : 0;
              drawBottomAnchoredSprite(ctx, Sprites.premiumHuts, HUT_SPRITES[hutIndex], cx, bottomY, box.w);
            } else if (box.type === 'cafe' || box.type === 'cabin' || box.type === 'homecabin') {
              drawSproutBuilding(ctx, box);
            } else if (box.type === 'shop' && brickReady) {
              drawBottomAnchoredSprite(ctx, Sprites.brickHouse, SHOP_SPRITE, cx, bottomY, box.w);
            } else if (box.type !== 'shop' && houseReady) {
              const crop = (box.type === 'cabin' || box.type === 'homecabin') ? CABIN_SPRITE : CAFE_SPRITE;
              drawBottomAnchoredSprite(ctx, Sprites.house, crop, cx, bottomY, box.w);
            } else {
              // Fallback vector building while the sprite sheet is still loading
              ctx.fillStyle = box.color;
              ctx.fillRect(box.x, box.y, box.w, box.h);
              const roofColor = box.type === 'cabin' ? '#7f1d1d' : box.type === 'homecabin' ? '#166534' : (box.type === 'cafe' ? '#334155' : '#1e293b');
              ctx.fillStyle = roofColor;
              ctx.beginPath();
              if (box.type === 'cabin' || box.type === 'homecabin') {
                ctx.moveTo(box.x - 16, box.y);
                ctx.lineTo(box.x + box.w / 2, box.y - 70);
                ctx.lineTo(box.x + box.w + 16, box.y);
              } else {
                ctx.fillRect(box.x - 8, box.y - 12, box.w + 16, 16);
              }
              ctx.closePath();
              ctx.fill();
            }

            if (box.type === 'homecabin' && !box.homePumped) {
              drawHomeCabinSubmersion(ctx, box);
            }

            // Signage/details stay as an overlay on top of either sprite or fallback art
            if (false && box.type === 'cafe') {
              ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 12px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('RESORT CAFÉ', box.x + box.w/2, box.y - 8);
            } else if (false && box.type === 'homecabin') {
              ctx.fillStyle = '#4ade80'; ctx.font = 'bold 12px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('🏡 HOME', box.x + box.w/2, box.y - 8);
            } else if (box.type === 'shop') {
              const accent = box.accentColor || box.color || '#38bdf8';
              const signX = box.x + 10;
              const signY = box.y - 24;
              const signW = box.w - 20;

              ctx.fillStyle = '#f8fafc';
              ctx.strokeStyle = accent;
              ctx.lineWidth = 3;
              ctx.fillRect(signX, signY, signW, 22);
              ctx.strokeRect(signX, signY, signW, 22);
              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 10px Outfit';
              ctx.textAlign = 'center';
              ctx.fillText(box.shopName || 'SHOP', box.x + box.w / 2, signY + 15);

              // Color-coded awning and display windows make town facades read
              // as distinct storefronts while still sharing the same base art.
              const awnY = box.y + 30;
              ctx.fillStyle = accent;
              ctx.fillRect(box.x + 12, awnY, box.w - 24, 15);
              ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
              for (let sx = box.x + 18; sx < box.x + box.w - 18; sx += 24) {
                ctx.fillRect(sx, awnY + 2, 10, 11);
              }

              const winY = box.y + 52;
              const winW = Math.max(30, Math.min(44, box.w * 0.26));
              ctx.fillStyle = 'rgba(186, 230, 253, 0.72)';
              ctx.fillRect(box.x + 18, winY, winW, 26);
              ctx.fillRect(box.x + box.w - 18 - winW, winY, winW, 26);
              ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
              ctx.lineWidth = 2;
              ctx.strokeRect(box.x + 18, winY, winW, 26);
              ctx.strokeRect(box.x + box.w - 18 - winW, winY, winW, 26);

              ctx.fillStyle = '#1e293b';
              ctx.fillRect(box.x + box.w / 2 - 14, box.y + box.h - 38, 28, 38);
              ctx.fillStyle = accent;
              ctx.fillRect(box.x + box.w / 2 - 10, box.y + box.h - 34, 20, 12);

              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 8px Outfit';
              ctx.fillText(box.signShort || 'OPEN', box.x + 18 + winW / 2, winY + 17);
              const motifX = box.x + box.w - 18 - winW / 2;
              const motifY = winY + 14;
              ctx.strokeStyle = accent;
              ctx.lineWidth = 2;
              ctx.beginPath();
              if (box.shopKind === 'fish_market') {
                ctx.ellipse(motifX, motifY, 13, 7, 0, 0, Math.PI * 2);
                ctx.moveTo(motifX + 13, motifY);
                ctx.lineTo(motifX + 23, motifY - 7);
                ctx.lineTo(motifX + 23, motifY + 7);
                ctx.closePath();
              } else if (box.shopKind === 'surf_shop') {
                ctx.moveTo(motifX - 16, motifY + 6);
                ctx.quadraticCurveTo(motifX - 4, motifY - 10, motifX + 12, motifY + 4);
                ctx.quadraticCurveTo(motifX + 18, motifY + 9, motifX + 24, motifY + 2);
              } else if (box.shopKind === 'ice_cream') {
                ctx.moveTo(motifX - 9, motifY - 8);
                ctx.lineTo(motifX, motifY + 12);
                ctx.lineTo(motifX + 9, motifY - 8);
                ctx.arc(motifX, motifY - 8, 9, 0, Math.PI * 2);
              } else if (box.shopKind === 'juice_bar') {
                ctx.roundRect(motifX - 10, motifY - 10, 20, 20, 4);
                ctx.moveTo(motifX + 4, motifY - 10);
                ctx.lineTo(motifX + 14, motifY - 19);
              } else if (box.shopKind === 'bait_tackle') {
                ctx.arc(motifX, motifY - 4, 10, 0.1, Math.PI * 1.25);
                ctx.lineTo(motifX + 10, motifY + 10);
              } else {
                ctx.moveTo(motifX, motifY - 14);
                ctx.lineTo(motifX + 4, motifY - 3);
                ctx.lineTo(motifX + 16, motifY - 3);
                ctx.lineTo(motifX + 6, motifY + 4);
                ctx.lineTo(motifX + 10, motifY + 16);
                ctx.lineTo(motifX, motifY + 8);
                ctx.lineTo(motifX - 10, motifY + 16);
                ctx.lineTo(motifX - 6, motifY + 4);
                ctx.lineTo(motifX - 16, motifY - 3);
                ctx.lineTo(motifX - 4, motifY - 3);
                ctx.closePath();
              }
              ctx.stroke();

              if (box.hasComputer) {
                ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
                ctx.fillRect(box.x + box.w - 18 - winW + 8, winY + 7, 15, 10);
                ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
                ctx.beginPath();
                ctx.arc(box.x + box.w - 18 - winW + 16, winY + 12, 20, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          else if (box.type === 'tree') {
            // Draw shadow
            ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
            ctx.beginPath(); ctx.ellipse(box.x + 12, box.y + 24, 20, 8, 0, 0, Math.PI * 2); ctx.fill();

            // A tree collider with a fruit-tree `variant` (0-3) uses the
            // premium apple/orange/peach/pear art instead of the plain tree —
            // purely cosmetic, picked once at world-gen time.
            const useForestTree = this.areaType === 'woods' && spriteReady(Sprites.premiumFlora);
            const fruitSheet = !useForestTree && Number.isInteger(box.variant) ? FRUIT_TREE_SHEETS[box.variant] : null;
            const sprite = useForestTree ? Sprites.premiumFlora : (fruitSheet && spriteReady(fruitSheet) ? fruitSheet : Sprites.objects);
            const crop = useForestTree
              ? PREMIUM_TREE_SPRITES[Math.abs(box.variant || 0) % PREMIUM_TREE_SPRITES.length]
              : (fruitSheet && spriteReady(fruitSheet) ? FRUIT_TREE_SPRITE : TREE_SPRITE);
            if (sprite.complete && sprite.naturalWidth > 0) {
              // Sprout Lands tree sprite, bottom-anchored to the collider's base
              const destW = useForestTree ? 72 : 64;
              const destH = destW * (crop.sh / crop.sw);
              ctx.drawImage(
                sprite, crop.sx, crop.sy, crop.sw, crop.sh,
                box.x + 12 - destW / 2, box.y + 24 - destH, destW, destH
              );
            } else {
              // Fallback vector tree while the sprite sheet is still loading
              ctx.fillStyle = '#78350f';
              ctx.fillRect(box.x + 6, box.y, 12, 24);
              ctx.fillStyle = '#15803d';
              ctx.beginPath(); ctx.arc(box.x + 12, box.y - 20, 35, 0, Math.PI*2); ctx.fill();
              ctx.fillStyle = '#166534';
              ctx.beginPath(); ctx.arc(box.x + 8, box.y - 25, 25, 0, Math.PI*2); ctx.fill();
            }
          }
          else if (box.type === 'table') {
            // Mossy log bench (campsite seating)
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(box.x + box.w/2, box.y + box.h - 6, box.w/2 + 8, 10, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.objects)) {
              drawBottomAnchoredSprite(ctx, Sprites.objects, LOG_BENCH_SPRITE, box.x + box.w / 2, box.y + box.h + 4, box.w + 24);
            } else {
              ctx.fillStyle = '#854d0e';
              ctx.fillRect(box.x, box.y + box.h - 24, box.w, 20);
            }
          }
          else if (box.type === 'bush') {
            if (this.areaType === 'woods' && spriteReady(Sprites.premiumFlora)) {
              const crop = PREMIUM_BUSH_SPRITES[Math.abs(box.variant || 0) % PREMIUM_BUSH_SPRITES.length];
              drawBottomAnchoredSprite(ctx, Sprites.premiumFlora, crop, box.x + box.w / 2, box.y + box.h, 54);
            } else if (spriteReady(Sprites.objects)) {
              drawBottomAnchoredSprite(ctx, Sprites.objects, BUSH_SPRITE, box.x + box.w / 2, box.y + box.h, 48);
            } else {
              // Fallback vector bush while the sprite sheet is still loading
              ctx.fillStyle = '#15803d';
              ctx.beginPath(); ctx.ellipse(box.x + box.w/2, box.y + box.h/2, box.w/2, box.h/2 + 10, 0, 0, Math.PI * 2); ctx.fill();
            }
          }
          else if (box.type === 'wall') {
            if (spriteReady(Sprites.floorsWalls)) {
              const wallTile = this.roomStyle === 'cool' ? CAFE_WALL_TILE : CABIN_WALL_TILE;
              ctx.imageSmoothingEnabled = false;
              for (let wx = box.x; wx < box.x + box.w; wx += wallTile.sw) {
                const dw = Math.min(wallTile.sw, box.x + box.w - wx);
                for (let wy = box.y; wy < box.y + box.h; wy += wallTile.sh) {
                  const dh = Math.min(wallTile.sh, box.y + box.h - wy);
                  ctx.drawImage(Sprites.floorsWalls, wallTile.sx, wallTile.sy, wallTile.sw, wallTile.sh, wx, wy, dw, dh);
                }
              }
            } else {
              // Fallback flat wall while the sprite sheet is still loading
              ctx.fillStyle = '#4a2e18';
              ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'counter') {
            if (spriteReady(Sprites.furnitureCool)) {
              // Tile the counter-run sprite across the collider's width rather
              // than stretch a single 100px crop, which would blur/distort.
              ctx.imageSmoothingEnabled = false;
              const destH = box.h + 24;
              for (let cx = box.x; cx < box.x + box.w; cx += COUNTER_SPRITE.sw) {
                const dw = Math.min(COUNTER_SPRITE.sw, box.x + box.w - cx);
                ctx.drawImage(Sprites.furnitureCool, COUNTER_SPRITE.sx, COUNTER_SPRITE.sy, COUNTER_SPRITE.sw, COUNTER_SPRITE.sh,
                  cx, box.y - (destH - box.h), dw, destH);
              }
            } else {
              ctx.fillStyle = '#451a03';
              ctx.fillRect(box.x, box.y + 8, box.w, box.h - 8);
              ctx.fillStyle = '#854d0e';
              ctx.fillRect(box.x - 4, box.y - 6, box.w + 8, 18);
              ctx.fillStyle = '#a16207';
              ctx.fillRect(box.x - 4, box.y - 6, box.w + 8, 6);
            }
          }
          else if (box.type === 'bed') {
            if (box.homeBed && spriteReady(Sprites.furnitureWarm)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.furnitureWarm, HOME_BED_SPRITE.sx, HOME_BED_SPRITE.sy, HOME_BED_SPRITE.sw, HOME_BED_SPRITE.sh,
                box.x, box.y, box.w, box.h);
            } else if (spriteReady(Sprites.furniture)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.furniture, BED_SPRITE.sx, BED_SPRITE.sy, BED_SPRITE.sw, BED_SPRITE.sh,
                box.x, box.y, box.w, box.h);
            } else {
              ctx.fillStyle = '#7c3aed'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'well') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
            ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h, box.w / 2 + 4, 8, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.waterWell)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.waterWell, box.x, box.y, box.w, box.h);
            } else {
              ctx.fillStyle = '#78716c'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'piknik') {
            if (spriteReady(Sprites.piknikBlanket)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.piknikBlanket, box.x, box.y, box.w, box.h);
              if (spriteReady(Sprites.piknikBasket)) {
                ctx.drawImage(Sprites.piknikBasket, box.x + box.w - 14, box.y + 4, 16, 16);
              }
            } else {
              ctx.fillStyle = '#dc2626'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'coop') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h, box.w / 2 + 6, 8, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.chickenHouses)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.chickenHouses, COOP_SPRITE.sx, COOP_SPRITE.sy, COOP_SPRITE.sw, COOP_SPRITE.sh,
                box.x, box.y, box.w, box.h);
            } else {
              ctx.fillStyle = '#a16207'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'watertray') {
            if (spriteReady(Sprites.waterTray)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.waterTray, WATER_TRAY_SPRITE.sx, WATER_TRAY_SPRITE.sy, WATER_TRAY_SPRITE.sw, WATER_TRAY_SPRITE.sh,
                box.x, box.y, box.w, box.h);
            } else {
              ctx.fillStyle = '#7dd3fc'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'mailbox') {
            if (spriteReady(Sprites.mailbox)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.mailbox, MAILBOX_SPRITE.sx, MAILBOX_SPRITE.sy, MAILBOX_SPRITE.sw, MAILBOX_SPRITE.sh,
                box.x, box.y, box.w, box.h);
            } else {
              ctx.fillStyle = '#94a3b8'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'boat') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h, box.w / 2, 6, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.boats)) {
              ctx.imageSmoothingEnabled = false;
              const boatH = box.w * (BOAT_SPRITE.sh / BOAT_SPRITE.sw);
              ctx.drawImage(Sprites.boats, BOAT_SPRITE.sx, BOAT_SPRITE.sy, BOAT_SPRITE.sw, BOAT_SPRITE.sh,
                box.x, box.y + box.h - boatH, box.w, boatH);
            } else {
              ctx.fillStyle = '#a16207'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else if (box.type === 'sign') {
            if (spriteReady(Sprites.signs)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.signs, SIGN_SPRITE.sx, SIGN_SPRITE.sy, SIGN_SPRITE.sw, SIGN_SPRITE.sh,
                box.x, box.y, box.w, box.h);
            } else {
              ctx.fillStyle = '#a8a29e'; ctx.fillRect(box.x, box.y, box.w, box.h);
            }
          }
          else {
            ctx.fillStyle = '#b45309'; ctx.fillRect(box.x, box.y, box.w, box.h);
          }
        }
      });
    });

    // 2. Containers (Coolers, Trash Cans)
    this.containers.forEach(c => {
      entities.push({
        y: c.y + c.h,
        draw: (ctx) => {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
          ctx.beginPath(); ctx.ellipse(c.x + c.w/2, c.y + c.h, c.w/2 + 4, 8, 0, 0, Math.PI * 2); ctx.fill();

          if (spriteReady(Sprites.chest)) {
            const crop = c.looted ? CONTAINER_OPEN_SPRITE : CONTAINER_CLOSED_SPRITE;
            drawBottomAnchoredSprite(ctx, Sprites.chest, crop, c.x + c.w / 2, c.y + c.h, Math.max(c.w, 40));
            if (c.locked && !c.looted) {
              // Golden padlock badge on locked containers
              const cx = c.x + c.w / 2, cy = c.y + c.h - 14;
              ctx.fillStyle = '#fbbf24';
              ctx.fillRect(cx - 5, cy - 4, 10, 9);
              ctx.strokeStyle = '#b45309'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(cx, cy - 4, 4, Math.PI, 0); ctx.stroke();
            }
          } else if (c.type === 'cooler') {
            // Fallback vector cooler while the sprite sheet is still loading
            ctx.fillStyle = c.looted ? '#cbd5e1' : '#3b82f6'; ctx.fillRect(c.x, c.y, c.w, c.h);
            ctx.fillStyle = '#f8fafc'; ctx.fillRect(c.x - 2, c.y - 4, c.w + 4, 6);
            ctx.fillStyle = '#94a3b8'; ctx.fillRect(c.x - 4, c.y + 6, 4, 10); ctx.fillRect(c.x + c.w, c.y + 6, 4, 10);
          } else {
            // Fallback vector trash can while the sprite sheet is still loading
            ctx.fillStyle = c.looted ? '#475569' : '#64748b'; ctx.fillRect(c.x, c.y, c.w, c.h);
            ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
            for (let ix = c.x + 4; ix < c.x + c.w; ix += 6) { ctx.beginPath(); ctx.moveTo(ix, c.y); ctx.lineTo(ix, c.y + c.h); ctx.stroke(); }
            ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(c.x + c.w/2, c.y, c.w/2, Math.PI, 0); ctx.fill();
          }
        }
      });
    });

    // 3. Ground Items
    this.items.forEach(item => {
      entities.push({
        y: item.y + 10,
        draw: (ctx) => {
          if (item.recycleFrame !== undefined && spriteReady(Sprites.recycle)) {
            const f = RECYCLE_SPRITES[item.recycleFrame % RECYCLE_SPRITES.length];
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(Sprites.recycle, f.sx, f.sy, f.sw, f.sh, item.x - 16, item.y - 16, 32, 32);
            return;
          }
          const fishSprite = item.isFish ? fishSpriteIndex(item.name) : null;
          if (fishSprite !== null && spriteReady(Sprites.premiumFish)) {
            const f = FISH_ICON_SPRITES[fishSprite % FISH_ICON_SPRITES.length];
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(Sprites.premiumFish, f.sx, f.sy, f.sw, f.sh, item.x - 16, item.y - 16, 32, 32);
            return;
          }
          ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(item.emoji, item.x, item.y);
        }
      });
    });

    // 4. Sewer Rat — the fence who buys your loot. Chunky pixel-styled
    // vendor with a wooden stall sign and an idle bob.
    entities.push({
      y: this.rat.y + 10,
      draw: (ctx) => {
        const rx = this.rat.x, ry = this.rat.y;
        const bob = Math.sin(Date.now() / 350) * 1.5;

        // Wooden sign on a post beside the pipe
        ctx.fillStyle = '#57534e';
        ctx.fillRect(rx + 26, ry - 46, 5, 48);
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(rx + 12, ry - 58, 34, 18);
        ctx.fillStyle = '#a16207';
        ctx.fillRect(rx + 14, ry - 56, 30, 14);
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 9px SproutPixel, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SHOP', rx + 29, ry - 49);

        ctx.save();
        ctx.translate(rx, ry + bob);

        // Tail — curvy pink line behind the body
        ctx.strokeStyle = '#f9a8d4';
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-10, 4);
        ctx.quadraticCurveTo(-24, 8, -26, -4 + Math.sin(Date.now() / 300) * 3);
        ctx.stroke();

        // Ears (behind head): big rounds with pink inners
        ctx.fillStyle = '#6b7280';
        ctx.beginPath(); ctx.arc(-11, -24, 8, 0, Math.PI * 2); ctx.arc(11, -24, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath(); ctx.arc(-11, -24, 4, 0, Math.PI * 2); ctx.arc(11, -24, 4, 0, Math.PI * 2); ctx.fill();

        // Body + head
        ctx.fillStyle = '#6b7280';
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -14, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
        // Belly patch
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath(); ctx.ellipse(0, 2, 8, 7, 0, 0, Math.PI * 2); ctx.fill();

        // Face: eyes, nose, whiskers
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(-4, -16, 2, 0, Math.PI * 2); ctx.arc(4, -16, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-3.3, -16.7, 0.8, 0, Math.PI * 2); ctx.arc(4.7, -16.7, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f472b6';
        ctx.beginPath(); ctx.arc(0, -11, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(229, 231, 235, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-4, -11); ctx.lineTo(-13, -13);
        ctx.moveTo(-4, -10); ctx.lineTo(-13, -8);
        ctx.moveTo(4, -11); ctx.lineTo(13, -13);
        ctx.moveTo(4, -10); ctx.lineTo(13, -8);
        ctx.stroke();

        // Paws clutching a shiny pebble
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath(); ctx.arc(-5, -3, 3, 0, Math.PI * 2); ctx.arc(5, -3, 3, 0, Math.PI * 2); ctx.fill();
        const spark = 0.6 + Math.sin(Date.now() / 250) * 0.4;
        ctx.fillStyle = `rgba(251, 191, 36, ${spark})`;
        ctx.beginPath(); ctx.arc(0, -3, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(-1, -5, 2, 2);

        ctx.restore();
      }
    });

    // 4b. Ambient decor: mushrooms and sunflowers scattered on grass
    if (spriteReady(Sprites.objects)) {
      this.ambient.forEach(a => {
        entities.push({
          y: a.y,
          draw: (ctx) => {
            if (a.kind === 'mushroom') {
              const s = MUSHROOM_SPRITES[a.v];
              ctx.drawImage(Sprites.objects, s.sx, s.sy, s.sw, s.sh, a.x - 12, a.y - 20, 24, 24);
            } else if (a.kind === 'forestClutter') {
              const s = PREMIUM_GROUND_SPRITES[a.v % PREMIUM_GROUND_SPRITES.length];
              const img = s.sheet === 'wood' ? Sprites.premiumWoodMushrooms : Sprites.premiumFlora;
              if (!spriteReady(img)) return;
              ctx.imageSmoothingEnabled = false;
              const dw = s.drawW || 24;
              const dh = dw * (s.sh / s.sw);
              ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, a.x - dw / 2, a.y - dh, dw, dh);
            } else {
              const sway = Math.sin(Date.now() / 600 + a.x) * 0.04;
              ctx.save();
              ctx.translate(a.x, a.y);
              ctx.rotate(sway);
              ctx.drawImage(Sprites.objects, SUNFLOWER_SPRITE.sx, SUNFLOWER_SPRITE.sy,
                SUNFLOWER_SPRITE.sw, SUNFLOWER_SPRITE.sh, -12, -44, 24, 48);
              ctx.restore();
            }
          }
        });
      });
    }

    // 5. Decorations (Flowers, Rocks, Lamp Posts)
    this.decorations.forEach(d => {
      if (d.hidden) return;
      entities.push({
        y: d.y + 5,
        draw: (ctx) => {
          if (d.type === 'flower') {
            // Stem
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y + 6);
            ctx.lineTo(d.x, d.y - 2);
            ctx.stroke();
            // Petals
            ctx.fillStyle = d.color;
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(d.x + Math.cos(a) * 4, d.y - 2 + Math.sin(a) * 4, 3, 0, Math.PI * 2);
              ctx.fill();
            }
            // Center
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(d.x, d.y - 2, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          else if (d.type === 'lilypad') {
            // Reuse the same pixel-art lily pad sprite the lake's ambient
            // system scatters over TILE_LAKE — pools/ponds don't get those
            // automatically, so the woods pond adds its own via decorations.
            const scale = d.scale || 1;
            const bob = Math.sin(Date.now() / 700 + d.x) * 2;
            if (spriteReady(Sprites.objects)) {
              const s = LILY_SPRITES[d.v || 0];
              const size = 28 * scale;
              ctx.drawImage(Sprites.objects, s.sx, s.sy, s.sw, s.sh,
                d.x - size / 2 + bob, d.y - size / 2, size, size);
            }
          }
          else if (d.type === 'frog') {
            if (spriteReady(Sprites.premiumFrog)) {
              const t = Date.now() / 700 + (d.phase || 0);
              const hopping = Math.sin(t) > 0.78;
              const frames = hopping ? FROG_JUMP : FROG_IDLE;
              const f = frames[(Math.floor(t * 5) + (d.v || 0)) % frames.length];
              const hop = hopping ? Math.abs(Math.sin(t * 5)) * 5 : 0;
              ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
              ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.premiumFrog, f.sx, f.sy, 32, 32, d.x - 16, d.y - 28 - hop, 32, 32);
            }
          }
          else if (d.type === 'homevendor') {
            const t = Date.now() / 650;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 18, 48, 13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7c3f1d';
            ctx.beginPath(); ctx.roundRect(d.x - 42, d.y - 8, 84, 24, 5); ctx.fill();
            ctx.fillStyle = '#a16207';
            ctx.fillRect(d.x - 38, d.y - 4, 76, 7);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(d.x - 34, d.y + 12, 8, 24);
            ctx.fillRect(d.x + 26, d.y + 12, 8, 24);
            ctx.fillStyle = '#fef3c7';
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(d.x - 32, d.y - 44, 64, 20, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#7c2d12';
            ctx.font = 'bold 9px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('HOME', d.x, d.y - 34);
            drawBabyTurtle(ctx, d.x - 22, d.y - 9 + Math.sin(t) * 1.5, 0.72, '#22c55e');
            drawBabyTurtle(ctx, d.x + 20, d.y - 8 + Math.sin(t + 1.7) * 1.5, 0.66, '#0d9488');
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.arc(d.x + 2, d.y - 11, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(d.x + 2, d.y - 11, 9, 0.2, Math.PI * 1.35); ctx.stroke();
          }
          else if (d.type === 'turtlecove') {
            const t = Date.now() / 800;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 15, 54, 15, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0f766e';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, 48, 19, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#67e8f9';
            ctx.beginPath(); ctx.ellipse(d.x, d.y, 38, 13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(d.x - 6, d.y - 1, 18 + Math.sin(t) * 2, 0.2, Math.PI * 1.15); ctx.stroke();
            drawBabyTurtle(ctx, d.x - 26, d.y - 10 + Math.sin(t) * 2, 0.64, '#16a34a');
            drawBabyTurtle(ctx, d.x + 17, d.y - 12 + Math.sin(t + 2.2) * 2, 0.58, '#15803d');
            ctx.fillStyle = '#a16207';
            ctx.fillRect(d.x - 10, d.y + 10, 20, 22);
            ctx.fillStyle = '#fef3c7';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🐢', d.x, d.y + 24);
          }
          else if (d.type === 'shellhelpers') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 12, 42, 10, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#92400e';
            ctx.fillRect(d.x - 32, d.y - 20, 64, 10);
            ctx.fillRect(d.x - 28, d.y - 2, 56, 8);
            ctx.fillStyle = '#fde68a';
            for (let i = 0; i < 5; i++) {
              ctx.beginPath();
              ctx.arc(d.x - 22 + i * 11, d.y - 25 + (i % 2) * 18, 3, 0, Math.PI * 2);
              ctx.fill();
            }
            drawBabyTurtle(ctx, d.x - 8, d.y + 12, 0.62, '#65a30d');
            drawBabyTurtle(ctx, d.x + 20, d.y + 8, 0.54, '#0f766e');
          }
          else if (d.type === 'rock') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.objects)) {
              drawBottomAnchoredSprite(ctx, Sprites.objects, ROCK_SPRITE, d.x, d.y + 8, 26);
            } else {
              ctx.fillStyle = '#78716c';
              ctx.beginPath(); ctx.ellipse(d.x, d.y, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
            }
          }
          else if (d.type === 'register') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 15, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.roundRect(d.x - 19, d.y - 10, 38, 23, 4); ctx.fill();
            ctx.fillStyle = '#64748b';
            ctx.fillRect(d.x - 13, d.y - 22, 26, 13);
            ctx.fillStyle = '#a7f3d0';
            ctx.fillRect(d.x - 9, d.y - 19, 18, 7);
            ctx.fillStyle = '#e2e8f0';
            for (let i = 0; i < 3; i++) ctx.fillRect(d.x - 12 + i * 9, d.y + 1, 5, 4);
          }
          else if (d.type === 'computer') {
            const t = Date.now() / 500;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 18, 38, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5b3a22';
            ctx.fillRect(d.x - 38, d.y + 4, 76, 12);
            ctx.fillStyle = '#3f2716';
            ctx.fillRect(d.x - 32, d.y + 15, 8, 26);
            ctx.fillRect(d.x + 24, d.y + 15, 8, 26);

            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.roundRect(d.x - 24, d.y - 34, 48, 36, 5); ctx.fill();
            const pulse = 0.72 + Math.sin(t) * 0.18;
            ctx.fillStyle = `rgba(34, 211, 238, ${pulse.toFixed(2)})`;
            ctx.fillRect(d.x - 18, d.y - 28, 36, 24);
            ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
            ctx.fillRect(d.x - 13, d.y - 22, 10, 2);
            ctx.fillRect(d.x - 13, d.y - 15, 22, 2);
            ctx.fillRect(d.x - 13, d.y - 8, 16, 2);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(d.x - 5, d.y + 2, 10, 8);
            ctx.fillRect(d.x - 18, d.y + 10, 36, 8);
          }
          else if (d.type === 'shopDisplay') {
            const w = d.w || 72;
            const h = d.h || 54;
            const x = d.x - w / 2;
            const y = d.y - h;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, w * 0.48, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x + 6, y + 8, w - 12, h - 17);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x + 7, y + h - 11, w - 14, 5);

            const cx = d.x;
            const cy = y + h * 0.48;
            if (d.kind === 'fish') {
              if (spriteReady(Sprites.premiumFish)) {
                ctx.imageSmoothingEnabled = false;
                for (let i = -1; i <= 1; i++) {
                  const f = FISH_ICON_SPRITES[(Math.abs(Math.floor(d.x + d.y)) + i + 1) % FISH_ICON_SPRITES.length];
                  ctx.drawImage(Sprites.premiumFish, f.sx, f.sy, f.sw, f.sh, cx + i * 23 - 13, cy - 12, 26, 26);
                }
              } else {
                ctx.fillStyle = '#38bdf8';
                for (let i = -1; i <= 1; i++) {
                  ctx.beginPath();
                  ctx.ellipse(cx + i * 21, cy, 11, 6, 0, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.beginPath();
                  ctx.moveTo(cx + i * 21 + 10, cy);
                  ctx.lineTo(cx + i * 21 + 18, cy - 6);
                  ctx.lineTo(cx + i * 21 + 18, cy + 6);
                  ctx.closePath();
                  ctx.fill();
                }
              }
            } else if (d.kind === 'surf') {
              ctx.strokeStyle = '#0f766e';
              ctx.lineWidth = 9;
              ctx.lineCap = 'round';
              for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(cx + i * 15, y + h - 10);
                ctx.quadraticCurveTo(cx + i * 18 + 4, cy - 10, cx + i * 13, y + 10);
                ctx.stroke();
              }
            } else if (d.kind === 'icecream') {
              const colors = ['#f9a8d4', '#fde68a', '#bfdbfe'];
              colors.forEach((color, i) => {
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(cx - 24 + i * 24, cy - 4, 10, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#b45309';
                ctx.beginPath();
                ctx.moveTo(cx - 30 + i * 24, cy + 6);
                ctx.lineTo(cx - 18 + i * 24, cy + 6);
                ctx.lineTo(cx - 24 + i * 24, cy + 23);
                ctx.closePath();
                ctx.fill();
              });
            } else if (d.kind === 'juice') {
              const colors = ['#f97316', '#22c55e', '#f43f5e'];
              colors.forEach((color, i) => {
                ctx.fillStyle = color;
                ctx.fillRect(cx - 27 + i * 25, cy - 12, 15, 26);
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(cx - 22 + i * 25, cy - 18, 3, 8);
              });
            } else if (d.kind === 'tackle') {
              ctx.strokeStyle = '#4338ca';
              ctx.lineWidth = 3;
              for (let i = -1; i <= 1; i++) {
                const hx = cx + i * 20;
                ctx.beginPath();
                ctx.arc(hx, cy - 2, 9, 0.2, Math.PI * 1.35);
                ctx.lineTo(hx + 8, cy + 13);
                ctx.stroke();
              }
            } else {
              ctx.fillStyle = '#7c3aed';
              for (let i = -1; i <= 1; i++) {
                const sx = cx + i * 22;
                ctx.beginPath();
                ctx.moveTo(sx, cy - 13);
                ctx.lineTo(sx + 4, cy - 3);
                ctx.lineTo(sx + 15, cy - 3);
                ctx.lineTo(sx + 6, cy + 4);
                ctx.lineTo(sx + 10, cy + 15);
                ctx.lineTo(sx, cy + 8);
                ctx.lineTo(sx - 10, cy + 15);
                ctx.lineTo(sx - 6, cy + 4);
                ctx.lineTo(sx - 15, cy - 3);
                ctx.lineTo(sx - 4, cy - 3);
                ctx.closePath();
                ctx.fill();
              }
            }
          }
          else if (d.type === 'potted') {
            if (spriteReady(Sprites.furniture)) {
              const s = POTTED_PLANTS[d.v % POTTED_PLANTS.length];
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.furniture, s.sx, s.sy, s.sw, s.sh, d.x - 16, d.y - 56, 32, 64);
            }
          }
          else if (d.type === 'coral') {
            // A little cluster of soft rounded fronds around a shared base,
            // gently pulsing so the sea floor doesn't feel static.
            const t = Date.now() / 1000 + (d.seed || 0);
            const n = 4;
            ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + d.seed;
              const bob = Math.sin(t * 1.4 + i) * 2;
              const bx = d.x + Math.cos(a) * 12;
              const by = d.y + Math.sin(a) * 6;
              const r = 8 + (i % 2) * 3;
              ctx.fillStyle = `hsla(${d.hue + i * 8}, 70%, ${60 + i * 3}%, 0.9)`;
              ctx.beginPath();
              ctx.ellipse(bx, by - r + bob, r * 0.7, r, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = `hsla(${d.hue}, 65%, 45%, 0.95)`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
          }
          else if (d.type === 'seaweed') {
            const t = Date.now() / 1000 + (d.seed || 0);
            for (let s = 0; s < d.strands; s++) {
              const ox = (s - (d.strands - 1) / 2) * 8;
              const height = 34 + (s % 2) * 14;
              const sway = Math.sin(t * 1.1 + s * 1.7) * 10;
              ctx.strokeStyle = `hsla(${140 + s * 10}, 55%, ${28 + s * 4}%, 0.85)`;
              ctx.lineWidth = 4;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(d.x + ox, d.y + 4);
              ctx.quadraticCurveTo(d.x + ox + sway * 0.6, d.y - height * 0.5, d.x + ox + sway, d.y - height);
              ctx.stroke();
            }
          }
          else if (d.type === 'shipwreck') {
            // Broken hull silhouette + a leaning mast stump — a teaser piece
            // for a future full sunken-pirate-ship dive site.
            ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 10, 100, 26, 0, 0, Math.PI * 2); ctx.fill();

            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(-0.06);
            // Hull
            ctx.fillStyle = '#3f2a1a';
            ctx.beginPath();
            ctx.moveTo(-110, -10);
            ctx.quadraticCurveTo(-100, 22, -40, 26);
            ctx.lineTo(60, 26);
            ctx.quadraticCurveTo(105, 20, 100, -8);
            ctx.quadraticCurveTo(0, -26, -110, -10);
            ctx.closePath();
            ctx.fill();
            // Broken planking lines
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 2;
            for (let i = -80; i < 90; i += 22) {
              ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i + 8, 24); ctx.stroke();
            }
            // Jagged broken edge
            ctx.fillStyle = '#2b1c11';
            ctx.beginPath();
            ctx.moveTo(-20, -18); ctx.lineTo(-8, -34); ctx.lineTo(4, -14);
            ctx.lineTo(18, -30); ctx.lineTo(30, -12); ctx.closePath();
            ctx.fill();
            // Leaning mast stump
            ctx.strokeStyle = '#4b3320';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(20, -20); ctx.lineTo(46, -68); ctx.stroke();
            ctx.restore();
          }
          else if (d.type === 'raccoonden') {
            // A hollow log den ringed with a little scavenged junk pile —
            // the raccoon hides out here rather than running a storefront.
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 14, 46, 14, 0, 0, Math.PI * 2); ctx.fill();

            // Scavenged junk scattered around the log, using the same
            // recycle sprite frames as ground litter for visual continuity.
            if (spriteReady(Sprites.recycle)) {
              const junkSpots = [[-34, 10], [30, 14], [-14, 20], [16, -2]];
              junkSpots.forEach(([ox, oy], i) => {
                const f = RECYCLE_SPRITES[i % RECYCLE_SPRITES.length];
                ctx.drawImage(Sprites.recycle, f.sx, f.sy, f.sw, f.sh, d.x + ox - 9, d.y + oy - 9, 18, 18);
              });
            }

            // Hollow log
            ctx.fillStyle = '#5b3a22';
            ctx.beginPath(); ctx.ellipse(d.x, d.y, 40, 18, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3f2716';
            ctx.beginPath(); ctx.ellipse(d.x, d.y, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#7a5334';
            ctx.lineWidth = 3;
            for (let i = -1; i <= 1; i++) {
              ctx.beginPath(); ctx.ellipse(d.x, d.y, 40 - i * 10, 18 - i * 5, 0, 0, Math.PI * 2); ctx.stroke();
            }

            // Raccoon peeking out of the log opening, gentle idle bob
            const bob = Math.sin(Date.now() / 500) * 2;
            ctx.save();
            ctx.translate(d.x, d.y - 4 + bob);
            ctx.fillStyle = '#57606a';
            ctx.beginPath(); ctx.ellipse(0, 4, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
            // Ears
            ctx.beginPath(); ctx.ellipse(-9, -8, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(9, -8, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Face mask
            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath(); ctx.ellipse(0, 2, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1f2937';
            ctx.beginPath(); ctx.ellipse(-4, -1, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4, -1, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.beginPath(); ctx.ellipse(0, 5, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
          else if (d.type === 'lamp') {
            // Shadow
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Pole
            ctx.fillStyle = '#334155';
            ctx.fillRect(d.x - 2, d.y - 40, 4, 42);
            // Lamp head
            ctx.fillStyle = '#475569';
            ctx.fillRect(d.x - 8, d.y - 44, 16, 6);
            // Light glow
            ctx.fillStyle = 'rgba(253, 224, 71, 0.3)';
            ctx.beginPath(); ctx.arc(d.x, d.y - 38, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath(); ctx.arc(d.x, d.y - 40, 4, 0, Math.PI * 2); ctx.fill();
          }
          else if (d.type === 'campfire' || d.type === 'grill') {
            const t = Date.now() / 1000;
            if (d.type === 'grill') {
              // Boxy park grill on a post
              ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
              ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#334155';
              ctx.fillRect(d.x - 2, d.y - 10, 4, 14);
              ctx.fillStyle = '#1f2937';
              ctx.fillRect(d.x - 14, d.y - 26, 28, 16);
              ctx.strokeStyle = '#475569';
              ctx.lineWidth = 1.5;
              for (let i = -9; i <= 9; i += 6) {
                ctx.beginPath(); ctx.moveTo(d.x + i, d.y - 24); ctx.lineTo(d.x + i, d.y - 12); ctx.stroke();
              }
            } else {
              // Log ring
              ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
              ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = '#78350f';
              ctx.lineWidth = 5;
              ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(d.x - 12, d.y + 2); ctx.lineTo(d.x + 12, d.y - 4); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(d.x - 12, d.y - 4); ctx.lineTo(d.x + 12, d.y + 2); ctx.stroke();
            }
            // Animated flames (both variants)
            const fy = d.type === 'grill' ? d.y - 28 : d.y - 6;
            const flick = Math.sin(t * 11) * 2;
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(d.x - 7, fy);
            ctx.quadraticCurveTo(d.x - 6, fy - 12 - flick, d.x, fy - 16 + flick);
            ctx.quadraticCurveTo(d.x + 6, fy - 12 + flick, d.x + 7, fy);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.moveTo(d.x - 3.5, fy);
            ctx.quadraticCurveTo(d.x - 3, fy - 6 + flick * 0.5, d.x, fy - 9 - flick * 0.5);
            ctx.quadraticCurveTo(d.x + 3, fy - 6 - flick * 0.5, d.x + 3.5, fy);
            ctx.closePath();
            ctx.fill();
            // Warm glow
            ctx.fillStyle = 'rgba(251, 146, 60, 0.12)';
            ctx.beginPath(); ctx.arc(d.x, fy - 4, 26 + flick, 0, Math.PI * 2); ctx.fill();
          }
          else if (d.type === 'fountain') {
            const t = Date.now() / 1000;
            // Stone basin
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 25, 10, 0, 0, Math.PI * 2); ctx.fill();
            // Pedestal + bowl
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(d.x - 4, d.y - 22, 8, 26);
            ctx.beginPath(); ctx.ellipse(d.x, d.y - 22, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7dd3fc';
            ctx.beginPath(); ctx.ellipse(d.x, d.y - 23, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
            // Spout jet + arcing water
            const h = 12 + Math.sin(t * 6) * 2;
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.9)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(d.x, d.y - 23); ctx.lineTo(d.x, d.y - 23 - h); ctx.stroke();
            ctx.lineWidth = 2;
            for (const s of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(d.x, d.y - 23 - h);
              ctx.quadraticCurveTo(d.x + s * 12, d.y - 24 - h, d.x + s * 16, d.y - 2);
              ctx.stroke();
            }
            // Sparkle droplets
            for (let i = 0; i < 3; i++) {
              const p = ((t * 0.9 + i / 3) % 1);
              ctx.fillStyle = `rgba(224, 242, 254, ${(1 - p).toFixed(2)})`;
              ctx.beginPath();
              ctx.arc(d.x + Math.sin(t * 3 + i * 2.1) * 14, d.y - 20 - h * (1 - p), 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          else if (d.type === 'wardrobe') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 30, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.furnitureWarm)) {
              ctx.imageSmoothingEnabled = false;
              const destW = 40, destH = destW * (WARDROBE_SPRITE.sh / WARDROBE_SPRITE.sw);
              ctx.drawImage(Sprites.furnitureWarm, WARDROBE_SPRITE.sx, WARDROBE_SPRITE.sy, WARDROBE_SPRITE.sw, WARDROBE_SPRITE.sh,
                d.x - destW / 2, d.y + 30 - destH, destW, destH);
            } else {
              // Fallback wooden closet while the sprite sheet is still loading
              ctx.fillStyle = '#92400e';
              ctx.fillRect(d.x - 20, d.y - 34, 40, 62);
              ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
              ctx.strokeRect(d.x - 20, d.y - 34, 40, 62);
            }
          }
          else if (d.type === 'petbed') {
            // Cozy nest where any pet left home (Air Helmet on) naps — drawn
            // half-sunk like everything else down here, with a couple of
            // little bubbles drifting up to sell "underwater".
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 14, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.furnitureWarm)) {
              ctx.imageSmoothingEnabled = false;
              const destW = 44, destH = destW * (PETBED_SPRITE.sh / PETBED_SPRITE.sw);
              ctx.drawImage(Sprites.furnitureWarm, PETBED_SPRITE.sx, PETBED_SPRITE.sy, PETBED_SPRITE.sw, PETBED_SPRITE.sh,
                d.x - destW / 2, d.y + 6 - destH / 2, destW, destH);
            } else {
              ctx.fillStyle = '#a16207';
              ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#fde68a';
              ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 17, 9, 0, 0, Math.PI * 2); ctx.fill();
            }
            if (this.isFlooded) {
              const t = Date.now() / 600;
              ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
              for (let i = 0; i < 2; i++) {
                const by = d.y - 10 - ((t * 14 + i * 10) % 26);
                ctx.beginPath(); ctx.arc(d.x - 10 + i * 18, by, 2, 0, Math.PI * 2); ctx.fill();
              }
            }
          }
          else if (d.type === 'workbench') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 18, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
            if (spriteReady(Sprites.workStation)) {
              ctx.imageSmoothingEnabled = false;
              const destW = 48, destH = 48;
              ctx.drawImage(Sprites.workStation, 0, 0, WORKSTATION_SPRITE.sw, WORKSTATION_SPRITE.sh,
                d.x - destW / 2, d.y + 18 - destH, destW, destH);
            } else {
              // Fallback crafting bench while the sprite sheet is still loading
              ctx.fillStyle = '#78350f';
              ctx.fillRect(d.x - 24, d.y - 8, 48, 8);
              ctx.fillRect(d.x - 20, d.y, 6, 18);
              ctx.fillRect(d.x + 14, d.y, 6, 18);
              ctx.fillStyle = '#a16207';
              ctx.fillRect(d.x - 24, d.y - 12, 48, 6);
            }
          }
          else if (d.type === 'clock') {
            if (spriteReady(Sprites.smallItems)) {
              ctx.imageSmoothingEnabled = false;
              const destW = 24, destH = 24;
              ctx.drawImage(Sprites.smallItems, CLOCK_SPRITE.sx, CLOCK_SPRITE.sy, CLOCK_SPRITE.sw, CLOCK_SPRITE.sh,
                d.x - destW / 2, d.y - destH / 2, destW, destH);
            }
          }
          else if (d.type === 'dogbone') {
            if (spriteReady(Sprites.smallItems)) {
              ctx.imageSmoothingEnabled = false;
              const destW = 16, destH = 16;
              ctx.drawImage(Sprites.smallItems, DOGBONE_SPRITE.sx, DOGBONE_SPRITE.sy, DOGBONE_SPRITE.sw, DOGBONE_SPRITE.sh,
                d.x - destW / 2, d.y - destH / 2, destW, destH);
            }
          }
          else if (d.type === 'homepump') {
            const t = Date.now() / 350;
            if (spriteReady(Sprites.petProps)) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(Sprites.petProps, PET_PROPS_SPRITE.sx + 48, PET_PROPS_SPRITE.sy, 48, 16,
                d.x - 24, d.y - 2, 48, 16);
            }
            ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 12, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.beginPath(); ctx.roundRect(d.x - 14, d.y - 13, 28, 24, 5); ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(d.x - 8, d.y - 20, 16, 8);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(d.x + 16, d.y + 4, 13, Math.PI * 0.1, Math.PI * 1.5);
            ctx.stroke();
            ctx.fillStyle = `rgba(125, 211, 252, ${0.55 + Math.sin(t) * 0.22})`;
            ctx.beginPath(); ctx.arc(d.x + 27, d.y - 6, 3, 0, Math.PI * 2); ctx.fill();
          }
          else if (d.type === 'cattree') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 10, 35, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(d.x - 5, d.y - 78, 10, 86);
            ctx.fillStyle = '#b7793e';
            [[-22, -66, 44, 10], [0, -40, 52, 10], [-16, -14, 50, 10]].forEach(([ox, oy, w, h]) => {
              ctx.beginPath(); ctx.roundRect(d.x + ox - w / 2, d.y + oy, w, h, 5); ctx.fill();
            });
            ctx.strokeStyle = '#d6a15f';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(d.x - 4, d.y - 75); ctx.lineTo(d.x + 5, d.y + 2); ctx.stroke();
            ctx.fillStyle = '#f9a8d4';
            ctx.beginPath(); ctx.arc(d.x + 15, d.y - 50, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#831843';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ฅ', d.x + 15, d.y - 47);
          }
          else if (d.type === 'smallplant') {
            if (spriteReady(Sprites.smallItems)) {
              ctx.imageSmoothingEnabled = false;
              const destW = 20, destH = 20;
              ctx.drawImage(Sprites.smallItems, SMALL_PLANT_SPRITE.sx, SMALL_PLANT_SPRITE.sy, SMALL_PLANT_SPRITE.sw, SMALL_PLANT_SPRITE.sh,
                d.x - destW / 2, d.y - destH, destW, destH);
            }
          }
          else if (d.type === 'sunpatch') {
            const glow = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, 50);
            glow.addColorStop(0, 'rgba(253, 224, 71, 0.34)');
            glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, 58, 28, -0.35, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 34, 14, -0.35, 0, Math.PI * 2); ctx.fill();
          }
          else if (d.type === 'furniture') {
            // Generic lived-in furniture piece from the shared catalog.
            const piece = FURNITURE[d.piece];
            if (!piece) return;
            const sheet = furnitureSheet(piece, this.roomStyle);
            if (!spriteReady(sheet)) return;
            const dw = piece.drawW, dh = dw * (piece.sh / piece.sw);
            ctx.imageSmoothingEnabled = false;
            if (piece.wall) {
              // Hung flush on the north wall, top-anchored at d.y
              ctx.drawImage(sheet, piece.sx, piece.sy, piece.sw, piece.sh, d.x - dw / 2, d.y, dw, dh);
            } else {
              // Soft contact shadow, then bottom-anchored at d.y
              ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
              ctx.beginPath(); ctx.ellipse(d.x, d.y - 2, dw * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill();
              ctx.drawImage(sheet, piece.sx, piece.sy, piece.sw, piece.sh, d.x - dw / 2, d.y - dh, dw, dh);
            }
          }
        }
      });
    });

    // 5b. Sleeping camper (cabin interiors): character asleep in bed with a
    // blanket, floating Zzz, and a wake-meter bar when disturbed.
    if (this.camper) {
      const cm = this.camper;
      const bed = cm.bed || { x: cm.x - 30, y: cm.y - 45, w: 60, h: 90 };
      entities.push({
        y: bed.y + bed.h + 1, // draw after (over) the bed sprite
        draw: (ctx) => {
          const sheet = getCharacterSheet('camper');
          if (sheet) {
            ctx.imageSmoothingEnabled = false;
            // Head pokes out over the pillow at the top of the bed
            ctx.drawImage(sheet, 0, 0, CHAR_CELL, CHAR_CELL,
              bed.x + bed.w / 2 - 32, bed.y - 8, 64, 64);
          }
          // Blanket over the lower body
          ctx.fillStyle = cm.awake ? '#fca5a5' : '#93c5fd';
          ctx.fillRect(bed.x + 5, bed.y + 34, bed.w - 10, bed.h - 44);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(bed.x + 5, bed.y + 34, bed.w - 10, 8);

          if (cm.awake) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 22px Fredoka';
            ctx.textAlign = 'center';
            ctx.fillText('❗', cm.x, cm.y - 66 + Math.sin(Date.now() / 90) * 3);
          } else {
            // Drifting Zzz
            const t = (Date.now() % 2000) / 2000;
            ctx.fillStyle = `rgba(226, 232, 240, ${1 - t})`;
            ctx.font = `${12 + t * 10}px Fredoka`;
            ctx.textAlign = 'center';
            ctx.fillText('z', cm.x + 24 + t * 14, cm.y - 50 - t * 24);
            // Wake meter
            if (cm.wake > 0) {
              ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
              ctx.fillRect(cm.x - 26, cm.y - 78, 52, 8);
              ctx.fillStyle = cm.wake > 66 ? '#ef4444' : cm.wake > 33 ? '#eab308' : '#84cc16';
              ctx.fillRect(cm.x - 25, cm.y - 77, 50 * (cm.wake / 100), 6);
            }
          }
        }
      });
    }

    // 6. Transition points (Bus Stop Signs / Forest Trailheads)
    this.transitionPoints.forEach(tp => {
      if (tp.targetArea === '__exit') return; // interior doors draw as doormats
      const isForest = tp.targetArea === 'woods' || (tp.label && tp.label.includes('Trail'));
      entities.push({
        y: tp.y + tp.h,
        draw: (ctx) => {
          if (isForest) {
            const cx = tp.x + tp.w / 2, cy = tp.y + tp.h - 10;
            // Shadow
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.beginPath(); ctx.ellipse(cx, cy + 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill();

            // Twin tree-trunk archway framing the trail entrance
            ctx.fillStyle = '#78350f';
            ctx.fillRect(cx - 30, cy - 70, 12, 74);
            ctx.fillRect(cx + 18, cy - 70, 12, 74);
            // Leafy canopy caps on each trunk
            ctx.fillStyle = '#166534';
            ctx.beginPath(); ctx.arc(cx - 24, cy - 74, 16, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 24, cy - 74, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(cx - 24, cy - 78, 11, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 24, cy - 78, 11, 0, Math.PI * 2); ctx.fill();

            // Wooden trail sign hanging between the trunks
            ctx.fillStyle = '#a16207';
            ctx.beginPath(); ctx.roundRect(cx - 20, cy - 46, 40, 18, 3); ctx.fill();
            ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5;
            ctx.strokeRect(cx - 20, cy - 46, 40, 18);
            ctx.fillStyle = '#fde68a';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🌲', cx, cy - 37);

            // Floating action bubble above it
            ctx.fillStyle = 'rgba(15, 42, 23, 0.78)';
            ctx.beginPath();
            ctx.roundRect(cx - 58, cy - 100, 116, 22, 6);
            ctx.fill();
            ctx.fillStyle = '#86efac';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(tp.label, cx, cy - 89);
            return;
          }

          // Shadow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
          ctx.beginPath(); ctx.ellipse(tp.x + tp.w/2, tp.y + tp.h - 2, 12, 6, 0, 0, Math.PI * 2); ctx.fill();

          // Bus stop signpost
          ctx.fillStyle = '#475569';
          ctx.fillRect(tp.x + tp.w/2 - 3, tp.y + tp.h - 48, 6, 48);

          // Sign board (round circle on top)
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tp.x + tp.w/2, tp.y + tp.h - 48, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw a small bus icon or 'BUS' text
          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('BUS', tp.x + tp.w/2, tp.y + tp.h - 48);

          // Floating action bubble above it
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.beginPath();
          ctx.roundRect(tp.x + tp.w/2 - 55, tp.y + tp.h - 90, 110, 22, 6);
          ctx.fill();
          ctx.fillStyle = '#22d3ee';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(tp.label, tp.x + tp.w/2, tp.y + tp.h - 79);
        }
      });
    });

    return entities;
  }
}
