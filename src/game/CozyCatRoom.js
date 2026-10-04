import { DiscBase, drawScreenFrame } from './DiscBase.js';

import roomBgUrl from '../assets/cat-game/CatRoomFree/Room1.png';
import furnitureUrl from '../assets/cat-game/CatRoomFree/Furnitures.png';
import blackCatIdleUrl from '../assets/cat-game/AllCatsDemo/BlackCat/IdleCatb.png';
import blackCatJumpUrl from '../assets/cat-game/AllCatsDemo/BlackCat/JumpCabt.png';
import siameseCatIdleUrl from '../assets/cat-game/AllCatsDemo/Siamese/IdleCattt.png';
import siameseCatJumpUrl from '../assets/cat-game/AllCatsDemo/Siamese/JumpCatttt.png';
import whiteCatIdleUrl from '../assets/cat-game/AllCatsDemo/White/IdleCatttt.png';
import whiteCatJumpUrl from '../assets/cat-game/AllCatsDemo/White/JumpCattttt.png';
import treatUrl from '../assets/cat-game/CatMaterialsDEMO/OrangeBall-Sheet.png';

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const ASSETS = {
  room: loadImage(roomBgUrl),
  furniture: loadImage(furnitureUrl),
  treat: loadImage(treatUrl),
  cats: {
    black: { idle: loadImage(blackCatIdleUrl), jump: loadImage(blackCatJumpUrl) },
    siamese: { idle: loadImage(siameseCatIdleUrl), jump: loadImage(siameseCatJumpUrl) },
    white: { idle: loadImage(whiteCatIdleUrl), jump: loadImage(whiteCatJumpUrl) }
  }
};

const CATALOG = [
  { id: 'cat_bed_blue', name: 'Cat Bed', sx: 202, sy: 137, sw: 110, sh: 82, ox: 55, oy: 60, cost: 0 },
  { id: 'cat_tower', name: 'Cat Tower', sx: 191, sy: 16, sw: 64, sh: 110, ox: 32, oy: 90, cost: 0 },
  { id: 'food_bowl', name: 'Food Bowl', sx: 266, sy: 335, sw: 43, sh: 37, ox: 21, oy: 25, cost: 0 },
  { id: 'water_bowl', name: 'Water Bowl', sx: 265, sy: 400, sw: 43, sh: 37, ox: 21, oy: 25, cost: 0 },
  { id: 'plant', name: 'Potted Plant', sx: 140, sy: 298, sw: 45, sh: 108, ox: 22, oy: 95, cost: 0 },
  { id: 'bookshelf', name: 'Bookshelf', sx: 14, sy: 288, sw: 100, sh: 128, ox: 50, oy: 110, cost: 0 },
];

export class CozyCatRoomDisc extends DiscBase {
  constructor(progress) {
    super('cozy_cat_room', progress);
    
    this.grid = Array.from({ length: 5 }, () => Array(5).fill(null));
    if (progress.grid) {
      this.grid = progress.grid;
    }
    
    this.cozyScore = progress.maxScore || 0;
    this.currentSessionScore = 0;
    
    this.cursor = { x: 2, y: 2 };
    this.selectedCatalogIndex = 0;
    this.time = 0;
    
    this.cats = [];
    this.treats = [];
    this.lastCatSpawnTime = 0;
    
    this.touchBtnPrev = { x: 0, y: 0, w: 60, h: 60 };
    this.touchBtnNext = { x: 0, y: 0, w: 60, h: 60 };
    this.touchBtnPlace = { x: 0, y: 0, w: 80, h: 60 };
    this.touchBtnDelete = { x: 0, y: 0, w: 80, h: 60 };
    
    this._listenersBound = false;
    this._handlePointerDown = this.handlePointerDown.bind(this);
  }

  bindListeners() {
    if (this._listenersBound) return;
    window.addEventListener('mousedown', this._handlePointerDown);
    window.addEventListener('touchstart', this._handlePointerDown, { passive: false });
    this._listenersBound = true;
  }

  unbindListeners() {
    if (!this._listenersBound) return;
    window.removeEventListener('mousedown', this._handlePointerDown);
    window.removeEventListener('touchstart', this._handlePointerDown);
    this._listenersBound = false;
  }

  handlePointerDown(e) {
    if (this.done || this.exitRequested) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const checkHit = (btn) => {
      return clientX >= btn.x && clientX <= btn.x + btn.w &&
             clientY >= btn.y && clientY <= btn.y + btn.h;
    };

    if (checkHit(this.touchBtnPrev)) {
      this.cycleSelection(-1);
      if (e.preventDefault) e.preventDefault();
    } else if (checkHit(this.touchBtnNext)) {
      this.cycleSelection(1);
      if (e.preventDefault) e.preventDefault();
    } else if (checkHit(this.touchBtnPlace)) {
      this.placeItem();
      if (e.preventDefault) e.preventDefault();
    } else if (checkHit(this.touchBtnDelete)) {
      this.deleteItem();
      if (e.preventDefault) e.preventDefault();
    }
  }

  cycleSelection(dir) {
    this.selectedCatalogIndex = (this.selectedCatalogIndex + dir + CATALOG.length) % CATALOG.length;
  }

  placeItem() {
    if (this.grid[this.cursor.x][this.cursor.y] === null) {
      this.grid[this.cursor.x][this.cursor.y] = CATALOG[this.selectedCatalogIndex].id;
      this.currentSessionScore += 10;
    }
  }

  deleteItem() {
    if (this.grid[this.cursor.x][this.cursor.y] !== null) {
      this.grid[this.cursor.x][this.cursor.y] = null;
    }
  }

  update(dt, keys, screen) {
    if (this.done || this.exitRequested) {
      this.unbindListeners();
      return;
    }
    
    this.bindListeners();
    this.time += dt;

    if (!this.lastInputTime) this.lastInputTime = 0;
    if (this.time - this.lastInputTime > 0.15) {
      let moved = false;
      if (keys['w'] || keys['arrowup']) { this.cursor.y = Math.max(0, this.cursor.y - 1); moved = true; }
      if (keys['s'] || keys['arrowdown']) { this.cursor.y = Math.min(4, this.cursor.y + 1); moved = true; }
      if (keys['a'] || keys['arrowleft']) { this.cursor.x = Math.max(0, this.cursor.x - 1); moved = true; }
      if (keys['d'] || keys['arrowright']) { this.cursor.x = Math.min(4, this.cursor.x + 1); moved = true; }
      
      if (keys['q']) { this.cycleSelection(-1); moved = true; }
      if (keys['r'] || keys['f']) { this.cycleSelection(1); moved = true; }
      
      if (keys['x'] || keys['backspace']) {
        this.deleteItem();
        moved = true;
      }
      
      if (moved) this.lastInputTime = this.time;
    }

    if (this.cats.length < 3 && this.time - this.lastCatSpawnTime > 8) {
      if (Math.random() > 0.4) {
        this.spawnCat();
      }
      this.lastCatSpawnTime = this.time;
    }

    for (const cat of this.cats) {
      cat.stateTimer -= dt;
      cat.animTimer += dt;
      
      if (cat.state === 'idle' && cat.stateTimer <= 0) {
        cat.state = 'walk';
        cat.stateTimer = 2 + Math.random() * 3;
        cat.targetX = Math.floor(Math.random() * 5);
        cat.targetY = Math.floor(Math.random() * 5);
      } else if (cat.state === 'walk') {
        const dx = cat.targetX - cat.x;
        const dy = cat.targetY - cat.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) {
          cat.x = cat.targetX;
          cat.y = cat.targetY;
          cat.state = 'idle';
          cat.stateTimer = 3 + Math.random() * 5;
          
          if (this.grid[Math.floor(cat.x)][Math.floor(cat.y)] !== null && Math.random() > 0.3) {
             this.treats.push({ x: cat.x, y: cat.y, t: 0 });
          }
        } else {
          cat.x += (dx / dist) * 1.5 * dt;
          cat.y += (dy / dist) * 1.5 * dt;
          cat.flip = dx > 0;
        }
      }
    }

    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      t.t += dt;
      if (Math.abs(t.x - this.cursor.x) < 0.5 && Math.abs(t.y - this.cursor.y) < 0.5) {
        this.currentSessionScore += 5;
        this.treats.splice(i, 1);
      } else if (t.t > 15) {
        this.treats.splice(i, 1);
      }
    }
  }

  spawnCat() {
    const breeds = ['black', 'siamese', 'white'];
    const breed = breeds[Math.floor(Math.random() * breeds.length)];
    this.cats.push({
      breed,
      x: 2, y: 4,
      targetX: 2, targetY: 4,
      state: 'idle',
      stateTimer: 2,
      animTimer: 0,
      flip: false
    });
  }

  onAction() {
    if (this.done) {
      this.exitRequested = true;
      return;
    }
    this.placeItem();
  }

  finish() {
    if (this.done) return;
    this.unbindListeners();
    const oldScore = this.cozyScore;
    this.cozyScore = Math.max(this.cozyScore, this.currentSessionScore);
    const rewardPebbles = Math.min(60, this.currentSessionScore);
    
    this.done = true;
    this.result = {
      score: this.currentSessionScore,
      rewardPebbles: rewardPebbles,
      message: `Room looks great!`,
    };
  }

  serialize() {
    return { grid: this.grid, maxScore: this.cozyScore };
  }

  getIsoPos(gx, gy) {
    const cellW = 44;
    const cellH = 26;
    return {
      x: (gx - gy) * cellW,
      y: (gx + gy - 4) * cellH
    };
  }

  draw(ctx, screen) {
    const w = screen.w;
    const h = screen.h;
    drawScreenFrame(ctx, w, h, 'COZY CAT ROOM', this.meta.accent, this.done ? 'Action: return to desktop' : 'WASD: Move  Q/R: Cycle  Space: Place  X: Remove');

    if (!ASSETS.room.complete || !ASSETS.furniture.complete) return;

    ctx.save();
    
    const mw = w - 40;
    const mh = h - 80;
    const scale = Math.min(1, mw / 512, mh / 512);
    
    const cx = w / 2;
    const cy = h / 2;
    
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    
    ctx.drawImage(ASSETS.room, -256, -256, 512, 512);
    
    let drawables = [];
    
    for (let gx = 0; gx < 5; gx++) {
      for (let gy = 0; gy < 5; gy++) {
        const iso = this.getIsoPos(gx, gy);
        
        if (gx === this.cursor.x && gy === this.cursor.y) {
          drawables.push({
            depth: gx + gy - 0.5,
            draw: () => {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.beginPath();
              ctx.moveTo(iso.x, iso.y - 13);
              ctx.lineTo(iso.x + 44, iso.y);
              ctx.lineTo(iso.x, iso.y + 13);
              ctx.lineTo(iso.x - 44, iso.y);
              ctx.closePath();
              ctx.strokeStyle = 'rgba(244, 114, 182, 0.8)';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          });
          
          if (this.grid[gx][gy] === null) {
            const item = CATALOG[this.selectedCatalogIndex];
            drawables.push({
              depth: gx + gy + 0.1,
              draw: () => {
                ctx.globalAlpha = 0.5;
                ctx.drawImage(ASSETS.furniture, item.sx, item.sy, item.sw, item.sh, iso.x - item.ox, iso.y - item.oy, item.sw, item.sh);
                ctx.globalAlpha = 1.0;
              }
            });
          }
        }
        
        const itemId = this.grid[gx][gy];
        if (itemId) {
          const item = CATALOG.find(i => i.id === itemId);
          if (item) {
            drawables.push({
              depth: gx + gy + 0.1,
              draw: () => {
                ctx.drawImage(ASSETS.furniture, item.sx, item.sy, item.sw, item.sh, iso.x - item.ox, iso.y - item.oy, item.sw, item.sh);
              }
            });
          }
        }
      }
    }

    for (const t of this.treats) {
      const iso = this.getIsoPos(t.x, t.y);
      drawables.push({
        depth: t.x + t.y - 0.2,
        draw: () => {
          const bob = Math.sin(t.t * 5) * 4;
          if (ASSETS.treat.complete) {
            ctx.drawImage(ASSETS.treat, 0, 0, 24, 16, iso.x - 12, iso.y - 8 + bob, 24, 16);
          }
        }
      });
    }

    for (const cat of this.cats) {
      const iso = this.getIsoPos(cat.x, cat.y);
      drawables.push({
        depth: cat.x + cat.y,
        draw: () => {
          let frames = 7;
          let sheet = ASSETS.cats[cat.breed].idle;
          let frameW = 32;
          let frameH = 32;
          
          if (cat.state === 'walk') {
            sheet = ASSETS.cats[cat.breed].jump;
            frames = 13;
          }
          
          if (sheet.complete && sheet.naturalWidth > 0) {
            const frameIdx = Math.floor(cat.animTimer * 10) % frames;
            
            ctx.save();
            ctx.translate(iso.x, iso.y - 10);
            if (cat.flip) ctx.scale(-1, 1);
            
            ctx.drawImage(sheet, frameIdx * frameW, 0, frameW, frameH, -frameW/2, -frameH, frameW, frameH);
            ctx.restore();
          }
        }
      });
    }

    drawables.sort((a, b) => a.depth - b.depth);
    for (const d of drawables) {
      d.draw();
    }
    
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 16px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Cozy Score ${this.currentSessionScore}`, w - 34, 36);
    ctx.fillText(`Best ${this.cozyScore}`, w - 34, 58);
    
    this.touchBtnPrev = { x: w/2 - 160, y: h - 90, w: 60, h: 50 };
    this.touchBtnNext = { x: w/2 - 90,  y: h - 90, w: 60, h: 50 };
    this.touchBtnPlace = { x: w/2 + 20, y: h - 90, w: 80, h: 50 };
    this.touchBtnDelete = { x: w/2 + 110, y: h - 90, w: 80, h: 50 };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const drawBtn = (btn, text, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, btn.x + btn.w/2, btn.y + btn.h/2);
    };

    drawBtn(this.touchBtnPrev, '< Item', '#475569');
    drawBtn(this.touchBtnNext, 'Item >', '#475569');
    drawBtn(this.touchBtnPlace, 'Place', '#f472b6');
    drawBtn(this.touchBtnDelete, 'Remove', '#ef4444');
    
    if (this.done) this.drawResult(ctx, w, h);
    ctx.restore();
  }

  drawResult(ctx, w, h) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 180, h / 2 - 78, 360, 156, 14);
    ctx.fill();
    ctx.strokeStyle = this.meta.accent;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISC EJECTED', w / 2, h / 2 - 44);
    ctx.font = '700 14px SproutPixel, Outfit, sans-serif';
    ctx.fillText(this.result.message, w / 2, h / 2 - 10);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Payout: ${this.result.rewardPebbles} Pebbles`, w / 2, h / 2 + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press Action to close', w / 2, h / 2 + 52);
  }
}
