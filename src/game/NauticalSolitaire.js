import { DiscBase, drawScreenFrame } from './DiscBase.js';

import cardFacesUrl from '../../more assets/nautical cards/NauticalCards.png';
import cardBackUrl from '../../more assets/nautical cards/Backside/DefaultNautical.png';
import wavesBackUrl from '../../more assets/nautical cards/Backside/Waves.png';
import turtleBackUrl from '../../more assets/nautical cards/Backside/Turtle.png';
import sextantBackUrl from '../../more assets/nautical cards/Backside/SplitSextant.png';
import bg1BaseUrl from '../../more assets/backgrounds/background 1/orig_big.png';
import bg1Layer1Url from '../../more assets/backgrounds/background 1/1.png';
import bg1Layer2Url from '../../more assets/backgrounds/background 1/2.png';
import bg1Layer3Url from '../../more assets/backgrounds/background 1/3.png';
import bg1Layer4Url from '../../more assets/backgrounds/background 1/4.png';
import bg1Layer5Url from '../../more assets/backgrounds/background 1/5.png';
import bg2BaseUrl from '../../more assets/backgrounds/background 2/orig_big.png';
import bg2Layer1Url from '../../more assets/backgrounds/background 2/1.png';
import bg2Layer2Url from '../../more assets/backgrounds/background 2/2.png';
import bg2Layer3Url from '../../more assets/backgrounds/background 2/3.png';
import bg2Layer4Url from '../../more assets/backgrounds/background 2/4.png';
import bg2Layer5Url from '../../more assets/backgrounds/background 2/5.png';
import bg3BaseUrl from '../../more assets/backgrounds/background 3/orig_big.png';
import bg3Layer1Url from '../../more assets/backgrounds/background 3/1.png';
import bg3Layer2Url from '../../more assets/backgrounds/background 3/2.png';
import bg3Layer3Url from '../../more assets/backgrounds/background 3/3.png';
import bg3Layer4Url from '../../more assets/backgrounds/background 3/4.png';
import bg3Layer5Url from '../../more assets/backgrounds/background 3/5.png';
import bg3Layer6Url from '../../more assets/backgrounds/background 3/6.png';
import bg4BaseUrl from '../../more assets/backgrounds/background 4/orig_big.png';
import bg4Layer1Url from '../../more assets/backgrounds/background 4/1.png';
import bg4Layer2Url from '../../more assets/backgrounds/background 4/2.png';
import bg4Layer3Url from '../../more assets/backgrounds/background 4/3.png';
import bg4Layer4Url from '../../more assets/backgrounds/background 4/4.png';

import { loadImage as registeredImage } from './ImageRegistry.js';
const loadImage = src => registeredImage(src, { group: 'nautical_solitaire' });

const FACE_SHEET = loadImage(cardFacesUrl);
const CARD_BACK = loadImage(cardBackUrl);
const BACK_VARIANTS = {
  default: loadImage(cardBackUrl),
  waves: loadImage(wavesBackUrl),
  turtle: loadImage(turtleBackUrl),
  sextant: loadImage(sextantBackUrl),
};
const SCENE_BACKGROUNDS = {
  tidepool: {
    base: loadImage(bg1BaseUrl),
    layers: [bg1Layer1Url, bg1Layer2Url, bg1Layer3Url, bg1Layer4Url, bg1Layer5Url].map(loadImage),
  },
  regatta: {
    base: loadImage(bg2BaseUrl),
    layers: [bg2Layer1Url, bg2Layer2Url, bg2Layer3Url, bg2Layer4Url, bg2Layer5Url].map(loadImage),
  },
  harbor: {
    base: loadImage(bg3BaseUrl),
    layers: [bg3Layer1Url, bg3Layer2Url, bg3Layer3Url, bg3Layer4Url, bg3Layer5Url, bg3Layer6Url].map(loadImage),
  },
  shellbank: {
    base: loadImage(bg4BaseUrl),
    layers: [bg4Layer1Url, bg4Layer2Url, bg4Layer3Url, bg4Layer4Url].map(loadImage),
  },
};
const CARD_SRC_W = 23;
const CARD_SRC_H = 35;
const CARD_GAP = 1;
const SUITS = ['Anchors', 'Boats', 'Buoys', 'Clams'];
const COLORS = ['black', 'red', 'red', 'black'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const THEME_OPTIONS = [
  { id: 'tidepool', label: 'Background 1', back: 'default', waveAmp: 2, drift: 14, scene: 'tidepool', overlay: 'rgba(10, 43, 69, 0.18)' },
  { id: 'regatta', label: 'Background 2', back: 'waves', waveAmp: 4, drift: 18, scene: 'regatta', overlay: 'rgba(16, 52, 104, 0.16)' },
  { id: 'harbor', label: 'Background 3', back: 'sextant', waveAmp: 3, drift: 12, scene: 'harbor', overlay: 'rgba(7, 30, 58, 0.14)' },
  { id: 'shellbank', label: 'Background 4', back: 'turtle', waveAmp: 1.5, drift: 10, scene: 'shellbank', overlay: 'rgba(11, 56, 44, 0.14)' },
];

function makeDeck() {
  const deck = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cloneCard(card) {
  return { suit: card.suit, rank: card.rank, faceUp: !!card.faceUp, id: card.id };
}

function isRed(card) {
  return COLORS[card.suit] === 'red';
}

function canPlaceOnTableau(card, target) {
  if (!target) return card.rank === 13;
  return target.faceUp && isRed(card) !== isRed(target) && card.rank === target.rank - 1;
}

function canPlaceOnFoundation(card, pile) {
  const top = pile[pile.length - 1];
  if (!top) return card.rank === 1;
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export class NauticalSolitaireDisc extends DiscBase {
  constructor(progress) {
    super('nautical_solitaire', progress);
    this.bestMoves = Number(progress.bestMoves || 0);
    this.completed = !!progress.completed;
    this.themeId = progress.themeId || 'tidepool';
    this._listenersBound = false;
    this._handlePointerDown = this.handlePointerDown.bind(this);
    this._handlePointerMove = this.handlePointerMove.bind(this);
    this._handlePointerUp = this.handlePointerUp.bind(this);
    this._handleThemeChange = this.handleThemeChange.bind(this);
    this.themeParticles = [];
    this.reset();
  }

  reset() {
    const deck = makeDeck();
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = Array.from({ length: 7 }, () => []);
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = row === col;
        this.tableau[col].push(card);
      }
    }
    this.stock = deck;
    this.moves = 0;
    this.message = 'Build each harbor from Ace to King.';
    this.selected = null;
    this.drag = null;
    this.layout = null;
    this.time = 0;
    this.done = false;
    this.exitRequested = false;
    this.result = null;
    this.ensureTheme();
    this.seedThemeParticles();
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

  serialize() {
    return { bestMoves: this.bestMoves, completed: this.completed, themeId: this.themeId };
  }

  update(dt, keys) {
    if (this.done || this.exitRequested) {
      this.unbindListeners();
      return;
    }
    this.bindListeners();
    this.time += dt;
    this.updateThemeParticles(dt);
    if (keys['x'] || keys['backspace']) {
      this.exitRequested = true;
    }
  }

  mountHud() {
    const wrap = document.getElementById('disc-theme-wrap');
    const select = document.getElementById('disc-theme-select');
    if (!wrap || !select) return;
    if (!select.dataset.nauticalReady) {
      select.innerHTML = THEME_OPTIONS.map((theme) => `<option value="${theme.id}">${theme.label}</option>`).join('');
      select.dataset.nauticalReady = '1';
    }
    select.value = this.themeId;
    select.removeEventListener('change', this._handleThemeChange);
    select.addEventListener('change', this._handleThemeChange);
    wrap.classList.remove('hidden');
  }

  unmountHud() {
    const wrap = document.getElementById('disc-theme-wrap');
    const select = document.getElementById('disc-theme-select');
    select?.removeEventListener('change', this._handleThemeChange);
    wrap?.classList.add('hidden');
  }

  handleThemeChange(e) {
    this.themeId = e.target.value || 'tidepool';
    this.ensureTheme();
    this.seedThemeParticles();
    this.message = `${this.theme.label} set on the monitor background.`;
  }

  ensureTheme() {
    this.theme = THEME_OPTIONS.find((theme) => theme.id === this.themeId) || THEME_OPTIONS[3] || THEME_OPTIONS[0];
    this.themeId = this.theme.id;
  }

  seedThemeParticles() {
    this.themeParticles = Array.from({ length: 12 }, (_, i) => ({
      x: (i * 0.061 + Math.random() * 0.08) % 1,
      y: 0.14 + Math.random() * 0.78,
      scale: 0.85 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 0.012,
      spin: (Math.random() - 0.5) * 0.18,
      angle: Math.random() * Math.PI * 2,
    }));
  }

  updateThemeParticles(dt) {
    for (const p of this.themeParticles) {
      p.x = (p.x + p.speed * dt * 0.01) % 1.08;
      p.y += Math.sin(this.time * 0.6 + p.phase) * dt * p.drift;
      if (p.y < 0.1) p.y = 0.1;
      if (p.y > 0.92) p.y = 0.92;
      p.angle += p.spin * dt;
    }
  }

  onAction() {
    if (this.done) {
      this.exitRequested = true;
      return;
    }
    this.dealStock();
  }

  dealStock() {
    this.clearSelection();
    if (this.stock.length) {
      const card = this.stock.pop();
      card.faceUp = true;
      this.waste.push(card);
      this.moves++;
      this.message = `${RANKS[card.rank - 1]} of ${SUITS[card.suit]} to the tide pool.`;
      return;
    }
    if (!this.waste.length) return;
    this.stock = this.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    this.waste = [];
    this.moves++;
    this.message = 'The tide rolls the waste pile back into the deck.';
  }

  handlePointerDown(e) {
    if (this.done || this.exitRequested || !this.layout) return;
    const p = this.pointer(e);
    const hit = this.hitTest(p.x, p.y);
    if (hit?.type === 'new') {
      this.reset();
      e.preventDefault?.();
      return;
    }
    if (hit?.type === 'stock') {
      this.dealStock();
      e.preventDefault?.();
      return;
    }
    if (!hit?.cards?.length) {
      this.clearSelection();
      return;
    }
    this.selected = hit;
    this.drag = { ...hit, x: p.x, y: p.y, dx: p.x - hit.x, dy: p.y - hit.y };
    e.preventDefault?.();
  }

  handlePointerMove(e) {
    if (!this.drag) return;
    const p = this.pointer(e);
    this.drag.x = p.x;
    this.drag.y = p.y;
    e.preventDefault?.();
  }

  handlePointerUp(e) {
    if (!this.drag) return;
    const p = this.pointer(e);
    const source = this.drag;
    const drop = this.hitDropTarget(p.x, p.y, source);
    if (drop && this.moveCards(source, drop)) {
      this.clearSelection();
      this.checkWin();
    } else {
      this.selected = source;
      this.drag = null;
    }
    e.preventDefault?.();
  }

  pointer(e) {
    const touch = e.changedTouches?.[0] || e.touches?.[0];
    const x = touch ? touch.clientX : e.clientX;
    const y = touch ? touch.clientY : e.clientY;
    const canvas = document.getElementById('game-canvas');
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !this.layout) return { x, y };
    return {
      x: (x - rect.left) * (this.layout.w / rect.width),
      y: (y - rect.top) * (this.layout.h / rect.height),
    };
  }

  hitTest(x, y) {
    const l = this.layout;
    if (this.inRect(x, y, l.newGame)) return { type: 'new' };
    if (this.inRect(x, y, l.stock)) return { type: 'stock' };
    if (this.waste.length && this.inRect(x, y, l.waste)) {
      const card = this.waste[this.waste.length - 1];
      return { type: 'waste', cards: [card], x: l.waste.x, y: l.waste.y };
    }
    for (let i = 0; i < 4; i++) {
      const rect = l.foundations[i];
      if (this.foundations[i].length && this.inRect(x, y, rect)) {
        const card = this.foundations[i][this.foundations[i].length - 1];
        return { type: 'foundation', index: i, cards: [card], x: rect.x, y: rect.y };
      }
    }
    for (let col = 0; col < 7; col++) {
      const pile = this.tableau[col];
      const rect = l.tableau[col];
      for (let row = pile.length - 1; row >= 0; row--) {
        const cardY = rect.y + row * l.step;
        const h = row === pile.length - 1 ? l.cardH : l.step;
        if (x >= rect.x && x <= rect.x + l.cardW && y >= cardY && y <= cardY + h && pile[row].faceUp) {
          return { type: 'tableau', index: col, row, cards: pile.slice(row), x: rect.x, y: cardY };
        }
      }
      if (!pile.length && this.inRect(x, y, rect)) {
        return { type: 'empty-tableau', index: col, cards: [], x: rect.x, y: rect.y };
      }
    }
    return null;
  }

  hitDropTarget(x, y, source) {
    const l = this.layout;
    for (let i = 0; i < 4; i++) {
      if (source.cards.length === 1 && this.inRect(x, y, l.foundations[i])) {
        return { type: 'foundation', index: i };
      }
    }
    for (let i = 0; i < 7; i++) {
      const rect = l.tableau[i];
      const pile = this.tableau[i];
      const height = Math.max(l.cardH, l.cardH + Math.max(0, pile.length - 1) * l.step);
      if (x >= rect.x && x <= rect.x + l.cardW && y >= rect.y && y <= rect.y + height + l.cardH * 0.35) {
        return { type: 'tableau', index: i };
      }
    }
    return null;
  }

  moveCards(source, drop) {
    const moving = source.cards.map(cloneCard);
    const first = moving[0];
    if (drop.type === 'foundation') {
      if (!canPlaceOnFoundation(first, this.foundations[drop.index])) {
        this.message = 'That harbor needs the next matching suit.';
        this.drag = null;
        return false;
      }
      this.removeSource(source);
      this.foundations[drop.index].push(first);
      this.afterMove();
      return true;
    }
    if (drop.type === 'tableau') {
      if (source.type === 'tableau' && source.index === drop.index) {
        this.drag = null;
        return false;
      }
      const targetPile = this.tableau[drop.index];
      const top = targetPile[targetPile.length - 1] || null;
      if (!canPlaceOnTableau(first, top)) {
        this.message = top ? 'Stack opposite colors in descending rank.' : 'Only a King can anchor an empty lane.';
        this.drag = null;
        return false;
      }
      this.removeSource(source);
      this.tableau[drop.index].push(...moving);
      this.afterMove();
      return true;
    }
    this.drag = null;
    return false;
  }

  removeSource(source) {
    if (source.type === 'waste') {
      this.waste.pop();
    } else if (source.type === 'foundation') {
      this.foundations[source.index].pop();
    } else if (source.type === 'tableau') {
      this.tableau[source.index].splice(source.row);
    }
  }

  afterMove() {
    for (const pile of this.tableau) {
      const top = pile[pile.length - 1];
      if (top && !top.faceUp) top.faceUp = true;
    }
    this.moves++;
    this.message = 'A clean move. Keep the current with you.';
    this.drag = null;
  }

  checkWin() {
    const won = this.foundations.every((pile) => pile.length === 13);
    if (!won) return;
    this.unbindListeners();
    const oldBest = this.bestMoves || Infinity;
    const newBest = !this.bestMoves || this.moves < this.bestMoves;
    this.bestMoves = newBest ? this.moves : this.bestMoves;
    const rewardPebbles = this.completed ? 12 : 80;
    this.completed = true;
    this.done = true;
    this.result = {
      score: this.moves,
      rewardPebbles,
      message: newBest || oldBest === Infinity ? `Harbors complete in ${this.moves} moves.` : `Harbors complete. Best: ${this.bestMoves} moves.`,
    };
  }

  clearSelection() {
    this.selected = null;
    this.drag = null;
  }

  inRect(x, y, r) {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  makeLayout(w, h) {
    const margin = Math.max(24, Math.min(44, w * 0.045));
    const gap = Math.max(8, Math.min(18, w * 0.018));
    const cardW = Math.floor(Math.min(78, (w - margin * 2 - gap * 6) / 7));
    const cardH = Math.floor(cardW * CARD_SRC_H / CARD_SRC_W);
    const step = Math.max(17, Math.min(29, cardH * 0.28));
    const top = 128;
    const left = (w - (cardW * 7 + gap * 6)) / 2;
    return {
      w, h, cardW, cardH, step,
      stock: { x: left, y: top, w: cardW, h: cardH },
      waste: { x: left + cardW + gap, y: top, w: cardW, h: cardH },
      foundations: [0, 1, 2, 3].map((i) => ({ x: left + (i + 3) * (cardW + gap), y: top, w: cardW, h: cardH })),
      tableau: Array.from({ length: 7 }, (_, i) => ({ x: left + i * (cardW + gap), y: top + cardH + 30, w: cardW, h: cardH })),
      newGame: { x: w - margin - 196, y: h - 58, w: 96, h: 34 },
    };
  }

  draw(ctx, screen) {
    const w = screen.w;
    const h = screen.h;
    this.layout = this.makeLayout(w, h);
    drawScreenFrame(ctx, w, h, 'NAUTICAL SOLITAIRE', this.meta.accent, this.done ? 'Use the top Back button or press Action' : 'Drag cards. Action: deal stock. Themes live in the top-right menu');

    ctx.save();
    this.drawSeaTable(ctx, w, h);
    this.drawPiles(ctx);
    this.drawDrag(ctx);
    this.drawHud(ctx, w, h);
    if (this.done) this.drawResult(ctx, w, h);
    ctx.restore();
  }

  drawSeaTable(ctx, w, h) {
    ctx.fillStyle = '#06111d';
    ctx.fillRect(24, 72, w - 48, h - 92);
    this.drawBackdropPattern(ctx, w, h);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.2)';
    for (let y = 116; y < h - 90; y += 36) {
      ctx.beginPath();
      for (let x = 36; x < w - 36; x += 18) {
        const yy = y + Math.sin((x + this.time * this.theme.drift) * 0.035) * this.theme.waveAmp;
        if (x === 36) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  drawBackdropPattern(ctx, w, h) {
    const scene = SCENE_BACKGROUNDS[this.theme.scene];
    const areaX = 24;
    const areaY = 72;
    const areaW = w - 48;
    const areaH = h - 92;
    if (scene?.base?.complete && scene.base.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(areaX, areaY, areaW, areaH);
      ctx.clip();
      this.drawCoverImage(ctx, scene.base, areaX, areaY, areaW, areaH);
      scene.layers.forEach((img, index) => {
        if (!img.complete || img.naturalWidth <= 0) return;
        const drift = (index + 1) * (6 + this.theme.drift * 0.35);
        const bob = Math.sin(this.time * (0.28 + index * 0.07)) * (3 + index);
        const offsetX = Math.sin(this.time * 0.12 + index * 0.9) * drift;
        ctx.globalAlpha = Math.max(0.42, 0.82 - index * 0.08);
        this.drawCoverImage(ctx, img, areaX + offsetX, areaY + bob, areaW, areaH);
      });
      if (this.theme.overlay) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.theme.overlay;
        ctx.fillRect(areaX, areaY, areaW, areaH);
      }
      ctx.restore();
    }

    const accentBack = BACK_VARIANTS[this.theme.back] || CARD_BACK;
    if (!accentBack.complete || accentBack.naturalWidth <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (const p of this.themeParticles) {
      const px = areaX + ((p.x * areaW + this.time * this.theme.drift * p.speed * 8) % areaW);
      const py = areaY + p.y * (areaH - 84);
      const cardW = 44 * p.scale;
      const cardH = 67 * p.scale;
      ctx.translate(px, py + Math.sin(this.time * 0.7 + p.phase) * 6);
      ctx.rotate(p.angle);
      ctx.drawImage(accentBack, -cardW / 2, -cardH / 2, cardW, cardH);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  drawCoverImage(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  drawPiles(ctx) {
    const l = this.layout;
    this.drawSlot(ctx, l.stock, this.stock.length ? 'Deck' : 'Reset');
    if (this.stock.length) this.drawBack(ctx, l.stock.x, l.stock.y);
    this.drawSlot(ctx, l.waste, 'Waste');
    if (this.waste.length) this.drawCard(ctx, this.waste[this.waste.length - 1], l.waste.x, l.waste.y);
    for (let i = 0; i < 4; i++) {
      this.drawSlot(ctx, l.foundations[i], SUITS[i]);
      const top = this.foundations[i][this.foundations[i].length - 1];
      if (top) this.drawCard(ctx, top, l.foundations[i].x, l.foundations[i].y);
    }
    for (let col = 0; col < 7; col++) {
      const rect = l.tableau[col];
      const pile = this.tableau[col];
      this.drawSlot(ctx, rect, 'K');
      pile.forEach((card, row) => {
        if (this.drag?.type === 'tableau' && this.drag.index === col && row >= this.drag.row) return;
        const y = rect.y + row * l.step;
        this.drawCard(ctx, card, rect.x, y);
      });
    }
  }

  drawDrag(ctx) {
    if (!this.drag) return;
    const l = this.layout;
    const x = this.drag.x - this.drag.dx;
    const y = this.drag.y - this.drag.dy;
    this.drag.cards.forEach((card, i) => this.drawCard(ctx, card, x, y + i * l.step));
  }

  drawSlot(ctx, rect, label) {
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.34)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.22)';
    ctx.fill();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.52)';
    ctx.font = '700 11px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
  }

  drawCard(ctx, card, x, y) {
    if (!card.faceUp) {
      this.drawBack(ctx, x, y);
      return;
    }
    const l = this.layout;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(2, 6, 23, 0.38)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    if (FACE_SHEET.complete && FACE_SHEET.naturalWidth > 0) {
      const sx = (card.rank - 1) * (CARD_SRC_W + CARD_GAP);
      const sy = card.suit * (CARD_SRC_H + CARD_GAP);
      ctx.drawImage(FACE_SHEET, sx, sy, CARD_SRC_W, CARD_SRC_H, x, y, l.cardW, l.cardH);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(x, y, l.cardW, l.cardH, 8);
      ctx.fill();
      ctx.fillStyle = isRed(card) ? '#dc2626' : '#0f172a';
      ctx.font = '700 18px SproutPixel, Outfit, sans-serif';
      ctx.fillText(RANKS[card.rank - 1], x + 10, y + 22);
    }
    if (this.selected?.cards?.[0]?.id === card.id && !this.drag) {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, l.cardW - 4, l.cardH - 4);
    }
    ctx.restore();
  }

  drawBack(ctx, x, y) {
    const l = this.layout;
    const w = l.cardW;
    const h = l.cardH;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(2, 6, 23, 0.38)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#071b18';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#0f2f27';
    ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
    ctx.strokeStyle = '#0b1418';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = '#2ddf62';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

    const activeBack = BACK_VARIANTS[this.theme?.back] || CARD_BACK;
    if (activeBack.complete && activeBack.naturalWidth > 0) {
      const motifW = Math.max(24, w * 0.46);
      const motifH = motifW * CARD_SRC_H / CARD_SRC_W;
      ctx.globalAlpha = 0.98;
      ctx.drawImage(activeBack, x + (w - motifW) / 2, y + (h - motifH) / 2, motifW, motifH);
    }

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#39ff55';
    const cx = x + w / 2;
    const cy = y + h / 2;
    const tick = Math.max(3, Math.floor(w * 0.06));
    ctx.fillRect(cx - tick / 2, y + h * 0.25, tick, h * 0.13);
    ctx.fillRect(cx - tick / 2, y + h * 0.62, tick, h * 0.13);
    ctx.fillRect(x + w * 0.28, cy - tick / 2, w * 0.11, tick);
    ctx.fillRect(x + w * 0.61, cy - tick / 2, w * 0.11, tick);
    ctx.restore();
  }

  drawHud(ctx, w, h) {
    const l = this.layout;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 15px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Moves ${this.moves}`, w - 34, 36);
    ctx.fillText(this.bestMoves ? `Best ${this.bestMoves}` : 'Best --', w - 34, 58);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(this.message, 34, h - 74);
    this.drawButton(ctx, l.newGame, 'New Deal');
  }

  drawButton(ctx, rect, label) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.5)';
    ctx.stroke();
    ctx.fillStyle = '#e0f2fe';
    ctx.font = '700 12px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  drawResult(ctx, w, h) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 190, h / 2 - 82, 380, 164, 14);
    ctx.fill();
    ctx.strokeStyle = this.meta.accent;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 19px SproutPixel, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HARBORS COMPLETE', w / 2, h / 2 - 42);
    ctx.font = '700 14px SproutPixel, Outfit, sans-serif';
    ctx.fillText(this.result.message, w / 2, h / 2 - 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Payout: ${this.result.rewardPebbles} Pebbles`, w / 2, h / 2 + 24);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press Action or use the top Back button', w / 2, h / 2 + 54);
  }
}
