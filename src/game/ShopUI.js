/**
 * Shop & market UI — extracted from Game.js as a prototype mixin.
 *
 * These methods run with `this` bound to the Game instance (they are
 * Object.assign'd onto Game.prototype), so every `this.player` /
 * `this.showAlert` / DOM lookup behaves exactly as it did inline. Only
 * the pricing constants moved: they now live here as the single source
 * of truth for the economy (see also the shop button gating in
 * updateShopUI, which reads the same UPGRADE_COSTS table).
 */

import { FISH } from './Fishing.js';
import catTowerUrl from '../assets/pet-assets/CAT_TOWER.png';
import dogHouseUrl from '../assets/pet-assets/DOG_HOUSE.png';
import petPropsUrl from '../assets/pet-assets/PET_PROPS.png';

// === Economy constants — the one place shop prices are defined ===
export const FISH_MARKET_MULT = 1.3; // fish (raw or cooked) fetch more here than at the rat
export const BAIT_COST = 15;
export const STURDY_LINE_COST = 100;
export const LOCKPICK_COST = 25;
/** Pebble cost of each one-time player upgrade. */
export const UPGRADE_COSTS = {
  booties: 40,
  canteen: 80,
  rod: 60,
  backpack: 120,
  helmet: 250,
  airhelmet: 150,
  scarecrow: 70,
};

export const HOME_UPGRADES = [
  {
    id: 'pump',
    flag: 'hasHomePump',
    name: 'Bilge Pump',
    art: petPropsUrl,
    emoji: '🌀',
    cost: 140,
    branch: 'Dry Cabin',
    desc: 'Baby turtles install a burbly pump that drains the cabin floor enough for dry furniture.',
    requires: [],
  },
  {
    id: 'catTree',
    flag: 'hasCatTree',
    name: 'Proper Cat Tree',
    art: catTowerUrl,
    emoji: '🌳',
    cost: 120,
    branch: 'Companion',
    desc: 'A real climbing tree for the kitten, finally safe to build once the room is not underwater.',
    requires: ['pump'],
  },
  {
    id: 'turtleCove',
    flag: 'hasTurtleCove',
    name: 'Turtle Helper Cove',
    emoji: '🐢',
    cost: 160,
    branch: 'Companion',
    desc: 'Opens a tiny shell crew area where your companion can recruit baby turtles for home projects.',
    requires: ['pump'],
  },
  {
    id: 'shellShelf',
    flag: 'hasShellShelf',
    name: 'Shell Sorting Shelf',
    emoji: '🧺',
    cost: 90,
    branch: 'Utility',
    desc: 'The helper turtles sort tools, seeds, and shiny scraps beside your storage chest.',
    requires: ['turtleCove'],
  },
  {
    id: 'sunPatch',
    flag: 'hasSunPatch',
    name: 'Window Sun Patch',
    art: dogHouseUrl,
    emoji: '☀️',
    cost: 110,
    branch: 'Cozy',
    desc: 'A warm window nook branching from the cat tree, made for excellent companion naps.',
    requires: ['catTree'],
  },
];

const HOME_UPGRADE_BY_ID = new Map(HOME_UPGRADES.map(upgrade => [upgrade.id, upgrade]));

function ownsHomeUpgrade(game, upgrade) {
  return !!game[upgrade.flag];
}

function missingHomePrereqs(game, upgrade) {
  return (upgrade.requires || [])
    .map(id => HOME_UPGRADE_BY_ID.get(id))
    .filter(req => req && !ownsHomeUpgrade(game, req));
}

function invalidateHomeInteriorCache(game) {
  if (!game._interiors) return;
  for (const [box] of game._interiors) {
    if (box?.type === 'homecabin') game._interiors.delete(box);
  }
}

export const ShopMethods = {
  openShop(title = 'Sewer Rat\'s Secret Shop') {
    this.state = 'paused';
    const titleEl = document.getElementById('shop-title');
    if (titleEl) titleEl.textContent = `🛒 ${title}`;
    document.getElementById('shop-overlay').classList.remove('hidden');
    this.updateShopUI();
  },

  /**
   * Resume gameplay from shop
   */
  closeShop() {
    this.state = 'playing';
    document.getElementById('shop-overlay').classList.add('hidden');
    const titleEl = document.getElementById('shop-title');
    if (titleEl) titleEl.textContent = '🛒 Sewer Rat\'s Secret Shop';
    this.lastTime = performance.now();
  },

  openFishMarket() {
    this.state = 'paused';
    document.getElementById('fish-market-overlay').classList.remove('hidden');
    this.updateFishMarketUI();
  },

  closeFishMarket() {
    this.state = 'playing';
    document.getElementById('fish-market-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  updateFishMarketUI() {
    document.getElementById('fishmarket-pebbles-value').innerText = this.player.pebbles;

    const catches = this.player.items.filter(i => i.isFish);
    const list = document.getElementById('fishmarket-catch-list');
    const sellBtn = document.getElementById('btn-sell-fish');
    const mult = FISH_MARKET_MULT;

    if (catches.length === 0) {
      list.innerHTML = '<div class="backpack-empty-msg">No fish in your bag — go cast a line! 🎣</div>';
      sellBtn.disabled = true;
    } else {
      let total = 0;
      list.innerHTML = catches.map(item => {
        const qty = item.qty || 1;
        const price = Math.round(item.value * mult);
        total += price * qty;
        return `
          <div class="backpack-card">
            <div class="backpack-card-info">
              <div class="backpack-card-emoji">${item.emoji || '🐟'}${qty > 1 ? `<span class="backpack-card-qty">x${qty}</span>` : ''}</div>
              <div class="backpack-card-details">
                <h3>${item.name}</h3>
                <p>Market price: ✨ ${price} ea${qty > 1 ? ` (${price * qty} total)` : ''}</p>
              </div>
            </div>
          </div>`;
      }).join('');
      sellBtn.disabled = false;
      sellBtn.textContent = `Sell All Fish (+${total} ✨)`;
    }

    // Tackle shop
    const baitBadge = document.getElementById('bait-owned-badge');
    if (baitBadge) baitBadge.textContent = this.player.baitCharges > 0 ? `x${this.player.baitCharges}` : '';
    const btnBait = document.getElementById('btn-buy-bait');
    if (btnBait) btnBait.disabled = this.player.pebbles < BAIT_COST;

    const btnLine = document.getElementById('btn-buy-sturdyline');
    if (btnLine) {
      if (this.player.hasSturdyLine) {
        btnLine.classList.add('owned');
      } else {
        btnLine.disabled = this.player.pebbles < STURDY_LINE_COST;
      }
    }
  },

  /** Sell every fish-tagged item (raw or cooked) in the backpack. */
  sellFishToMarket() {
    const mult = FISH_MARKET_MULT;
    const catches = this.player.items.filter(i => i.isFish);
    if (catches.length === 0) return;

    let total = 0, count = 0;
    catches.forEach(item => {
      const qty = item.qty || 1;
      total += Math.round(item.value * mult) * qty;
      count += qty;
    });
    this.player.items = this.player.items.filter(i => !i.isFish);

    this.player.pebbles += total;
    this.scorePebbles += total;
    this.runStats.pebbles += total;
    this.stats.marketFishSold += count;
    this.questEvent('marketsell', count);

    this.playSound('sell');
    this.spawnFloater(this.player.x, this.player.y - 34, `+${total} ✨`, '#7dd3fc');
    this.showAlert(`🐟 Sold ${count} fish for ${total} Pebbles!`);
    this.saveProfile();
    this.updateHUD();
    this.updateFishMarketUI();
  },

  buyBait() {
    if (this.player.pebbles < BAIT_COST) return;
    this.player.pebbles -= BAIT_COST;
    this.player.baitCharges++;
    this.playSound('upgrade');
    this.saveProfile();
    this.updateFishMarketUI();
  },

  buySturdyLine() {
    if (this.player.hasSturdyLine || this.player.pebbles < STURDY_LINE_COST) return;
    this.player.pebbles -= STURDY_LINE_COST;
    this.player.hasSturdyLine = true;
    this.playSound('upgrade');
    this.showAlert('🧵 Braided Line rigged up — the catch bar just got a lot friendlier.');
    this.saveProfile();
    this.updateFishMarketUI();
  },

  /** === Raccoon Shop: trades Bottle Caps (recycled litter) for a rotating stock of cooked fish === */
  openRaccoonShop() {
    this.state = 'paused';
    document.getElementById('raccoon-shop-overlay').classList.remove('hidden');
    // Roll a fresh 4-item stock each visit — a different mix of the fish table, priced in caps.
    const pool = FISH.filter(f => f.name !== 'Old Boot' && f.name !== 'Ancient Leviathan');
    this._raccoonStock = [];
    const used = new Set();
    while (this._raccoonStock.length < 4 && used.size < pool.length) {
      const f = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(f.name)) continue;
      used.add(f.name);
      this._raccoonStock.push({ fish: f, cost: Math.max(3, Math.round(f.value / 3)) });
    }
    this.updateRaccoonShopUI();
  },

  closeRaccoonShop() {
    this.state = 'playing';
    document.getElementById('raccoon-shop-overlay').classList.add('hidden');
    this.lastTime = performance.now();
  },

  openHomeUpgradeShop() {
    this.state = 'paused';
    document.getElementById('home-upgrade-overlay')?.classList.remove('hidden');
    this.updateHomeUpgradeUI();
  },

  closeHomeUpgradeShop() {
    this.state = 'playing';
    document.getElementById('home-upgrade-overlay')?.classList.add('hidden');
    this.lastTime = performance.now();
  },

  updateHomeUpgradeUI() {
    const pebbles = document.getElementById('home-upgrade-pebbles-value');
    if (pebbles) pebbles.innerText = this.player.pebbles;

    const path = document.getElementById('home-upgrade-path');
    if (path) {
      path.innerHTML = HOME_UPGRADES.map(upgrade => {
        const owned = ownsHomeUpgrade(this, upgrade);
        const locked = !owned && missingHomePrereqs(this, upgrade).length > 0;
        return `
          <div class="home-node ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">
            ${upgrade.art ? `<img class="home-node-art" src="${upgrade.art}" alt="" aria-hidden="true">` : ''}
            <span>${upgrade.emoji}</span>
            <b>${upgrade.name}</b>
          </div>`;
      }).join('');
    }

    const list = document.getElementById('home-upgrade-list');
    if (!list) return;
    list.innerHTML = '';

    HOME_UPGRADES.forEach(upgrade => {
      const owned = ownsHomeUpgrade(this, upgrade);
      const missing = missingHomePrereqs(this, upgrade);
      const affordable = this.player.pebbles >= upgrade.cost;
      const locked = missing.length > 0;
      const reqText = missing.length
        ? `Requires: ${missing.map(req => req.name).join(', ')}`
        : (upgrade.requires?.length ? 'Prereqs met' : 'Available now');
      const card = document.createElement('div');
      card.className = `shop-card home-upgrade-card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`;
      card.innerHTML = `
        <div class="shop-card-icon">${upgrade.art ? `<img src="${upgrade.art}" alt="" aria-hidden="true">` : upgrade.emoji}</div>
        <div class="shop-card-info">
          <h3>${upgrade.name} <span class="home-branch">${upgrade.branch}</span></h3>
          <p>${upgrade.desc}</p>
          <div class="shop-card-price">
            <span>✨ ${upgrade.cost} Pebbles</span>
            <span class="${locked ? 'mat-missing' : 'mat-ok'}">${reqText}</span>
          </div>
        </div>
        <button class="btn-buy ${owned ? 'owned' : ''}" ${owned || locked || !affordable ? 'disabled' : ''}>${locked ? 'Locked' : 'Buy'}</button>`;
      const btn = card.querySelector('.btn-buy');
      if (btn && !btn.disabled) btn.addEventListener('click', () => this.purchaseHomeUpgrade(upgrade.id));
      list.appendChild(card);
    });
  },

  purchaseHomeUpgrade(upgradeId) {
    const upgrade = HOME_UPGRADE_BY_ID.get(upgradeId);
    if (!upgrade || ownsHomeUpgrade(this, upgrade)) return;

    const missing = missingHomePrereqs(this, upgrade);
    if (missing.length) {
      this.playSound('ui');
      this.showAlert(`Needs ${missing.map(req => req.name).join(' + ')} first.`);
      return;
    }
    if (this.player.pebbles < upgrade.cost) return;

    this.player.pebbles -= upgrade.cost;
    this[upgrade.flag] = true;
    invalidateHomeInteriorCache(this);
    this._applyHomeUpgradeState?.();

    this.playSound('upgrade');
    const alerts = {
      pump: '🌀 The cabin pump sputters to life. Dry-room upgrades are open!',
      catTree: '🌳 The proper cat tree is ready for serious climbing.',
      turtleCove: '🐢 Baby turtle helpers report for shell-crew duty.',
      shellShelf: '🧺 The helper turtles sorted a new shelf beside storage.',
      sunPatch: '☀️ A warm window patch now waits above the cabin floor.',
    };
    this.showAlert(alerts[upgrade.id] || `${upgrade.name} installed!`);
    this.updateHomeUpgradeUI();
    this.updateHUD();
    this.saveProfile();
  },

  updateRaccoonShopUI() {
    document.getElementById('raccoon-caps-value').innerText = this.player.bottleCaps;
    const list = document.getElementById('raccoon-stock-list');
    if (!list) return;
    list.innerHTML = '';
    (this._raccoonStock || []).forEach((stock, idx) => {
      const f = stock.fish;
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML = `
        <div class="shop-card-icon">${f.emoji}</div>
        <div class="shop-card-info">
          <h3>Cooked ${f.name}</h3>
          <p>A ready-to-eat catch from the raccoon's smoker.</p>
          <div class="shop-card-price">♻️ ${stock.cost} Bottle Caps</div>
        </div>
        <button class="btn-buy" ${this.player.bottleCaps < stock.cost ? 'disabled' : ''}>Buy</button>`;
      card.querySelector('button').addEventListener('click', () => this.buyRaccoonItem(idx));
      list.appendChild(card);
    });
  },

  buyRaccoonItem(idx) {
    const stock = (this._raccoonStock || [])[idx];
    if (!stock || this.player.bottleCaps < stock.cost) return;
    const f = stock.fish;
    const item = {
      name: `Cooked ${f.name}`, type: 'food', value: f.value, emoji: f.emoji,
      isFish: true, cooked: true,
    };
    if (!this.player.addItem(item)) {
      this._notifyBackpackFull('No room for that fish.');
      return;
    }
    this.player.bottleCaps -= stock.cost;
    this.playSound('collect');
    this.showAlert(`♻️ Traded for a Cooked ${f.name}!`);
    this.saveProfile();
    this.updateHUD();
    this.updateRaccoonShopUI();
  },

  /**
   * Purchase items from the shop
   */
  purchaseUpgrade(itemId) {
    const cost = UPGRADE_COSTS[itemId];

    if (this.player.pebbles >= cost) {
      this.player.pebbles -= cost;
      this.playSound('upgrade');

      if (itemId === 'booties') this.player.hasBooties = true;
      if (itemId === 'canteen') {
        this.player.hasCanteen = true;
        this.player.canteenCharge = 1;
      }
      if (itemId === 'rod') {
        this.player.hasRod = true;
        this.showAlert('🎣 Fishing Rod! Stand at the water\'s edge and press Action to cast.');
      }
      if (itemId === 'backpack') {
        this.player.backpackCapacity = 12;
      }
      if (itemId === 'helmet') {
        this.player.hasHelmet = true;
        document.getElementById('helmet-indicator').classList.remove('hidden');
      }
      if (itemId === 'airhelmet') {
        this.player.hasAirHelmet = true;
        this.showAlert('🫧 Air Helmet stowed! Visit the pet bed at your cabin to leave a companion home safely.');
      }
      if (itemId === 'scarecrow') {
        this.hasScarecrow = true;
        this.showAlert('🎃 Scarecrow raised! Your home farm crops are safe from crows.');
      }

      this.updateShopUI();
      this.updateHUD();
      this.saveProfile();
    }
  },

  /**
   * Buy a single Lockpick with pebbles — a consumable that snaps on use
   * (unlike the flag-style upgrades above), so unlike purchaseUpgrade it's
   * never marked "owned" and can be bought again any time you're out.
   */
  buyLockpick() {
    const cost = LOCKPICK_COST;
    if (this.player.pebbles < cost) return;
    this.player.pebbles -= cost;
    this.player.tools.lockpick = (this.player.tools.lockpick || 0) + 1;
    this.playSound('upgrade');
    this.updateShopUI();
    this.updateHUD();
    this.saveProfile();
  },

  /**
   * Refresh item pricing and ownership details in the shop
   */
  updateShopUI() {
    document.getElementById('shop-pebbles-value').innerText = this.player.pebbles;

    const btnBooties = document.getElementById('btn-buy-booties');
    if (this.player.hasBooties) {
      btnBooties.classList.add('owned');
    } else {
      btnBooties.disabled = this.player.pebbles < UPGRADE_COSTS.booties;
    }

    const btnCanteen = document.getElementById('btn-buy-canteen');
    if (this.player.hasCanteen) {
      btnCanteen.classList.add('owned');
    } else {
      btnCanteen.disabled = this.player.pebbles < UPGRADE_COSTS.canteen;
    }

    const btnRod = document.getElementById('btn-buy-rod');
    if (btnRod) {
      if (this.player.hasRod) {
        btnRod.classList.add('owned');
      } else {
        btnRod.disabled = this.player.pebbles < UPGRADE_COSTS.rod;
      }
    }

    const btnBackpack = document.getElementById('btn-buy-backpack');
    if (this.player.backpackCapacity > 6) {
      btnBackpack.classList.add('owned');
    } else {
      btnBackpack.disabled = this.player.pebbles < UPGRADE_COSTS.backpack;
    }

    const btnHelmet = document.getElementById('btn-buy-helmet');
    if (this.player.hasHelmet) {
      btnHelmet.classList.add('owned');
    } else {
      btnHelmet.disabled = this.player.pebbles < UPGRADE_COSTS.helmet;
    }

    const btnAirHelmet = document.getElementById('btn-buy-airhelmet');
    if (btnAirHelmet) {
      if (this.player.hasAirHelmet) {
        btnAirHelmet.classList.add('owned');
      } else {
        btnAirHelmet.disabled = this.player.pebbles < UPGRADE_COSTS.airhelmet;
      }
    }

    // Lockpick: consumable, never "owned" — just re-buyable whenever affordable
    const btnLockpick = document.getElementById('btn-buy-lockpick');
    if (btnLockpick) {
      btnLockpick.disabled = this.player.pebbles < LOCKPICK_COST;
      const owned = document.getElementById('lockpick-owned-count');
      if (owned) owned.innerText = this.player.tools.lockpick || 0;
    }

    const btnScarecrow = document.getElementById('btn-buy-scarecrow');
    if (btnScarecrow) {
      if (this.hasScarecrow) {
        btnScarecrow.classList.add('owned');
      } else {
        btnScarecrow.disabled = this.player.pebbles < UPGRADE_COSTS.scarecrow;
      }
    }
  },
};
