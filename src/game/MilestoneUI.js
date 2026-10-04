import { ProgressionTracker, MILESTONES } from './Progression.js';
import { DECOR_CATALOG, snap, validatePlacement, homeRoute } from './HomeLayout.js';
import { FURNITURE, RUG_PIECES } from './AssetLoader.js';
import { buildInterior } from './Interior.js';
import { World, decorationCollider } from './World.js';
import { CompanionPlay, rewardCompanionPlay } from './CompanionPlay.js';

const el = id => document.getElementById(id);
const button = (id, label) => `<button id="${id}" class="btn-secondary">${label}</button>`;
const clone = value => JSON.parse(JSON.stringify(value));
const areaName = area => area === 'woods' ? 'Whispering Woods' : area === 'town' ? 'Town' : 'Campsite';
const overlay = (id,title,body,extra = '') => `<section id="${id}" class="ui-screen hidden milestone-screen" role="dialog" aria-modal="true" aria-label="${title}"><div class="menu-content glassmorphism milestone-panel ${extra}"><h2>${title}</h2>${body}</div></section>`;

export const MilestoneUIMethods = {
  setupMilestoneUI() {
    document.body.insertAdjacentHTML('beforeend',
      overlay('journal-overlay','Axel’s adventure journal', `<p>Little goals for a big adventure. Explore in any order.</p><label><input type="checkbox" id="hide-guidance"> Hide the goal on screen</label><div id="milestone-list"></div>${button('close-journal','Keep playing')}`) +
      overlay('decorate-overlay','Make yourself at home', `<p class="editor-help">Choose a furnishing, then tap a spot. Arrow keys move it by one square.</p><div class="editor-grid"><canvas id="decor-canvas" width="640" height="448" tabindex="0" aria-label="Cabin furnishing preview"></canvas><div id="decor-list"></div></div><p id="decor-feedback" role="status"></p><div class="editor-buttons">${button('decor-place','Place')}${button('decor-store','Store')}${button('decor-save','Save room')}${button('decor-cancel','Cancel')}</div>`, 'editor-panel'));
    el('game-hud').insertAdjacentHTML('beforeend', '<button id="milestone-goal" class="milestone-goal hidden" aria-label="Open adventure journal"></button><p id="save-status" class="save-status hidden" role="status"></p>');
    document.querySelector('.more-panel').insertAdjacentHTML('beforeend', '<button id="open-journal" class="btn-hud">📖 Journal</button><button id="open-decorate" class="btn-hud hidden">🏡 Decorate</button>');
    document.querySelector('#settings-overlay .danger h3').insertAdjacentHTML('beforebegin', '<div class="settings-section"><h3>Your save</h3><p>Visits start safely at the lake. Your bag, home, friends and goals come with you.</p><div class="editor-buttons">' + button('export-save','Export backup') + button('choose-save','Import backup') + '</div><input type="file" id="import-save" accept=".json,application/json" hidden><p id="import-summary" role="status"></p>' + button('confirm-import','Replace progress with this backup') + '</div>');
    el('confirm-import').classList.add('hidden');
    el('journal-overlay').querySelector('.milestone-panel').insertAdjacentHTML('afterbegin', '<button id="close-journal-top" class="journal-close" aria-label="Close journal">×</button>');
    el('computer-overlay').querySelector('.computer-panel').insertAdjacentHTML('beforeend', '<p id="disc-load-status" role="status"></p>');
    el('cabin-storage-overlay').querySelector('.storage-panel').insertAdjacentHTML('beforeend', button('store-all','Store all carried items'));
    el('open-journal').onclick = el('milestone-goal').onclick = () => this.openJournal();
    el('close-journal').onclick = () => this.closeFeatureState('journal-overlay');
    el('close-journal-top').onclick = () => this.closeFeatureState('journal-overlay');
    el('open-decorate').onclick = () => this.openDecorating();
    el('hide-guidance').onchange = () => { this.guidanceHidden = el('hide-guidance').checked; this.saveProfile(); this.updateMilestoneHUD(); };
    el('decor-place').onclick = () => this.placeDecoration();
    el('decor-store').onclick = () => { if (!this.decorEdit.selected) return; this.decorEdit.layout[this.decorEdit.selected] = null; this.renderDecorating(); };
    el('decor-save').onclick = () => this.saveDecorating();
    el('decor-cancel').onclick = () => { this.decorEdit = null; this.closeFeatureState('decorate-overlay'); };
    el('decor-canvas').addEventListener('pointerdown', e => {
      const rect = e.currentTarget.getBoundingClientRect();
      this.decorEdit.candidate = { x: snap((e.clientX - rect.left) * 640 / rect.width), y: snap((e.clientY - rect.top) * 448 / rect.height) };
      this.renderDecorating();
    });
    window.addEventListener('keydown', e => {
      if (['journal','decorating'].includes(this.state) && e.key === 'Tab') {
        const root = el(this.state === 'journal' ? 'journal-overlay' : 'decorate-overlay');
        const controls = [...root.querySelectorAll('button,input,canvas[tabindex]')].filter(c => !c.disabled && c.getBoundingClientRect().height > 0);
        const current = controls.indexOf(document.activeElement);
        e.preventDefault(); controls[(current + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
        return;
      }
      if (this.state === 'journal' && e.key === 'Escape') this.closeFeatureState('journal-overlay');
      if (this.state !== 'decorating') return;
      if (e.key === 'Escape') { this.decorEdit = null; this.closeFeatureState('decorate-overlay'); return; }
      const directions = { ArrowLeft: [-32,0], ArrowRight: [32,0], ArrowUp: [0,-32], ArrowDown: [0,32] };
      if (directions[e.key]) {
        e.preventDefault(); const [x,y] = directions[e.key];
        this.decorEdit.candidate.x += x; this.decorEdit.candidate.y += y; this.renderDecorating();
      } else if (e.key === 'Enter' && e.target === el('decor-canvas')) this.placeDecoration();
    });
    el('store-all').onclick = () => {
      if (!this.hasShellShelf) return;
      while (this.player.items.length) this.storeItem(0);
      this.updateCabinStorageUI();
    };
    el('export-save').onclick = () => {
      try {
        const raw = this.saveManager.export();
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'axel-backup-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) { el('import-summary').textContent = e.message; }
    };
    el('choose-save').onclick = () => el('import-save').click();
    el('import-save').onchange = async () => {
      el('confirm-import').classList.add('hidden'); this._importRaw = null;
      try {
        const file = el('import-save').files[0]; if (!file) return;
        if (file.size > 2e6) throw new Error('That backup is too large.');
        const raw = await file.text(), data = this.saveManager.inspectImport(raw);
        el('import-summary').textContent = `Backup: ${data.pebbles || 0} pebbles · day ${data.dayCount || 1} · ${data.pets?.length || 0} companions · ${data.items?.length || 0} bag stacks. Replaces this device’s current progress.`;
        this._importRaw = raw; el('confirm-import').classList.remove('hidden');
      } catch (e) { el('import-summary').textContent = e.message; }
      el('import-save').value = '';
    };
    el('confirm-import').onclick = () => {
      if (!this._importRaw) return;
      try { this.saveManager.import(this._importRaw); location.reload(); }
      catch (e) { el('import-summary').textContent = 'Could not import: ' + e.message; }
    };
    if (this._saveStatusMessage) { el('save-status').textContent = this._saveStatusMessage; el('save-status').classList.remove('hidden'); }
    this.updateMilestoneHUD();
  },

  enterFeatureState(state, id) {
    if (!['playing','paused','backpack'].includes(this.state)) return false;
    this._featureReturnState = this.state;
    this.input.reset(); this.state = state; el(id).classList.remove('hidden');
    el(id).querySelector('button')?.focus();
    return true;
  },
  closeFeatureState(id) {
    el(id).classList.add('hidden'); this.input.reset();
    this.state = this._featureReturnState || 'playing'; this.lastTime = performance.now();
  },
  recordProgress(event, amount = 1) {
    const completed = this.progression.record(event, amount);
    const reward = completed.reduce((sum,m) => sum + m.reward, 0);
    this.player.pebbles += reward; this.scorePebbles += reward;
    if (this.runStats) this.runStats.pebbles += reward;
    if (completed.length) this.showAlert(`📖 ${completed.map(m => m.title).join(' · ')}${reward ? ` · +${reward} pebbles` : ' · Complete!'}`);
    this.saveProfile(); this.updateMilestoneHUD();
  },
  openJournal() {
    if (!this.enterFeatureState('journal','journal-overlay')) return;
    el('hide-guidance').checked = this.guidanceHidden;
    el('milestone-list').innerHTML = MILESTONES.map((m,i) => {
      const done = this.progression.claimed.has(m.id), count = Math.min(m.n, this.progression.counts[m.event] || 0);
      return `${i === 7 ? '<h3>More days at home</h3>' : ''}<article class="journal-row ${done ? 'complete' : ''}"><strong>${done ? '✓' : '○'} ${m.title}</strong><p>${m.hint}</p><small>${areaName(m.area)} · ${done ? m.badge ? 'Badge earned' : 'Complete' : `${count}/${m.n}`}${m.reward ? ` · ${m.reward} pebbles` : ''}</small></article>`;
    }).join('');
  },
  updateMilestoneHUD() {
    const goal = el('milestone-goal'); if (!goal) return;
    const m = this.progression.current(), marker = this.progressMarkers()[0];
    goal.classList.toggle('hidden', !m || this.guidanceHidden || this.state === 'disc');
    goal.textContent = m ? `📖 ${m.title} · ${areaName(m.area)}${marker ? ' · ' + this._compassDir(marker.x - this.player.x, marker.y - this.player.y) : ''}` : '';
    el('open-decorate').classList.toggle('hidden', !this.world.isHomeCabin);
    el('store-all').classList.toggle('hidden', !this.hasShellShelf);
  },
  progressMarkers() {
    const m = this.progression.current();
    if (!m || this.guidanceHidden || this.world.isInterior) return [];
    let point;
    if (this.world.areaType !== m.area) {
      const target = this.world.areaType === 'town' ? 'campsite' : m.area;
      const tp = this.world.transitionPoints?.find(t => t.targetArea === target);
      if (tp) point = { x: tp.x + tp.w / 2, y: tp.y + tp.h / 2 };
    } else {
      if (m.target === 'rat') point = this.world.rat;
      if (m.target === 'lake') { const z = this.world.zones.find(z => z.type === 'lake'); if (z) point = { x: z.spawnX, y: z.spawnY }; }
      if (m.target === 'home') { const b = this.world.colliders.find(b => b.type === 'homecabin'); if (b) point = { x: b.x + b.w / 2, y: b.y + b.h }; }
      if (m.target === 'farm') point = this.world.farmPlots[0];
      if (m.target === 'vendor') point = this.world.decorations.find(d => d.type === 'homevendor');
    }
    return point ? [{ ...point, id: 'goal', name: m.title, label: '!', color: '#f8a4c8' }] : [];
  },

  renderDecorStore(list) {
    for (const d of DECOR_CATALOG) {
      const owned = this.ownedFurniture.includes(d.id), dry = d.wet || this.hasHomePump;
      const card = document.createElement('div'); card.className = 'shop-card';
      card.innerHTML = `<div class="shop-card-icon">🏡</div><div class="shop-card-info"><h3>${d.name}</h3><p>${d.wet ? 'Happy even in a flooded cabin.' : 'For your dry cabin.'} Place it with Decorate.</p><div class="shop-card-price">${d.cost} pebbles</div></div><button class="btn-buy" ${owned || !dry || this.player.pebbles < d.cost ? 'disabled' : ''}>${owned ? 'Owned' : !dry ? 'Needs pump' : 'Buy'}</button>`;
      card.querySelector('button').onclick = () => {
        if (this.ownedFurniture.includes(d.id) || this.player.pebbles < d.cost || (!d.wet && !this.hasHomePump)) return;
        this.player.pebbles -= d.cost; this.ownedFurniture.push(d.id); this.furnitureLayout['decor-' + d.id] = null;
        this.saveProfile(); this.updateHUD(); this.updateHomeUpgradeUI(); this.showAlert(`${d.name} is yours! Open Decorate at the cabin to place it.`);
      };
      list.appendChild(card);
    }
    const seeds = document.createElement('div'); seeds.className = 'shop-card';
    seeds.innerHTML = '<div class="shop-card-icon">🌱</div><div class="shop-card-info"><h3>Six seeds</h3><p>A fresh start for your farm.</p><div class="shop-card-price">5 pebbles</div></div><button class="btn-buy">Buy seeds</button>';
    seeds.querySelector('button').disabled = this.player.pebbles < 5;
    seeds.querySelector('button').onclick = () => { if (this.player.pebbles < 5) return; this.player.pebbles -= 5; this.farmSeedCount += 6; this.saveProfile(); this.updateHUD(); this.updateHomeUpgradeUI(); };
    list.appendChild(seeds);
  },

  openDecorating() {
    if (!this.world.isHomeCabin || !this.enterFeatureState('decorating','decorate-overlay')) return;
    const data = buildInterior({ type: 'homecabin' }, { homeUpgrades: this._homeUpgradeSnapshot() });
    const items = [...data.decorations, ...data.rugs].filter(d => d.homeId).map(d => {
      const rug = d.homeId.includes('rug'), def = (rug ? RUG_PIECES : FURNITURE)[d.piece];
      const props = { cattree: [100,90,12,'Cat tree'], turtlecove: [108,60,32,'Turtle Cove'], shellhelpers: [84,60,26,'Shell Sorting Shelf'], sunpatch: [116,80,40,'Sun patch'], smallplant: [20,20,0,'Cabin plant'] };
      const prop = props[d.type], dw = def?.drawW || prop?.[0] || 32, dh = def ? dw * def.sh / def.sw : prop?.[1] || 32;
      const box = decorationCollider(d);
      return { id: d.homeId, name: prop?.[3] || (d.piece || 'Cabin plant').replaceAll('_',' '), piece: d.piece, rug, solid: !!box, x: d.x, y: d.y, w: box?.w || 0, h: box?.h || 0, colliderOffsetX: box ? box.x-d.x : 0, colliderOffsetY: box ? box.y-d.y : 0, drawW: dw, drawH: dh, drawOffsetY: prop?.[2] || 0, wet: true };
    });
    for (const id of this.ownedFurniture) {
      const d = DECOR_CATALOG.find(d => d.id === id); if (!d) continue;
      const def = (d.rug ? RUG_PIECES : FURNITURE)[d.piece], dw = def.drawW, dh = dw * def.sh / def.sw;
      items.push({ ...d, id: 'decor-' + id, x: 320, y: 256, drawW: dw, drawH: dh, w: Math.max(18, dw * 0.68), h: Math.max(12, Math.min(28, dh * 0.45)) });
    }
    const base = new World(data);
    const room = { width: base.width, height: base.height, flooded: base.isFlooded, fixed: base.colliders.filter(c => !c.homeId), door: { x: 240, y: 360, w: 160, h: 88 }, player: { x: this.player.x, y: this.player.y }, essentials: [{ x: 88,y:144 }, { x:320,y:122 }, { x:410,y:126 }, { x:540,y:392 }] };
    this.decorEdit = { items, room, layout: clone(this.furnitureLayout), selected: items[0]?.id, candidate: { x: snap(items[0]?.x || 320), y: snap(items[0]?.y || 256) } };
    this.findDecorationPreview();
    this.renderDecorating();
  },
  findDecorationPreview() {
    const e = this.decorEdit;
    if (!validatePlacement(e.room,e.items,e.layout,e.selected,e.candidate)) return;
    const origin = e.candidate; let nearest = null, distance = Infinity;
    for (let y=96;y<416;y+=32) for (let x=32;x<624;x+=32) {
      const candidate = {x,y}, d = Math.hypot(x-origin.x,y-origin.y);
      if (d<distance && !validatePlacement(e.room,e.items,e.layout,e.selected,candidate)) { nearest = candidate; distance = d; }
    }
    if (nearest) e.candidate = nearest;
  },
  placeDecoration() {
    const e = this.decorEdit, error = validatePlacement(e.room, e.items, e.layout, e.selected, e.candidate);
    if (error) { el('decor-feedback').textContent = error; return; }
    e.layout[e.selected] = { ...e.candidate }; this.renderDecorating();
  },
  renderDecorating() {
    const e = this.decorEdit; if (!e) return;
    const preview = { ...e.layout, [e.selected]: e.candidate };
    const data = buildInterior({ type: 'homecabin' }, { homeUpgrades: this._homeUpgradeSnapshot(), furnitureLayout: preview, ownedFurniture: this.ownedFurniture });
    const world = new World(data), canvas = el('decor-canvas'), ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,640,448); ctx.imageSmoothingEnabled = false;
    world.drawGround(ctx,{x:0,y:0,w:640,h:448}); world.getSortableEntities().sort((a,b) => a.y - b.y).forEach(d => d.draw(ctx));
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
    for (let x = 16; x < 640; x += 32) { ctx.beginPath(); ctx.moveTo(x,76); ctx.lineTo(x,428); ctx.stroke(); }
    for (let y = 96; y < 428; y += 32) { ctx.beginPath(); ctx.moveTo(16,y); ctx.lineTo(624,y); ctx.stroke(); }
    const item = e.items.find(i => i.id === e.selected), error = validatePlacement(e.room,e.items,e.layout,e.selected,e.candidate);
    if (item) { ctx.strokeStyle = error ? '#fc7c84' : '#7de5a2'; ctx.lineWidth = 3; ctx.strokeRect(e.candidate.x - item.drawW / 2,e.candidate.y + (item.drawOffsetY || 0) - item.drawH,item.drawW,item.drawH); }
    el('decor-feedback').textContent = error || 'This spot works. Tap Place, then Save room when you are finished.';
    el('decor-place').disabled = !!error;
    el('decor-list').replaceChildren();
    for (const item of e.items) {
      const b = document.createElement('button'); b.className = 'decor-choice' + (e.selected === item.id ? ' selected' : '');
      b.dataset.furnitureId = item.id;
      b.textContent = item.name + (e.layout[item.id] === null ? ' · stored' : '');
      b.onclick = () => { e.selected = item.id; const p = e.layout[item.id] || item; e.candidate = { x: snap(p.x), y: snap(p.y) }; this.findDecorationPreview(); this.renderDecorating(); };
      el('decor-list').appendChild(b);
    }
  },
  saveDecorating() {
    const e = this.decorEdit;
    const placed = this.ownedFurniture.some(id => e.layout['decor-' + id]);
    this.furnitureLayout = clone(e.layout);
    this.world = new World(buildInterior({ type: 'homecabin' }, { homeUpgrades: this._homeUpgradeSnapshot(), furnitureLayout: this.furnitureLayout, ownedFurniture: this.ownedFurniture }));
    if (this._outside?.building) this._interiors.set(this._outside.building, this.world);
    this.decorEdit = null; this.closeFeatureState('decorate-overlay');
    if (placed) this.recordProgress('decorate'); else this.saveProfile();
    this.showAlert('Your room is saved. Welcome home!');
  },

  startCompanionPlay(index) {
    const pet = this.pets[index]; if (!pet || !this.world.isHomeCabin) return;
    el('pet-overlay').classList.add('hidden');
    this.startMinigame(new CompanionPlay(pet.kind), game => {
      if (game.result === 'success') {
        const boosted = rewardCompanionPlay(pet,this.dayCount,game.result);
        this.recordProgress('play');
        this.showAlert(boosted ? `${pet.name} had a wonderful time! +25 happiness` : `${pet.name} loved playing again. Today’s happiness reward is already collected.`);
      } else if (game.result !== 'cancelled') this.showAlert('Good practice! Play again whenever you like.');
      this.saveProfile();
    }, { actionLabel: 'Play', actionIcon: '🐾' });
  },
  updateHomeCompanion(pet, dt) {
    if (!this.world.isHomeCabin) { pet.state = 'sleep'; return; }
    const choices = this.world.decorations.filter(d => d.type === 'sunpatch' || d.type === 'petbed' || (pet.kind === 'kitten' && d.type === 'cattree'));
    const index = Math.floor(pet.animTime / 12) % Math.max(1,choices.length), activity = choices[index];
    if (!activity) { pet.state = 'sleep'; return; }
    if (pet._homeActivity !== activity || !pet._homePath) {
      pet._homeActivity = activity;
      pet._homePath = homeRoute(this.world,pet,{x:activity.x,y:activity.y+22});
      pet.climbOffset = 0;
    }
    const destination = pet._homePath[0];
    if (!destination) { pet.state = activity.type === 'cattree' ? 'happy' : 'sleep'; pet.climbOffset = activity.type === 'cattree' ? 22 : 0; return; }
    const tx = destination.x, ty = destination.y;
    const distance = Math.hypot(tx - pet.x,ty - pet.y);
    if (distance > 3) {
      const dx = (tx - pet.x) / distance * Math.min(distance,45 * dt), dy = (ty - pet.y) / distance * Math.min(distance,45 * dt);
      const p = this.world.checkCollisions(pet.x + dx,pet.y + dy,10); pet.x = p.x; pet.y = p.y; pet.state = 'walk'; pet.facing = dx < 0 ? -1 : 1;
    } else { pet._homePath.shift(); }
  },
};
