/**
 * Player class represents Axel the Axolotl.
 * Handles movement physics, hydration state, upgrades, inventory,
 * and procedural 2D canvas drawing (including the Water Helmet).
 */
import { Sprites, spriteReady, BUSH_SPRITE } from './AssetLoader.js';

/** Identity key used to decide whether two backpack items stack together. */
export function stackKey(item) {
  return `${item.name}|${item.type}|${item.cooked ? 1 : 0}|${item.isFish ? 1 : 0}`;
}

export class Player {
  constructor(x, y) {
    // Spatial properties
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.baseSpeed = 160; // Pixels per second
    
    // Movement angles/animations
    this.angle = 0;
    this.tailWiggle = 0;
    this.tailSpeed = 15;
    this.swimPhase = 0;

    // Game stats
    this.hydration = 100;
    this.maxHydration = 100;
    this.hydrationDrainRate = 4.5; // units per second on land
    this.hydrationFillRate = 40;  // units per second in water
    
    // Pebbles (Currency) & Backpack (Inventory)
    this.pebbles = 0;
    this.bottleCaps = 0; // Recycling currency — earned from the Sewer Rat, spent at the Raccoon Shop
    this.items = [];
    this.backpackCapacity = 6;

    // Material pouch (stacking, doesn't use loot slots) + crafted tools
    this.materials = {};
    this.tools = {};
    this.speedBoostT = 0;   // seconds of snack speed boost remaining
    this.inPortableBush = false; // hiding via a crafted Bush Kit

    // Upgrades
    this.hasBooties = false;
    this.hasCanteen = false;
    this.canteenCharge = 0; // 0 = empty, 1 = charged
    this.hasHelmet = false; // The ultimate upgrade!
    this.hasAirHelmet = false; // Lets a companion breathe if left at the flooded home cabin
    this.hasRod = false;    // Fishing rod — unlocks the fishing minigame
    this.hasSturdyLine = false; // Braided Line (Fish Market) — wider catch bar
    this.baitCharges = 0;       // Fishing Bait (Fish Market) — guarantees next bite

    // Cosmetic skin (Wardrobe / Unlockables) — hue drives all body colors below
    this.skinId = 'default';
    this.skinHue = 335;

    // State
    this.inWater = true;
    this.isHiding = false;
    this.isDead = false;

    // Underwater diving (ocean/large-pond dive mode)
    this.isDiving = false;
    this.oxygen = 60;
    this.maxOxygen = 60;

    // Fire-touch reaction: a quick "ouch!" speech bubble + gentle knockback
    // away from the flame. No health system exists, so this is purely a
    // startle reaction — no damage, just a beat of forced retreat.
    this.ouchT = 0;
    this.ouchDX = 0;
    this.ouchDY = 0;

    // Bubble particles for the Water Helmet
    this.helmetParticles = [];
    for (let i = 0; i < 8; i++) {
      this.helmetParticles.push({
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 16,
        r: Math.random() * 1.5 + 0.5,
        vy: -(Math.random() * 8 + 4)
      });
    }
  }

  /**
   * Reset player for a new attempt, preserving shop upgrades and pebbles.
   */
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.hydration = 100;
    this.items = [];
    this.inWater = true;
    this.isHiding = false;
    this.isDead = false;
    this.isDiving = false;
    this.oxygen = this.maxOxygen;
    this.speedBoostT = 0;
    this.inPortableBush = false;
    if (this.hasCanteen) {
      this.canteenCharge = 1; // Recharge canteen on spawn
    }
  }

  /**
   * Update player physics, hydration, and animations.
   * @param {number} dt - delta time in seconds
   * @param {object} mv - movement vector {x, y}
   * @param {boolean} inWaterTile - is player currently standing/swimming in water?
   */
  update(dt, mv, inWaterTile) {
    if (this.isDead || this.isHiding) return;

    this.inWater = inWaterTile;

    // 1. Calculate Speed
    let speed = this.baseSpeed;
    if (this.inWater) {
      speed *= 1.2; // Move 20% faster while swimming
    } else if (this.hasBooties) {
      speed *= 1.25; // Booties speed buff on land
    }
    if (this.speedBoostT > 0) {
      this.speedBoostT -= dt;
      speed *= 1.35; // Snack rush!
    }

    // 2. Apply Movement
    if (mv.x !== 0 || mv.y !== 0) {
      this.x += mv.x * speed * dt;
      this.y += mv.y * speed * dt;
      this.angle = Math.atan2(mv.y, mv.x);

      // Animate wiggling tail
      this.tailWiggle += this.tailSpeed * dt;
      this.swimPhase += 8 * dt;
    } else {
      // Idle tail settling
      this.tailWiggle = Math.sin(Date.now() / 200) * 0.2;
    }

    // Fire-touch knockback: a short burst of forced drift away from the
    // flame, decaying out over the reaction window (see triggerOuch()).
    if (this.ouchT > 0) {
      this.ouchT -= dt;
      this.x += this.ouchDX * dt;
      this.y += this.ouchDY * dt;
      this.ouchDX *= 0.9;
      this.ouchDY *= 0.9;
    }

    // 3. Hydration Logic
    if (this.inWater) {
      // Refill hydration in water
      this.hydration = Math.min(this.maxHydration, this.hydration + this.hydrationFillRate * dt);
      
      // Recharge canteen if owned
      if (this.hasCanteen && this.canteenCharge === 0) {
        this.canteenCharge = 1;
      }
    } else {
      // Drain hydration on land if we don't have the Water Helmet
      if (!this.hasHelmet) {
        this.hydration -= this.hydrationDrainRate * dt;
        
        // Auto-refill from canteen if empty
        if (this.hydration <= 0) {
          if (this.hasCanteen && this.canteenCharge === 1) {
            this.hydration = 100;
            this.canteenCharge = 0; // Consume charge
          } else {
            this.hydration = 0;
            this.isDead = true;
          }
        }
      } else {
        // Hydration remains locked at max with helmet
        this.hydration = this.maxHydration;
      }
    }

    // Update Water Helmet bubble particles
    if (this.hasHelmet) {
      this.helmetParticles.forEach(p => {
        p.y += p.vy * dt;
        // Reset bubble if it rises too high or goes too wide
        if (p.y < -this.radius || Math.abs(p.x) > this.radius - 2) {
          p.y = this.radius * (Math.random() * 0.3 + 0.3);
          p.x = (Math.random() - 0.5) * (this.radius * 1.2);
        }
      });
    }
  }

  /**
   * Startle reaction for touching a campfire/grill: brief "ouch!" bubble
   * plus a knockback shove away from the flame. Purely cosmetic — there's
   * no health/damage system, so this is the whole hazard response.
   */
  triggerOuch(fromX, fromY) {
    if (this.ouchT > 0) return; // already reeling, don't re-trigger mid-knockback
    this.ouchT = 0.5;
    const dx = this.x - fromX, dy = this.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const kick = 220;
    this.ouchDX = (dx / dist) * kick;
    this.ouchDY = (dy / dist) * kick;
  }

  /** Add a stack of crafting material to the pouch. */
  addMaterial(id, n = 1) {
    this.materials[id] = (this.materials[id] || 0) + n;
    this.onInventoryChange?.();
  }

  /** Spend materials (assumes availability was checked). */
  spendMaterials(mats) {
    for (const [id, n] of Object.entries(mats)) {
      this.materials[id] = Math.max(0, (this.materials[id] || 0) - n);
      if (this.materials[id] === 0) delete this.materials[id];
    }
  }

  /**
   * Eat a food/drink item from the backpack: hydration top-up scaled by
   * value, plus a short speed boost. Returns false for non-edibles.
   */
  eatItem(index) {
    const item = this.items[index];
    if (!item || (item.type !== 'food' && item.type !== 'drink')) return false;
    this.hydration = Math.min(this.maxHydration, this.hydration + Math.min(40, item.value * 1.5));
    this.speedBoostT = 4;
    this.removeItem(index, 1);
    return true;
  }

  /**
   * Add an item to the backpack, stacking it onto an existing slot of the
   * same kind (same name/type/cooked state) when one exists so identical
   * loot (e.g. a haul of Bass) doesn't eat a slot per catch. `item.qty`
   * (defaults to 1) is the amount being added — used when merging a whole
   * stack back in from cabin storage. Returns true if it fit.
   */
  addItem(item) {
    const amount = item.qty || 1;
    const key = stackKey(item);
    const existing = this.items.find(i => stackKey(i) === key);
    if (existing) {
      existing.qty += amount;
      this.onInventoryChange?.();
      return true;
    }
    if (this.items.length < this.backpackCapacity) {
      this.items.push({ ...item, qty: amount });
      this.onInventoryChange?.();
      return true;
    }
    return false;
  }

  /**
   * Remove `amount` units from the stack at `index`, shrinking or deleting
   * it as needed. Returns a single-stack copy of what was removed (qty set
   * to however much actually came off), or null if there was nothing there.
   */
  removeItem(index, amount = 1) {
    const item = this.items[index];
    if (!item) return null;
    const taken = Math.min(amount, item.qty || 1);
    item.qty = (item.qty || 1) - taken;
    if (item.qty <= 0) this.items.splice(index, 1);
    this.onInventoryChange?.();
    return { ...item, qty: taken };
  }

  /**
   * Draw the player procedurally on the 2D canvas context.
   */
  draw(ctx) {
    // 2.5D Ground Shadow
    if (!this.isHiding) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.isHiding && !this.inWater) {
      // Portable Bush Kit: draw the actual bush over the player
      if (this.inPortableBush && spriteReady(Sprites.objects)) {
        const rustle = Math.sin(Date.now() / 180) * 1.5;
        ctx.drawImage(Sprites.objects, BUSH_SPRITE.sx, BUSH_SPRITE.sy, BUSH_SPRITE.sw, BUSH_SPRITE.sh,
          this.x - 26 + rustle, this.y - 34, 52, 40);
      }
      // Draw a subtle indication of where player is under a bush (e.g. rustling eyes)
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(255, 105, 180, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -1, 2, 0, Math.PI * 2);
      ctx.arc(3, -1, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // "Ouch!" reaction bubble, drawn upright above the head while reeling
    if (this.ouchT > 0) {
      ctx.save();
      ctx.font = 'bold 18px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔥😖', this.x, this.y - this.radius - 14 - Math.sin(this.ouchT * 30) * 2);
      ctx.restore();
    }

    // Calculate bouncing Y offset for 2.5D walk cycle
    const bounceY = this.inWater ? Math.sin(this.swimPhase) * 2 : Math.abs(Math.sin(this.swimPhase)) * -4;

    ctx.save();
    ctx.translate(this.x, this.y + bounceY);
    ctx.rotate(this.angle);

    const hue = this.skinHue;
    const bodyColor = `hsl(${hue}, 68%, 80%)`;
    const gillsColor = `hsl(${hue}, 58%, 61%)`;
    const gillsGlow = `hsl(${hue}, 65%, 72%)`;

    // 1. Draw Tail (Behind body)
    ctx.save();
    ctx.translate(-10, 0);
    // Apply wiggle animation
    const wiggleAngle = Math.sin(this.tailWiggle) * 0.3;
    ctx.rotate(wiggleAngle);
    
    // Tail fin shape
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(-12, -8, -20, -10);
    ctx.quadraticCurveTo(-14, 0, -20, 10);
    ctx.quadraticCurveTo(-12, 8, 0, 4);
    ctx.closePath();
    ctx.fill();

    // Wavy pink fin edge
    ctx.fillStyle = gillsColor;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.quadraticCurveTo(-22, -12, -26, -6);
    ctx.quadraticCurveTo(-20, 0, -26, 6);
    ctx.quadraticCurveTo(-22, 12, -12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Draw Back Feet (for land walk/water swimming)
    ctx.fillStyle = bodyColor;
    const legOffset = Math.sin(this.swimPhase) * 5;
    // Left leg
    ctx.beginPath();
    ctx.ellipse(-4, -10 + (this.inWater ? legOffset : -legOffset), 5, 8, -Math.PI/6, 0, Math.PI*2);
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.ellipse(-4, 10 + (this.inWater ? -legOffset : legOffset), 5, 8, Math.PI/6, 0, Math.PI*2);
    ctx.fill();

    // 3. Draw Main Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Draw Gills (Feathery gills, 3 on each side)
    const drawGill = (ctx, startX, startY, angleSign) => {
      ctx.save();
      ctx.translate(startX, startY);
      ctx.rotate(angleSign * (Math.PI / 4 + Math.sin(this.swimPhase) * 0.1));
      
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = gillsColor;
      
      // Draw gill branch
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(angleSign * 8, -12, angleSign * 16, -18);
      ctx.stroke();

      // Feathery spikes
      ctx.strokeStyle = gillsGlow;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(angleSign * 4, -4);
      ctx.lineTo(angleSign * 2, -10);
      ctx.moveTo(angleSign * 8, -9);
      ctx.lineTo(angleSign * 7, -15);
      ctx.moveTo(angleSign * 12, -14);
      ctx.lineTo(angleSign * 12, -20);
      ctx.stroke();
      
      ctx.restore();
    };

    // Draw left gills (pointing up/left)
    drawGill(ctx, -2, -6, -1);
    drawGill(ctx, -6, -6, -1.2);
    drawGill(ctx, -10, -5, -1.4);

    // Draw right gills (pointing down/right)
    drawGill(ctx, -2, 6, 1);
    drawGill(ctx, -6, 6, 1.2);
    drawGill(ctx, -10, 5, 1.4);

    // 5. Draw Head/Face Detail
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(8, 0, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(12, -5, 2.5, 0, Math.PI * 2);
    ctx.arc(12, 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Sparkle in eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(13, -6, 0.8, 0, Math.PI * 2);
    ctx.arc(13, 4, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Cute Smile
    ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(12, 0, 4, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();

    // Blushing cheeks
    ctx.fillStyle = 'rgba(255, 60, 140, 0.45)';
    ctx.beginPath();
    ctx.arc(9, -7, 2, 0, Math.PI * 2);
    ctx.arc(9, 7, 2, 0, Math.PI * 2);
    ctx.fill();

    // 6. Draw Booties if owned
    if (this.hasBooties && !this.inWater) {
      ctx.fillStyle = 'hsl(200, 100%, 60%)'; // Blue booties
      ctx.lineWidth = 1;
      // Front boots
      ctx.beginPath();
      ctx.arc(6, -8, 3, 0, Math.PI * 2);
      ctx.arc(6, 8, 3, 0, Math.PI * 2);
      ctx.fill();
      // Back boots
      ctx.beginPath();
      ctx.arc(-6, -10, 3.5, 0, Math.PI * 2);
      ctx.arc(-6, 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Draw Canteen carried on back
    if (this.hasCanteen && !this.hasHelmet) {
      ctx.save();
      ctx.translate(-4, 0);
      ctx.rotate(Math.PI / 4);
      // Flask strap
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      // Metal canteen bottle
      ctx.fillStyle = this.canteenCharge === 1 ? '#0ea5e9' : '#64748b';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-1, -7, 2, 2);
      ctx.restore();
    }

    ctx.restore(); // Restore body transformation

    // 8. Draw Water Helmet (Special Visual Effect centered on head, unaffected by rot for stability)
    if (this.hasHelmet) {
      ctx.save();
      // Head position relative to player center is roughly +8px forward in direction of angle
      const headX = this.x + Math.cos(this.angle) * 6;
      const headY = this.y + bounceY + Math.sin(this.angle) * 6;
      ctx.translate(headX, headY);

      // Glass bubble fill (semi-transparent cyan/blue water)
      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 24);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
      grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.65)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.fill();

      // Bubble shine (glass highlight)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 21, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();

      // Draw active bubble particles floating inside the helmet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this.helmetParticles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Gold collar clamp at the bottom of the helmet
      ctx.strokeStyle = '#fbbf24'; // Gold
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Collar arcs around the base relative to player body angle
      const baseAngle = this.angle + Math.PI; // Opposite to forward
      ctx.arc(0, 0, 23, baseAngle - Math.PI / 4, baseAngle + Math.PI / 4);
      ctx.stroke();

      ctx.restore();
    }
  }
}
