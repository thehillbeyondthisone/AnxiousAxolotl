import { DiscBase, drawScreenFrame } from './DiscBase.js';

import roomBgUrl from '../assets/cat-game/CatRoomFree/Room1.png';
import furnitureUrl from '../../more assets/cat game/CatMegaFree/CatRoomFree/Furnitures.png';
import catUiUrl from '../../more assets/cat game/CatMegaFree/CatUIFree/free.png';
import mochiIdleUrl from '../../more assets/cat game/CatMegaFree/MochiFree/Idle.png';
import mochiBoxUrl from '../../more assets/cat game/CatMegaFree/MochiFree/Box3.png';
import pochiUrl from '../../more assets/cat game/CatMegaFree/PochiFree/FreeSprites.png';
import blackCatIdleUrl from '../assets/cat-game/AllCatsDemo/BlackCat/IdleCatb.png';
import blackCatJumpUrl from '../assets/cat-game/AllCatsDemo/BlackCat/JumpCabt.png';
import siameseCatIdleUrl from '../assets/cat-game/AllCatsDemo/Siamese/IdleCattt.png';
import siameseCatJumpUrl from '../assets/cat-game/AllCatsDemo/Siamese/JumpCatttt.png';
import whiteCatIdleUrl from '../assets/cat-game/AllCatsDemo/White/IdleCatttt.png';
import whiteCatJumpUrl from '../assets/cat-game/AllCatsDemo/White/JumpCattttt.png';
import treatUrl from '../assets/cat-game/CatMaterialsDEMO/OrangeBall-Sheet.png';

import { loadImage as registeredImage } from './ImageRegistry.js';
const loadImage = src => registeredImage(src, { group: 'cozy_cat_room' });

const ASSETS = {
  room: loadImage(roomBgUrl),
  furniture: loadImage(furnitureUrl),
  catUi: loadImage(catUiUrl),
  mochiIdle: loadImage(mochiIdleUrl),
  mochiBox: loadImage(mochiBoxUrl),
  pochi: loadImage(pochiUrl),
  treat: loadImage(treatUrl),
  cats: {
    black: { idle: loadImage(blackCatIdleUrl), jump: loadImage(blackCatJumpUrl) },
    siamese: { idle: loadImage(siameseCatIdleUrl), jump: loadImage(siameseCatJumpUrl) },
    white: { idle: loadImage(whiteCatIdleUrl), jump: loadImage(whiteCatJumpUrl) },
  },
};

const GRID_W = 6;
const GRID_H = 5;
const CELL_W = 44;
const CELL_H = 26;

const FIXED_WINDOWS = [
  { sx: 19, sy: 0, sw: 61, sh: 95, x: -142, y: -134, w: 50, h: 78 },
  { sx: 115, sy: 0, sw: 61, sh: 95, x: 143, y: -118, w: 50, h: 78 },
  { sx: 460, sy: 194, sw: 39, sh: 89, x: 204, y: -40, w: 34, h: 78 },
];

const ITEM_TYPES = [
  { id: 'bed', name: 'Beds', icon: 'blue_bed' },
  { id: 'perch', name: 'Perches', icon: 'blue_perch' },
  { id: 'scratch', name: 'Posts', icon: 'cream_post' },
  { id: 'bowl', name: 'Bowls', icon: 'blue_water' },
  { id: 'plant', name: 'Plants', icon: 'floor_plant' },
  { id: 'shelf', name: 'Shelves', icon: 'bookshelf' },
  { id: 'stone', name: 'Pebbles', icon: 'teal_stone' },
];

const WISH_LABELS = {
  bed: 'nap',
  food: 'snack',
  scratch: 'scratch',
  perch: 'perch',
  plant: 'leaf',
  shelf: 'shelf',
  pet: 'pat',
};

const FLOOR_ITEMS = [
  { id: 'blue_bed', type: 'bed', name: 'Blue Bed', sx: 202, sy: 137, sw: 110, sh: 82, ox: 55, oy: 62, fw: 2, fh: 2, score: 14, tag: 'bed' },
  { id: 'gray_bed', type: 'bed', name: 'Gray Bed', sx: 329, sy: 137, sw: 110, sh: 82, ox: 55, oy: 62, fw: 2, fh: 2, score: 14, tag: 'bed' },
  { id: 'rose_bed', type: 'bed', name: 'Rose Bed', sx: 202, sy: 235, sw: 110, sh: 82, ox: 55, oy: 62, fw: 2, fh: 2, score: 14, tag: 'bed' },
  { id: 'moss_bed', type: 'bed', name: 'Moss Bed', sx: 329, sy: 235, sw: 110, sh: 82, ox: 55, oy: 62, fw: 2, fh: 2, score: 14, tag: 'bed' },
  { id: 'peach_perch', type: 'perch', name: 'Peach Perch', sx: 191, sy: 16, sw: 64, sh: 110, ox: 32, oy: 98, fw: 1, fh: 1, score: 11, tag: 'perch' },
  { id: 'olive_perch', type: 'perch', name: 'Olive Perch', sx: 287, sy: 15, sw: 64, sh: 110, ox: 32, oy: 98, fw: 1, fh: 1, score: 11, tag: 'perch' },
  { id: 'blue_perch', type: 'perch', name: 'Blue Perch', sx: 383, sy: 15, sw: 64, sh: 110, ox: 32, oy: 98, fw: 1, fh: 1, score: 11, tag: 'perch' },
  { id: 'cream_post', type: 'scratch', name: 'Cream Post', sx: 197, sy: 331, sw: 55, sh: 77, ox: 28, oy: 68, fw: 1, fh: 1, score: 12, tag: 'scratch' },
  { id: 'tan_post', type: 'scratch', name: 'Tan Post', sx: 197, sy: 425, sw: 55, sh: 77, ox: 28, oy: 68, fw: 1, fh: 1, score: 12, tag: 'scratch' },
  { id: 'red_food', type: 'bowl', name: 'Red Kibble', sx: 263, sy: 331, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 8, tag: 'food' },
  { id: 'tan_food', type: 'bowl', name: 'Tan Kibble', sx: 328, sy: 331, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 8, tag: 'food' },
  { id: 'blue_water', type: 'bowl', name: 'Blue Water', sx: 392, sy: 331, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 8, tag: 'food' },
  { id: 'cream_water', type: 'bowl', name: 'Cream Water', sx: 457, sy: 331, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 8, tag: 'food' },
  { id: 'violet_food', type: 'bowl', name: 'Violet Kibble', sx: 262, sy: 396, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 8, tag: 'food' },
  { id: 'white_food', type: 'bowl', name: 'White Kibble', sx: 327, sy: 396, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 8, tag: 'food' },
  { id: 'lavender_bowl', type: 'bowl', name: 'Lavender Bowl', sx: 391, sy: 396, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 7, tag: 'food' },
  { id: 'ice_bowl', type: 'bowl', name: 'Ice Bowl', sx: 456, sy: 396, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 7, tag: 'food' },
  { id: 'rose_bowl', type: 'bowl', name: 'Rose Bowl', sx: 263, sy: 459, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 7, tag: 'food' },
  { id: 'mint_bowl', type: 'bowl', name: 'Mint Bowl', sx: 328, sy: 459, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 7, tag: 'food' },
  { id: 'peach_bowl', type: 'bowl', name: 'Peach Bowl', sx: 392, sy: 459, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 7, tag: 'food' },
  { id: 'sage_bowl', type: 'bowl', name: 'Sage Bowl', sx: 457, sy: 459, sw: 50, sh: 43, ox: 25, oy: 30, fw: 1, fh: 1, score: 7, tag: 'food' },
  { id: 'round_plant', type: 'plant', name: 'Tiny Plant', sx: 140, sy: 238, sw: 32, sh: 44, ox: 16, oy: 38, fw: 1, fh: 1, score: 7, tag: 'plant' },
  { id: 'floor_plant', type: 'plant', name: 'Floor Plant', sx: 141, sy: 298, sw: 45, sh: 110, ox: 22, oy: 98, fw: 1, fh: 1, score: 10, tag: 'plant' },
  { id: 'bookshelf', type: 'shelf', name: 'Cozy Shelf', sx: 14, sy: 288, sw: 100, sh: 128, ox: 50, oy: 110, fw: 2, fh: 1, score: 13, tag: 'shelf' },
  { id: 'teal_stone', type: 'stone', name: 'Teal Pebble', sx: 67, sy: 453, sw: 22, sh: 20, ox: 11, oy: 14, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'green_stones', type: 'stone', name: 'Moss Pebble', sx: 101, sy: 458, sw: 17, sh: 15, ox: 8, oy: 11, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'violet_stone', type: 'stone', name: 'Violet Pebble', sx: 132, sy: 454, sw: 22, sh: 20, ox: 11, oy: 14, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'indigo_stones', type: 'stone', name: 'Indigo Pebble', sx: 166, sy: 459, sw: 17, sh: 15, ox: 8, oy: 11, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'blue_stone', type: 'stone', name: 'Blue Pebble', sx: 67, sy: 486, sw: 22, sh: 20, ox: 11, oy: 14, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'sky_stones', type: 'stone', name: 'Sky Pebble', sx: 101, sy: 490, sw: 17, sh: 15, ox: 8, oy: 11, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'cream_stone', type: 'stone', name: 'Cream Pebble', sx: 132, sy: 487, sw: 22, sh: 20, ox: 11, oy: 14, fw: 1, fh: 1, score: 4, tag: 'stone' },
  { id: 'lime_stones', type: 'stone', name: 'Lime Pebble', sx: 166, sy: 491, sw: 17, sh: 15, ox: 8, oy: 11, fw: 1, fh: 1, score: 4, tag: 'stone' },
];

const STARTER_PLACEMENTS = [];

function itemById(id) {
  return FLOOR_ITEMS.find((item) => item.id === id);
}

function drawSprite(ctx, img, sprite, dx, dy, dw = sprite.sw, dh = sprite.sh) {
  if (!img.complete || !img.naturalWidth) return;
  ctx.drawImage(img, sprite.sx, sprite.sy, sprite.sw, sprite.sh, dx, dy, dw, dh);
}

function rectHit(p, rect) {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

function normalizePlacements(progress) {
  if (progress.layoutVersion !== 2) return STARTER_PLACEMENTS.map((p) => ({ ...p }));

  if (Array.isArray(progress.placements)) {
    return progress.placements
      .filter((p) => itemById(p.id))
      .map((p) => ({ id: p.id, x: p.x | 0, y: p.y | 0 }));
  }

  if (Array.isArray(progress.grid)) {
    const placements = [];
    for (let x = 0; x < progress.grid.length; x++) {
      for (let y = 0; y < (progress.grid[x]?.length || 0); y++) {
        const id = progress.grid[x][y];
        if (itemById(id)) placements.push({ id, x: Math.min(x, GRID_W - 1), y: Math.min(y, GRID_H - 1) });
      }
    }
    if (placements.length) return placements;
  }

  return STARTER_PLACEMENTS.map((p) => ({ ...p }));
}

export class CozyCatRoomDisc extends DiscBase {
  constructor(progress) {
    super('cozy_cat_room', progress);

    this.placements = normalizePlacements(progress);
    this.cozyScore = progress.maxScore || 0;
    this.currentSessionScore = 0;
    this.time = 0;
    this.cats = [];
    this.treats = [];
    this.floaties = [];
    this.effects = [];
    this.lastCatSpawnTime = -8;

    this.layout = null;
    this.buttons = {};
    this.pickerCards = [];
    this.variantCards = [];
    this.pickerMode = 'closed';
    this.selectedTypeId = 'bed';
    this.selectedItemId = progress.selectedItemId && itemById(progress.selectedItemId) ? progress.selectedItemId : null;
    this.pendingPlacement = null;
    this.hoverCell = null;
    this.draggingPlacement = false;
    this.dragMoved = false;
    this.message = 'Build a cozy floor plan for the cats.';

    this._listenersBound = false;
    this._handlePointerDown = this.handlePointerDown.bind(this);
    this._handlePointerMove = this.handlePointerMove.bind(this);
    this._handlePointerUp = this.handlePointerUp.bind(this);
    this._seedCats();
  }

  bindListeners() {
    if (this._listenersBound) return;
    window.addEventListener('mousedown', this._handlePointerDown);
    window.addEventListener('mousemove', this._handlePointerMove);
    window.addEventListener('mouseup', this._handlePointerUp);
    window.addEventListener('touchstart', this._handlePointerDown, { passive: false });
    window.addEventListener('touchmove', this._handlePointerMove, { passive: false });
    window.addEventListener('touchend', this._handlePointerUp, { passive: false });
    this._listenersBound = true;
  }

  unbindListeners() {
    if (!this._listenersBound) return;
    window.removeEventListener('mousedown', this._handlePointerDown);
    window.removeEventListener('mousemove', this._handlePointerMove);
    window.removeEventListener('mouseup', this._handlePointerUp);
    window.removeEventListener('touchstart', this._handlePointerDown);
    window.removeEventListener('touchmove', this._handlePointerMove);
    window.removeEventListener('touchend', this._handlePointerUp);
    this._listenersBound = false;
  }

  pointer(e) {
    const src = e.touches ? e.touches[0] : e.changedTouches ? e.changedTouches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  handlePointerDown(e) {
    if (this.done || this.exitRequested) return;
    const p = this.pointer(e);

    if (this.handleUiPointer(p)) {
      e.preventDefault?.();
      return;
    }

    const cell = this.screenToCell(p);
    if (cell) {
      this.hoverCell = cell;
      const hitPlacement = this.findPlacementAt(cell.x, cell.y);
      if (!this.selectedItemId && !this.pendingPlacement) {
        const hitCat = this.findCatAtPointer(p);
        if (hitCat) {
          this.petCat(hitCat);
          e.preventDefault?.();
          return;
        }
      }
      if (hitPlacement && !this.pendingPlacement) {
        this.pendingPlacement = { ...hitPlacement, moving: true, oldX: hitPlacement.x, oldY: hitPlacement.y };
        this.placements = this.placements.filter((p0) => p0 !== hitPlacement);
        this.selectedItemId = hitPlacement.id;
        this.draggingPlacement = true;
        this.dragMoved = false;
        this.message = 'Drag it, then confirm or cancel.';
      } else if (this.selectedItemId) {
        this.pendingPlacement = { id: this.selectedItemId, x: cell.x, y: cell.y };
        this.draggingPlacement = true;
        this.dragMoved = false;
        this.pickerMode = 'closed';
        this.message = 'Confirm placement when it looks right.';
      }
      e.preventDefault?.();
    }
  }

  handlePointerMove(e) {
    if (this.done || this.exitRequested) return;
    const p = this.pointer(e);
    const cell = this.screenToCell(p);
    this.hoverCell = cell;
    if (this.draggingPlacement && this.pendingPlacement && cell) {
      this.pendingPlacement.x = cell.x;
      this.pendingPlacement.y = cell.y;
      this.dragMoved = true;
      e.preventDefault?.();
    }
  }

  handlePointerUp(e) {
    if (!this.draggingPlacement) return;
    this.draggingPlacement = false;
    e.preventDefault?.();
  }

  handleUiPointer(p) {
    const b = this.buttons;
    if (b.build && rectHit(p, b.build)) {
      this.pickerMode = this.pickerMode === 'closed' ? 'categories' : 'closed';
      this.pendingPlacement = null;
      this.message = 'Choose an item type.';
      return true;
    }
    if (b.confirm && rectHit(p, b.confirm)) {
      this.confirmPlacement();
      return true;
    }
    if (b.cancel && rectHit(p, b.cancel)) {
      this.cancelPlacement();
      return true;
    }
    if (b.remove && rectHit(p, b.remove)) {
      this.removeHoverPlacement();
      return true;
    }
    if (b.back && rectHit(p, b.back)) {
      this.pickerMode = 'categories';
      this.message = 'Choose an item type.';
      return true;
    }
    if (b.closePicker && rectHit(p, b.closePicker)) {
      this.pickerMode = 'closed';
      return true;
    }

    if (this.pickerMode === 'categories') {
      for (const card of this.pickerCards) {
        if (!rectHit(p, card.rect)) continue;
        this.selectedTypeId = card.type.id;
        this.pickerMode = 'variants';
        this.message = `Pick a ${card.type.name.toLowerCase()} style.`;
        return true;
      }
    }

    if (this.pickerMode === 'variants') {
      for (const card of this.variantCards) {
        if (!rectHit(p, card.rect)) continue;
        this.selectedItemId = card.item.id;
        this.pendingPlacement = { id: card.item.id, x: 2, y: 2 };
        this.pickerMode = 'closed';
        this.message = 'Drag the preview onto the floor, then confirm.';
        return true;
      }
    }
    return false;
  }

  confirmPlacement() {
    if (!this.pendingPlacement) return;
    if (!this.canPlace(this.pendingPlacement.id, this.pendingPlacement.x, this.pendingPlacement.y)) {
      this.effects.push({ kind: 'blocked', x: this.pendingPlacement.x, y: this.pendingPlacement.y, t: 0, id: this.pendingPlacement.id });
      this.message = 'That spot is blocked.';
      return;
    }
    const placed = {
      id: this.pendingPlacement.id,
      x: this.pendingPlacement.x,
      y: this.pendingPlacement.y,
    };
    this.placements.push({
      id: placed.id,
      x: placed.x,
      y: placed.y,
    });
    const item = itemById(placed.id);
    this.currentSessionScore += item?.score || 4;
    this.floaties.push({ x: placed.x, y: placed.y, t: 0, kind: 'spark' });
    this.effects.push({ kind: 'place', x: placed.x, y: placed.y, t: 0, id: placed.id });
    this.satisfyNearbyWishes(placed);
    this.pendingPlacement = null;
    this.selectedItemId = null;
    this.message = 'Placed. The room is getting warmer.';
  }

  cancelPlacement() {
    if (this.pendingPlacement?.moving) {
      this.placements.push({
        id: this.pendingPlacement.id,
        x: this.pendingPlacement.oldX,
        y: this.pendingPlacement.oldY,
      });
    }
    this.pendingPlacement = null;
    this.selectedItemId = null;
    this.message = 'Placement canceled.';
  }

  removeHoverPlacement() {
    if (!this.hoverCell) return;
    const hit = this.findPlacementAt(this.hoverCell.x, this.hoverCell.y);
    if (!hit) {
      this.message = 'Hover over a floor item to remove it.';
      return;
    }
    this.placements = this.placements.filter((p) => p !== hit);
    this.effects.push({ kind: 'remove', x: hit.x, y: hit.y, t: 0, id: hit.id });
    this.floaties.push({ x: hit.x, y: hit.y, t: 0, kind: 'poof' });
    this.message = 'Item removed.';
  }

  onAction() {
    if (this.done) {
      this.exitRequested = true;
      return;
    }
    if (this.pendingPlacement) this.confirmPlacement();
    else this.pickerMode = this.pickerMode === 'closed' ? 'categories' : 'closed';
  }

  update(dt, keys) {
    if (this.done || this.exitRequested) {
      this.unbindListeners();
      return;
    }

    this.bindListeners();
    this.time += dt;

    if (keys['escape']) {
      this.pickerMode = 'closed';
      this.cancelPlacement();
    }
    if ((keys['enter'] || keys[' ']) && this.pendingPlacement && (!this.lastKeyTime || this.time - this.lastKeyTime > 0.2)) {
      this.confirmPlacement();
      this.lastKeyTime = this.time;
    }
    if ((keys['x'] || keys['backspace']) && (!this.lastKeyTime || this.time - this.lastKeyTime > 0.2)) {
      this.removeHoverPlacement();
      this.lastKeyTime = this.time;
    }

    if (this.cats.length < 5 && this.time - this.lastCatSpawnTime > 9) {
      this.spawnCat();
      this.lastCatSpawnTime = this.time;
    }

    for (const cat of this.cats) this.updateCat(cat, dt);
    this.updateFloaties(dt);
    this.updateEffects(dt);
  }

  updateCat(cat, dt) {
    cat.stateTimer -= dt;
    cat.animTimer += dt;
    cat.purrTimer -= dt;
    cat.reactionTimer = Math.max(0, cat.reactionTimer - dt);
    cat.wishTimer -= dt;

    if (cat.stateTimer <= 0) {
      if (cat.state === 'walk') this.arriveCat(cat);
      else this.pickCatTarget(cat);
    }

    if (cat.wishTimer <= 0 && !cat.wish) {
      cat.wish = this.pickCatWish(cat);
      cat.wishTimer = 12 + Math.random() * 10;
    }

    if (cat.state === 'walk') {
      const dx = cat.targetX - cat.x;
      const dy = cat.targetY - cat.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.06) {
        cat.x = cat.targetX;
        cat.y = cat.targetY;
        this.arriveCat(cat);
      } else {
        cat.x += (dx / dist) * cat.speed * dt;
        cat.y += (dy / dist) * cat.speed * dt;
        cat.flip = dx > 0;
      }
    }

    if (cat.purrTimer <= 0 && cat.state !== 'walk') {
      this.floaties.push({ x: cat.x, y: cat.y, t: 0, kind: cat.state === 'sleep' ? 'zzz' : 'heart' });
      cat.purrTimer = 2.8 + Math.random() * 2.5;
    }
  }

  arriveCat(cat) {
    const placement = this.findNearestPlacement(cat.x, cat.y);
    const item = placement ? itemById(placement.id) : null;
    const tag = item?.tag || '';
    cat.state = this.stateForCatAndTag(cat, tag);
    cat.stateTimer = 3 + Math.random() * 4;
    if (item && cat.wish === item.tag) this.satisfyCatWish(cat, item.tag, 4);

    if (item && Math.random() > 0.55) {
      this.treats.push({ x: cat.x, y: cat.y, t: 0 });
      this.currentSessionScore += Math.max(1, Math.floor((item.score || 4) / 5));
    }
  }

  stateForCatAndTag(cat, tag) {
    if (cat.breed === 'mochi' && tag === 'bed' && Math.random() > 0.35) return 'box';
    if (cat.breed === 'pochi' && tag === 'food') return 'eat';
    if (tag === 'bed') return 'sleep';
    if (tag === 'scratch' || tag === 'perch') return 'play';
    if (tag === 'food') return 'eat';
    if (tag === 'plant' || tag === 'shelf') return 'sit';
    return Math.random() > 0.7 ? 'sit' : 'idle';
  }

  pickCatTarget(cat) {
    const favorites = this.findFavoriteSpots(cat);
    const spot = favorites.length && Math.random() > 0.25
      ? favorites[Math.floor(Math.random() * favorites.length)]
      : this.randomCatFloorSpot();
    cat.targetX = spot.x;
    cat.targetY = spot.y;
    cat.state = 'walk';
    cat.stateTimer = 4;
  }

  findFavoriteSpots(cat) {
    const wants = cat.favoriteTags || [];
    return this.placements
      .filter((p) => wants.includes(itemById(p.id)?.tag))
      .map((p) => ({ x: p.x + 0.25, y: Math.max(2.15, p.y + 0.35) }));
  }

  updateFloaties(dt) {
    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      t.t += dt;
      if (t.t > 15) this.treats.splice(i, 1);
    }
    for (let i = this.floaties.length - 1; i >= 0; i--) {
      this.floaties[i].t += dt;
      if (this.floaties[i].t > 1.8) this.floaties.splice(i, 1);
    }
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].t += dt;
      if (this.effects[i].t > 0.7) this.effects.splice(i, 1);
    }
  }

  _seedCats() {
    this.cats.push(this.makeCat('mochi', 2.2, 3.5));
    this.cats.push(this.makeCat('pochi', 4.6, 3.7));
    this.cats.push(this.makeCat('black', 3.3, 3.15));
  }

  spawnCat() {
    const breeds = ['black', 'siamese', 'white', 'mochi', 'pochi'];
    const breed = breeds[Math.floor(Math.random() * breeds.length)];
    const spot = this.randomCatFloorSpot();
    this.cats.push(this.makeCat(breed, spot.x, spot.y));
  }

  randomCatFloorSpot() {
    return {
      x: 1.2 + Math.random() * (GRID_W - 2.4),
      y: 2.35 + Math.random() * (GRID_H - 2.6),
    };
  }

  makeCat(breed, x, y) {
    const favorites = {
      mochi: ['bed', 'shelf', 'plant'],
      pochi: ['food', 'scratch', 'perch'],
      black: ['scratch', 'plant'],
      siamese: ['bed', 'perch'],
      white: ['food', 'bed'],
    };
    return {
      breed,
      x,
      y,
      targetX: x,
      targetY: y,
      state: 'idle',
      stateTimer: 1 + Math.random() * 2,
      animTimer: 0,
      purrTimer: 1 + Math.random() * 2,
      wishTimer: 2 + Math.random() * 4,
      wish: null,
      reactionTimer: 0,
      flip: false,
      speed: breed === 'pochi' ? 1.3 : 1.05,
      favoriteTags: favorites[breed] || ['bed'],
    };
  }

  finish() {
    if (this.done) return;
    this.unbindListeners();
    this.cozyScore = Math.max(this.cozyScore, this.currentSessionScore);
    this.done = true;
    this.result = {
      score: this.currentSessionScore,
      rewardPebbles: Math.min(60, this.currentSessionScore),
      message: 'Room saved. The cats approve.',
    };
  }

  serialize() {
    return {
      placements: this.placements,
      layoutVersion: 2,
      maxScore: Math.max(this.cozyScore, this.currentSessionScore),
      selectedTypeId: this.selectedTypeId,
      selectedItemId: this.selectedItemId,
    };
  }

  findPlacementAt(x, y) {
    for (let i = this.placements.length - 1; i >= 0; i--) {
      const p = this.placements[i];
      const item = itemById(p.id);
      if (!item) continue;
      if (x >= p.x && x < p.x + item.fw && y >= p.y && y < p.y + item.fh) return p;
    }
    return null;
  }

  findNearestPlacement(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const p of this.placements) {
      const item = itemById(p.id);
      if (!item) continue;
      const cx = p.x + item.fw / 2;
      const cy = p.y + item.fh / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return bestDist < 1.35 ? best : null;
  }

  findCatAtPointer(p) {
    const local = this.screenToRoom(p);
    if (!local) return null;
    for (let i = this.cats.length - 1; i >= 0; i--) {
      const cat = this.cats[i];
      const iso = this.getIsoPos(cat.x, cat.y);
      const hit = this.catHitBox(cat, iso);
      if (local.x >= hit.x && local.x <= hit.x + hit.w && local.y >= hit.y && local.y <= hit.y + hit.h) return cat;
    }
    return null;
  }

  catHitBox(cat, iso) {
    if (cat.breed === 'pochi') return { x: iso.x - 28, y: iso.y - 42, w: 56, h: 42 };
    return { x: iso.x - 20, y: iso.y - 40, w: 40, h: 40 };
  }

  petCat(cat) {
    cat.state = cat.breed === 'pochi' ? 'play' : 'sit';
    cat.stateTimer = 1.6 + Math.random() * 1.2;
    cat.animTimer = 0;
    cat.purrTimer = 2.2;
    cat.reactionTimer = 0.45;
    this.floaties.push({ x: cat.x, y: cat.y, t: 0, kind: 'heart' });
    this.currentSessionScore += 1;
    if (cat.wish === 'pet') this.satisfyCatWish(cat, 'pet', 5);
    else this.message = 'Pat pat. A tiny purr answers.';
  }

  pickCatWish(cat) {
    const wishes = [...(cat.favoriteTags || []), 'pet'];
    return wishes[Math.floor(Math.random() * wishes.length)];
  }

  satisfyNearbyWishes(placement) {
    const item = itemById(placement.id);
    if (!item) return;
    for (const cat of this.cats) {
      if (cat.wish !== item.tag) continue;
      const d = Math.hypot(cat.x - (placement.x + item.fw / 2), cat.y - (placement.y + item.fh / 2));
      if (d < 2.5) this.satisfyCatWish(cat, item.tag, 6);
    }
  }

  satisfyCatWish(cat, wish, score) {
    cat.wish = null;
    cat.wishTimer = 10 + Math.random() * 8;
    cat.reactionTimer = 0.55;
    cat.state = wish === 'food' ? 'eat' : wish === 'bed' ? 'sleep' : wish === 'pet' ? 'play' : 'sit';
    cat.stateTimer = 2.5;
    this.currentSessionScore += score;
    this.floaties.push({ x: cat.x, y: cat.y, t: 0, kind: 'wish', text: `+${score}` });
    this.message = `${WISH_LABELS[wish] || 'wish'} wish fulfilled.`;
  }

  canPlace(id, x, y) {
    const item = itemById(id);
    if (!item) return false;
    if (x < 0 || y < 0 || x + item.fw > GRID_W || y + item.fh > GRID_H) return false;
    for (const p of this.placements) {
      const other = itemById(p.id);
      if (!other) continue;
      const separated = x + item.fw <= p.x || p.x + other.fw <= x || y + item.fh <= p.y || p.y + other.fh <= y;
      if (!separated) return false;
    }
    return true;
  }

  getIsoPos(gx, gy) {
    return {
      x: (gx - gy) * CELL_W,
      y: (gx + gy - 4) * CELL_H,
    };
  }

  screenToRoom(p) {
    if (!this.layout) return null;
    return {
      x: (p.x - this.layout.cx) / this.layout.scale,
      y: (p.y - this.layout.cy) / this.layout.scale,
    };
  }

  screenToCell(p) {
    const local = this.screenToRoom(p);
    if (!local) return null;
    let best = null;
    let bestDist = Infinity;
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        const iso = this.getIsoPos(x, y);
        const dx = Math.abs(local.x - iso.x) / CELL_W;
        const dy = Math.abs(local.y - iso.y) / (CELL_H / 2);
        if (dx + dy <= 1.05) {
          const d = dx + dy;
          if (d < bestDist) {
            best = { x, y };
            bestDist = d;
          }
        }
      }
    }
    return best;
  }

  draw(ctx, screen) {
    const w = screen.w;
    const h = screen.h;
    drawScreenFrame(ctx, w, h, 'CAT ROOM', this.meta.accent, '');

    const scale = Math.min(1, (w - 96) / 640, (h - 178) / 540);
    const cx = w / 2;
    const cy = Math.min(h - 116, Math.max(318, h / 2 + 16));
    this.layout = { scale, cx, cy };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    this.drawRoom(ctx);
    this.drawFloorContents(ctx);
    ctx.restore();

    this.drawBuildUi(ctx, w, h);
    if (this.done) this.drawResult(ctx, w, h);
  }

  drawRoom(ctx) {
    if (ASSETS.room.complete && ASSETS.room.naturalWidth) {
      ctx.drawImage(ASSETS.room, -256, -256, 512, 512);
    }
    for (const win of FIXED_WINDOWS) {
      drawSprite(ctx, ASSETS.furniture, win, win.x, win.y, win.w, win.h);
    }
  }

  drawFloorContents(ctx) {
    const drawables = [];
    const preview = this.pendingPlacement || (this.hoverCell && this.selectedItemId ? { id: this.selectedItemId, x: this.hoverCell.x, y: this.hoverCell.y, ghost: true } : null);

    for (const p of this.placements) {
      const item = itemById(p.id);
      if (!item) continue;
      drawables.push({ depth: p.x + p.y + item.fh, draw: () => this.drawPlacedItem(ctx, item, p, 1) });
    }

    if (preview) {
      const item = itemById(preview.id);
      const ok = this.canPlace(preview.id, preview.x, preview.y);
      drawables.push({
        depth: preview.x + preview.y + (item?.fh || 1) + 0.2,
        draw: () => {
          this.drawFootprint(ctx, preview, ok);
          if (item) this.drawPlacedItem(ctx, item, preview, ok ? 0.62 : 0.38);
        },
      });
    } else if (this.hoverCell) {
      drawables.push({ depth: this.hoverCell.x + this.hoverCell.y + 0.1, draw: () => this.drawCellDiamond(ctx, this.hoverCell, 'rgba(255,255,255,0.18)', 'rgba(244,114,182,0.62)') });
    }

    for (const t of this.treats) {
      drawables.push({ depth: t.x + t.y + 0.2, draw: () => this.drawTreat(ctx, t) });
    }

    for (const fx of this.effects) {
      drawables.push({ depth: fx.x + fx.y + 0.35, draw: () => this.drawEffect(ctx, fx) });
    }

    for (const cat of this.cats) {
      drawables.push({ depth: cat.x + cat.y + 0.45, draw: () => this.drawCat(ctx, cat) });
      if (cat.wish) drawables.push({ depth: cat.x + cat.y + 0.8, draw: () => this.drawCatWish(ctx, cat) });
    }

    for (const f of this.floaties) {
      drawables.push({ depth: f.x + f.y + 0.5, draw: () => this.drawFloaty(ctx, f) });
    }

    drawables.sort((a, b) => a.depth - b.depth);
    for (const d of drawables) d.draw();
  }

  drawPlacedItem(ctx, item, placement, alpha) {
    const iso = this.getIsoPos(placement.x + (item.fw - 1) * 0.5, placement.y + item.fh - 1);
    const placedFx = this.effects.find((fx) => fx.kind === 'place' && fx.id === placement.id && fx.x === placement.x && fx.y === placement.y);
    const pop = placedFx ? Math.sin(Math.min(1, placedFx.t / 0.35) * Math.PI) * 0.12 : 0;
    const bob = item.tag === 'plant' ? Math.sin(this.time * 1.8 + iso.x * 0.02) * 1.2 : 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (pop) {
      ctx.translate(iso.x, iso.y + bob);
      ctx.scale(1 + pop, 1 + pop);
      drawSprite(ctx, ASSETS.furniture, item, -item.ox, -item.oy);
    } else {
      drawSprite(ctx, ASSETS.furniture, item, iso.x - item.ox, iso.y - item.oy + bob);
    }
    ctx.restore();
  }

  drawFootprint(ctx, placement, ok) {
    const item = itemById(placement.id);
    if (!item) return;
    for (let x = placement.x; x < placement.x + item.fw; x++) {
      for (let y = placement.y; y < placement.y + item.fh; y++) {
        this.drawCellDiamond(ctx, { x, y }, ok ? 'rgba(74, 222, 128, 0.20)' : 'rgba(239, 68, 68, 0.22)', ok ? 'rgba(74, 222, 128, 0.82)' : 'rgba(248, 113, 113, 0.9)');
      }
    }
  }

  drawCellDiamond(ctx, cell, fill, stroke) {
    const iso = this.getIsoPos(cell.x, cell.y);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(iso.x, iso.y - CELL_H / 2);
    ctx.lineTo(iso.x + CELL_W, iso.y);
    ctx.lineTo(iso.x, iso.y + CELL_H / 2);
    ctx.lineTo(iso.x - CELL_W, iso.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawTreat(ctx, t) {
    const iso = this.getIsoPos(t.x, t.y);
    const bob = Math.sin(t.t * 5) * 4;
    if (ASSETS.treat.complete) {
      ctx.drawImage(ASSETS.treat, 0, 0, 24, 16, iso.x - 12, iso.y - 18 + bob, 24, 16);
    }
  }

  drawEffect(ctx, fx) {
    const iso = this.getIsoPos(fx.x, fx.y);
    const alpha = Math.max(0, 1 - fx.t / 0.7);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (fx.kind === 'blocked') {
      const pulse = 1 + Math.sin(fx.t * 28) * 0.08;
      ctx.translate(iso.x, iso.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -CELL_H / 2);
      ctx.lineTo(CELL_W, 0);
      ctx.lineTo(0, CELL_H / 2);
      ctx.lineTo(-CELL_W, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const radius = fx.kind === 'remove' ? 10 + fx.t * 22 : 7 + fx.t * 16;
      ctx.strokeStyle = fx.kind === 'remove' ? '#d8bca0' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(iso.x, iso.y - 6, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + fx.t * 4;
        const r = radius * 0.7;
        ctx.fillStyle = fx.kind === 'remove' ? '#fff1c8' : '#f472b6';
        ctx.fillRect(iso.x + Math.cos(a) * r, iso.y - 7 + Math.sin(a) * r * 0.5, 2, 2);
      }
    }
    ctx.restore();
  }

  drawFloaty(ctx, f) {
    const iso = this.getIsoPos(f.x, f.y);
    const lift = f.t * 28;
    const alpha = Math.max(0, 1 - f.t / 1.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 18px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.kind === 'zzz' ? '#8bb4d8' : f.kind === 'poof' ? '#d8bca0' : '#f472b6';
    ctx.fillText(f.text || (f.kind === 'zzz' ? 'Z' : f.kind === 'spark' ? '+' : f.kind === 'poof' ? '*' : '<3'), iso.x, iso.y - 44 - lift);
    ctx.restore();
  }

  drawCatWish(ctx, cat) {
    const iso = this.getIsoPos(cat.x, cat.y);
    const label = WISH_LABELS[cat.wish] || cat.wish;
    const bob = Math.sin(this.time * 3 + cat.x) * 2;
    const y = iso.y - (cat.breed === 'pochi' ? 58 : 50) + bob;
    ctx.save();
    ctx.font = '700 10px SproutPixel, Outfit, sans-serif';
    const width = Math.max(34, ctx.measureText(label).width + 14);
    ctx.fillStyle = 'rgba(255, 241, 200, 0.92)';
    ctx.strokeStyle = 'rgba(109, 66, 60, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(iso.x - width / 2, y - 14, width, 20, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6d423c';
    ctx.textAlign = 'center';
    ctx.fillText(label, iso.x, y);
    ctx.restore();
  }

  drawCat(ctx, cat) {
    const iso = this.getIsoPos(cat.x, cat.y);
    if (cat.breed === 'mochi') return this.drawMochi(ctx, cat, iso);
    if (cat.breed === 'pochi') return this.drawPochi(ctx, cat, iso);
    return this.drawDemoCat(ctx, cat, iso);
  }

  drawMochi(ctx, cat, iso) {
    const useBox = cat.state === 'box' || cat.state === 'sleep';
    const sheet = useBox ? ASSETS.mochiBox : ASSETS.mochiIdle;
    const frames = useBox ? 4 : 10;
    const frame = Math.floor(cat.animTimer * (useBox ? 4 : 8)) % frames;
    ctx.save();
    const hop = cat.reactionTimer > 0 ? Math.sin((cat.reactionTimer / 0.55) * Math.PI) * 5 : 0;
    const squash = cat.reactionTimer > 0 ? Math.sin((cat.reactionTimer / 0.55) * Math.PI) * 0.08 : 0;
    ctx.translate(iso.x, iso.y - 7 - hop);
    ctx.scale(1 + squash, 1 - squash * 0.5);
    if (cat.flip) ctx.scale(-1, 1);
    if (sheet.complete) ctx.drawImage(sheet, frame * 32, 0, 32, 32, -17, -30, 34, 34);
    ctx.restore();
  }

  drawPochi(ctx, cat, iso) {
    const row = cat.state === 'sleep' ? 2 : cat.state === 'eat' ? 3 : cat.state === 'play' ? 1 : 0;
    const frames = row === 1 ? 2 : 4;
    const frame = Math.floor(cat.animTimer * 6) % frames;
    ctx.save();
    const hop = cat.reactionTimer > 0 ? Math.sin((cat.reactionTimer / 0.55) * Math.PI) * 5 : 0;
    const squash = cat.reactionTimer > 0 ? Math.sin((cat.reactionTimer / 0.55) * Math.PI) * 0.08 : 0;
    ctx.translate(iso.x, iso.y + 1 - hop);
    ctx.scale(1 + squash, 1 - squash * 0.5);
    if (cat.flip) ctx.scale(-1, 1);
    if (ASSETS.pochi.complete) ctx.drawImage(ASSETS.pochi, frame * 64, row * 32, 64, 32, -32, -30, 64, 32);
    ctx.restore();
  }

  drawDemoCat(ctx, cat, iso) {
    let frames = 7;
    let sheet = ASSETS.cats[cat.breed].idle;
    if (cat.state === 'walk' || cat.state === 'play') {
      sheet = ASSETS.cats[cat.breed].jump;
      frames = 13;
    }
    if (!sheet.complete || !sheet.naturalWidth) return;
    const frameIdx = Math.floor(cat.animTimer * 10) % frames;
    ctx.save();
    const hop = cat.reactionTimer > 0 ? Math.sin((cat.reactionTimer / 0.55) * Math.PI) * 5 : 0;
    const squash = cat.reactionTimer > 0 ? Math.sin((cat.reactionTimer / 0.55) * Math.PI) * 0.08 : 0;
    ctx.translate(iso.x, iso.y - 8 - hop);
    ctx.scale(1 + squash, 1 - squash * 0.5);
    if (cat.flip) ctx.scale(-1, 1);
    ctx.drawImage(sheet, frameIdx * 32, 0, 32, 32, -16, -30, 32, 32);
    ctx.restore();
  }

  drawBuildUi(ctx, w, h) {
    const safeBottom = h - 30;
    this.buttons = {};
    this.pickerCards = [];
    this.variantCards = [];

    const build = { x: w / 2 - 74, y: safeBottom - 58, w: 148, h: 46 };
    this.buttons.build = build;
    this.drawPanelButton(ctx, build, this.pickerMode === 'closed' ? 'BUILD' : 'CLOSE', '#f5d2c6');

    if (this.pendingPlacement) {
      this.buttons.cancel = { x: build.x - 132, y: build.y, w: 112, h: 46 };
      this.buttons.confirm = { x: build.x + build.w + 20, y: build.y, w: 124, h: 46 };
      this.drawPanelButton(ctx, this.buttons.cancel, 'CANCEL', '#b8a39d');
      this.drawPanelButton(ctx, this.buttons.confirm, 'CONFIRM', '#a9d18e');
    } else {
      this.buttons.remove = { x: build.x + build.w + 20, y: build.y, w: 112, h: 46 };
      this.drawPanelButton(ctx, this.buttons.remove, 'REMOVE', '#d9a19b');
    }

    ctx.save();
    ctx.font = '700 13px SproutPixel, Outfit, sans-serif';
    ctx.fillStyle = '#fff1c8';
    ctx.textAlign = 'center';
    ctx.fillText(this.message, w / 2, build.y - 14);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'right';
    ctx.fillText(`Cozy ${this.currentSessionScore}`, w - 34, 72);
    ctx.restore();

    if (this.pickerMode === 'categories') this.drawCategoryPicker(ctx, w, h);
    if (this.pickerMode === 'variants') this.drawVariantPicker(ctx, w, h);
  }

  drawCategoryPicker(ctx, w, h) {
    const panel = { x: w / 2 - 330, y: h - 246, w: 660, h: 132 };
    this.drawUiPanel(ctx, panel);
    ctx.save();
    ctx.fillStyle = '#fff1c8';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Choose Item Type', panel.x + 22, panel.y + 26);
    this.buttons.closePicker = { x: panel.x + panel.w - 44, y: panel.y + 12, w: 28, h: 28 };
    this.drawPanelButton(ctx, this.buttons.closePicker, 'x', '#d9a19b', 12);

    let x = panel.x + 20;
    const y = panel.y + 44;
    for (const type of ITEM_TYPES) {
      const rect = { x, y, w: 82, h: 70 };
      this.pickerCards.push({ type, rect });
      this.drawItemCard(ctx, rect, itemById(type.icon), type.name, type.id === this.selectedTypeId);
      x += 90;
    }
    ctx.restore();
  }

  drawVariantPicker(ctx, w, h) {
    const variants = FLOOR_ITEMS.filter((item) => item.type === this.selectedTypeId);
    const rows = variants.length > 8 ? 2 : 1;
    const panel = { x: w / 2 - 364, y: h - (rows === 2 ? 316 : 246), w: 728, h: rows === 2 ? 202 : 132 };
    this.drawUiPanel(ctx, panel);
    ctx.save();
    ctx.fillStyle = '#fff1c8';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'left';
    const typeName = ITEM_TYPES.find((t) => t.id === this.selectedTypeId)?.name || 'Items';
    ctx.fillText(typeName, panel.x + 58, panel.y + 26);
    this.buttons.back = { x: panel.x + 18, y: panel.y + 12, w: 28, h: 28 };
    this.buttons.closePicker = { x: panel.x + panel.w - 44, y: panel.y + 12, w: 28, h: 28 };
    this.drawPanelButton(ctx, this.buttons.back, '<', '#d6c0a8', 12);
    this.drawPanelButton(ctx, this.buttons.closePicker, 'x', '#d9a19b', 12);

    variants.forEach((item, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      const rect = { x: panel.x + 18 + col * 88, y: panel.y + 44 + row * 70, w: 80, h: 64 };
      this.variantCards.push({ item, rect });
      this.drawItemCard(ctx, rect, item, item.name, item.id === this.selectedItemId);
    });
    ctx.restore();
  }

  drawUiPanel(ctx, panel) {
    ctx.save();
    ctx.fillStyle = 'rgba(37, 24, 20, 0.94)';
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.82)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 12);
    ctx.fill();
    ctx.stroke();
    if (ASSETS.catUi.complete && ASSETS.catUi.naturalWidth) {
      ctx.drawImage(ASSETS.catUi, 0, 32, 32, 28, panel.x + 10, panel.y - 20, 42, 36);
      ctx.drawImage(ASSETS.catUi, 40, 31, 35, 32, panel.x + panel.w - 54, panel.y - 22, 46, 40);
    }
    ctx.restore();
  }

  drawItemCard(ctx, rect, item, label, selected) {
    ctx.save();
    ctx.fillStyle = selected ? 'rgba(244, 114, 182, 0.28)' : 'rgba(255, 238, 196, 0.12)';
    ctx.strokeStyle = selected ? '#f472b6' : 'rgba(255, 238, 196, 0.22)';
    ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.stroke();
    if (item) {
      const scale = Math.min(0.5, 42 / Math.max(item.sw, item.sh));
      const dw = item.sw * scale;
      const dh = item.sh * scale;
      drawSprite(ctx, ASSETS.furniture, item, rect.x + rect.w / 2 - dw / 2, rect.y + 8 + (34 - dh) / 2, dw, dh);
    }
    ctx.fillStyle = '#fff1c8';
    ctx.font = '700 10px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h - 10);
    ctx.restore();
  }

  drawPanelButton(ctx, rect, label, color, fontSize = 15) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#6d423c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2724';
    ctx.font = `700 ${fontSize}px SproutPixel, Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.restore();
  }

  drawResult(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(37, 24, 20, 0.92)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 190, h / 2 - 82, 380, 164, 14);
    ctx.fill();
    ctx.strokeStyle = this.meta.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff1c8';
    ctx.font = '700 20px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROOM SAVED', w / 2, h / 2 - 44);
    ctx.font = '700 14px SproutPixel, Outfit, sans-serif';
    ctx.fillText(this.result.message, w / 2, h / 2 - 10);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Payout: ${this.result.rewardPebbles} Pebbles`, w / 2, h / 2 + 22);
    ctx.fillStyle = '#d8bca0';
    ctx.fillText('Press Action to close', w / 2, h / 2 + 52);
    ctx.restore();
  }
}
