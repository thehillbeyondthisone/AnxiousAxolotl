/** Game prototype methods; Game coordinates their shared receiver. */
import { LockpickMinigame } from './Lockpicking.js';
import { Pet, PET_KINDS, TAME_REQUIREMENTS } from './Pet.js';
import { MATERIALS, RECIPES, TOOLS, canCraft } from './Crafting.js';

export const InteractionsMethods = {
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
      this.recordProgress('talk');
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
  },

  _findCookSpot() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'campfire' && d.type !== 'grill') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 60) return d;
    }
    return null;
  },

  _findCabinDecor(type) {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== type) continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 55) return d;
    }
    return null;
  },

  _findComputerAt() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'computer') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 62) return d;
    }
    return null;
  },

  _findRegisterAt() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'register') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 62) return d;
    }
    return null;
  },

  _findRaccoonDen() {
    if (!this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'raccoonden') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 60) return d;
    }
    return null;
  },

  _findHomeUpgradeVendor() {
    if (this.world.areaType !== 'woods' || !this.world.decorations) return null;
    for (const d of this.world.decorations) {
      if (d.type !== 'homevendor') continue;
      if (Math.hypot(this.player.x - d.x, this.player.y - d.y) < 62) return d;
    }
    return null;
  },

  _findCabinBed() {
    if (!this.world.isHomeCabin) return null;
    for (const c of this.world.colliders) {
      if (c.type !== 'bed') continue;
      const cx = c.x + (c.w || 0) / 2, cy = c.y + (c.h || 0) / 2;
      if (Math.hypot(this.player.x - cx, this.player.y - cy) < 60) return c;
    }
    return null;
  },

  sleepInBed() {
    if (this._sleeping || this.state !== 'playing') return;
    this._sleeping = true;
    this.state = 'sleeping';
    this.input.reset();
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
      this._sleeping = false;
      this.state = 'playing';
      this.lastTime = performance.now();
      setTimeout(() => overlay.classList.remove('active'), 30);
    }, 400);
  },

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
    this.recordProgress('sell', soldCount);
    this.updateHUD();
    this.saveProfile();

    const capsLine = totalCaps > 0 ? ` And ${totalCaps} Bottle Caps for that litter — the Raccoon down the street will trade those for treats!` : '';
    this.setDialogueText(totalEarnings > 0
      ? `Squeak! Fantastic! Here is your ${totalEarnings} Shiny Pebbles.${capsLine} Come back when you find more food!`
      : `Squeak! Thanks for tidying up!${capsLine}`);
    document.getElementById('btn-dialogue-action').style.display = 'none';
  },

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
  },

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
  },

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
  },
  _findDoorAt() {
    if (this.world.isInterior) return null;
    for (const box of this.world.colliders) {
      if (box.type !== 'cabin' && box.type !== 'cafe' && box.type !== 'shop' && box.type !== 'homecabin') continue;
      const dx = this.player.x - (box.x + box.w / 2);
      const dy = this.player.y - (box.y + box.h + 14);
      if (Math.hypot(dx, dy) < 52) return box;
    }
    return null;
  },

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
  },

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
  },

  playWithPet(idx) {
    const pet = this.pets[idx];
    if (!pet) return;
    pet.play();
    this.saveProfile();
    this.playSound('collect');
    this.updatePetChip();
    this.updatePetUI();
  },

  _findWildPetAt() {
    for (const wp of this.wildPets) {
      if (Math.hypot(this.player.x - wp.x, this.player.y - wp.y) < 55) return wp;
    }
    return null;
  },

  _findLeashableCritterAt() {
    if ((this.player.tools.leash || 0) <= 0) return null;
    let target = null, best = 55;
    for (const c of this.critters) {
      if (c.leashed) continue;
      const d = Math.hypot(this.player.x - c.x, this.player.y - c.y);
      if (d < best) { best = d; target = c; }
    }
    return target;
  },

  _findFollowingPetNearBed() {
    if (!this.world.isHomeCabin || !this.world.petBedSpot) return null;
    const spot = this.world.petBedSpot;
    if (Math.hypot(this.player.x - spot.x, this.player.y - spot.y) > 50) return null;
    return this.pets.find(p => !p.atHome) || null;
  },

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
      this.recordProgress('adopt');
      this.playSound('upgrade');
      this.showAlert(`🎉 The ${wp.name.toLowerCase()} is tamed! They'll follow you now.`);
      this.saveProfile();
      this.updatePetChip();
    } else {
      this.spawnFloater(wp.x, wp.y - 24, `${result.progress}/${result.needed}`, '#f472b6');
      this.showAlert(`${PET_KINDS[wp.kind].emoji} Munch! (${result.progress}/${result.needed} — fed the ${item.name})`);
    }
    this.updateHUD();
  },

  storeItem(index) {
    if (index < 0 || index >= this.player.items.length) return;
    const item = this.player.items.splice(index, 1)[0];
    this.cabinStorage.items.push(item);
    this.playSound('collect');
    this.saveProfile();
    this.updateHUD();
    this.updateCabinStorageUI();
  },

  takeItem(index) {
    if (index < 0 || index >= this.cabinStorage.items.length) return;
    const item = this.cabinStorage.items[index];
    if (!this.player.addItem(item)) { this._notifyBackpackFull('No room to take that item from storage.'); return; }
    this.cabinStorage.items.splice(index, 1);
    this.playSound('collect');
    this.saveProfile();
    this.updateHUD();
    this.updateCabinStorageUI();
  },

  assignQuest() {
    // Fishing-related quests only make sense once the player owns a rod
    const needsRod = new Set(['fish', 'marketsell']);
    const pool = this.constructor.QUESTS.filter(q =>
      q.id !== this._lastQuestId && (!needsRod.has(q.type) || this.player.hasRod));
    const q = pool[Math.floor(Math.random() * pool.length)];
    this.quest = { ...q, progress: 0 };
    this._lastQuestId = q.id;
    this.updateQuestChip();
    this.saveProfile();
  },

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
    this.saveProfile();
  },

  craftItem(recipe) {
    if (!canCraft(recipe, this.player.materials)) return;
    this.player.spendMaterials(recipe.mats);
    this.player.tools[recipe.id] = (this.player.tools[recipe.id] || 0) + 1;
    this.playSound('upgrade');
    this.questEvent('craft');
    this.updateCraftUI();
    this.saveProfile();
  },

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
      this.saveProfile();
      this.closeBackpack();
      return;
    } else if (id === 'decoy') {
      if (this.world.isInterior) { this.showAlert('🦆 Not enough room in here!'); return; }
      p.tools[id]--;
      this.decoys.push({ x: p.x + 20, y: p.y + 20, t: 9 });
      this.playSound('collect');
      this.showAlert('🦆 Decoy placed! Guards can\'t resist a duck.');
      this.saveProfile();
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
    this.saveProfile();
  },

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
  },

  _stunnerTarget() {
    let target = null;
    let bestDist = this.constructor.STUNNER_RANGE;
    for (const g of this.guards) {
      if (g.state === 'stunned') continue;
      const d = Math.hypot(this.player.x - g.x, this.player.y - g.y);
      if (d < bestDist) { bestDist = d; target = g; }
    }
    return target;
  },

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
  },

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
  },

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
    this.saveProfile();
  },

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
  },
};
