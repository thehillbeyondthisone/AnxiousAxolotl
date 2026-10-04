/**
 * Pet — an adopted companion (puppy or kitten) that trails the player
 * around the resort, kept happy by feeding and playing. Drawn procedurally
 * on the 2D canvas (matching the player axolotl / decoy duck approach), so
 * it needs no sprite assets.
 *
 * Care model: `hunger` and `happiness` both sit on a 0–100 scale where 100
 * is best. Both slowly decay over time; feeding refills hunger and nudges
 * happiness, playing boosts happiness. A well-cared-for pet occasionally
 * sniffs out a Pebble for its owner.
 */

export const PET_KINDS = {
  puppy:  { name: 'Puppy',  emoji: '🐶', body: '#c8955c', belly: '#efd6ac', ear: '#8a5a30' },
  kitten: { name: 'Kitten', emoji: '🐱', body: '#9aa0a8', belly: '#e7ebef', ear: '#6b7078' },
};

// A meaty snack tames the puppy; the kitten holds out for a few fish.
const MEATY_FOOD_NAMES = new Set(['Hot Dog', 'Burger', 'Sandwich', 'Pizza Slice', 'Corn Dog']);
export const TAME_REQUIREMENTS = {
  puppy: {
    amount: 1,
    matchesItem: (item) => item.type === 'food' && MEATY_FOOD_NAMES.has(item.name),
    hint: 'sniffs at your bag, hoping for something meaty 🍖',
  },
  kitten: {
    amount: 3,
    matchesItem: (item) => item.type === 'fish',
    hint: "won't budge for anything but fish — bring a few 🐟",
  },
};

export class Pet {
  /**
   * @param {'puppy'|'kitten'} kind
   * @param {string} name
   * @param {number} x @param {number} y - spawn position (world px)
   * @param {boolean} tamed - false spawns a wild, wandering animal that
   *   must be fed its required food (see TAME_REQUIREMENTS) before it
   *   will follow the player.
   */
  constructor(kind, name, x, y, tamed = true) {
    this.kind = PET_KINDS[kind] ? kind : 'puppy';
    this.name = name || PET_KINDS[this.kind].name;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;                 // 1 = right, -1 = left
    this.state = 'idle';             // 'idle' | 'walk' | 'happy' | 'unleashed' | 'sleep'
    this.animTime = Math.random() * 10;
    this.hopPhase = 0;

    // Unleash: sent charging at a guard to bark/distract them for a bit
    this.unleashTimer = 0;
    this.unleashTarget = null;

    // Taming (wild pets only — tamed companions skip straight past this)
    this.tamed = tamed;
    this.tameProgress = 0;
    this.homeX = x; this.homeY = y;
    this.wanderState = 'idle';       // 'idle' | 'walk', wild wandering only
    this.wanderTimer = 1 + Math.random() * 2;

    // Care stats (0–100, higher is better)
    this.hunger = 80;
    this.happiness = 90;

    // true = left behind at the home cabin (wearing the Air Helmet to
    // survive the flooded interior) instead of following the player
    this.atHome = false;
    this.lastPlayRewardDay = 0;

    // Timers
    this._pebbleTimer = 30 + Math.random() * 30; // seconds until it may fetch a pebble
    this.happyTimer = 0;             // seconds of celebratory "happy" animation left
  }

  /** Overall mood emoji, derived from the two care stats. */
  get moodEmoji() {
    const avg = (this.hunger + this.happiness) / 2;
    if (avg > 70) return '😻';
    if (avg > 40) return '🙂';
    if (avg > 20) return '😟';
    return '😿';
  }

  /**
   * Trail the player, decay care stats, and occasionally fetch a Pebble.
   * @returns {number} pebbles fetched this frame (0 or a small reward)
   */
  /**
   * Unleash! Sic this tamed companion on a guard — it charges over and
   * barks/paws at them for a few seconds (a living decoy), then trots
   * back to following. Reusable, like the Sneak Stun Slingshot: just a
   * transient state, nothing consumed.
   */
  unleash(target, seconds = 4) {
    if (!this.tamed || this.atHome) return;
    this.state = 'unleashed';
    this.unleashTimer = seconds;
    this.unleashTarget = target;
  }

  update(dt, player, world) {
    this.animTime += dt;
    if (this.happyTimer > 0) this.happyTimer -= dt;

    if (!this.tamed) {
      this._updateWander(dt, world);
      return 0;
    }

    if (this.state === 'unleashed') {
      this.unleashTimer -= dt;
      const t = this.unleashTarget;
      if (this.unleashTimer <= 0 || !t) {
        this.state = 'idle';
        this.unleashTarget = null;
      } else {
        const dx = t.x - this.x, dy = t.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 30) {
          const a = Math.atan2(dy, dx);
          const speed = 150;
          const nx = this.x + Math.cos(a) * speed * dt;
          const ny = this.y + Math.sin(a) * speed * dt;
          const resolved = world.checkCollisions(nx, ny, 8);
          this.x = resolved.x; this.y = resolved.y;
          this.facing = Math.cos(a) >= 0 ? 1 : -1;
          this.hopPhase += dt * 14;
        }
      }
      return 0;
    }

    // Care stats slowly decay; a starving pet also loses happiness faster
    this.hunger = Math.max(0, this.hunger - 0.35 * dt);
    const moodDrain = this.hunger <= 0 ? 1.2 : 0.5;
    this.happiness = Math.max(0, this.happiness - moodDrain * dt);

    // Follow the player, keeping a small personal-space gap
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const followDist = 44;
    if (dist > followDist) {
      const a = Math.atan2(dy, dx);
      // Happier pets keep up more eagerly
      const speed = 70 + this.happiness * 0.9;
      const nx = this.x + Math.cos(a) * speed * dt;
      const ny = this.y + Math.sin(a) * speed * dt;
      const resolved = world.checkCollisions(nx, ny, 8);
      this.x = resolved.x; this.y = resolved.y;
      this.facing = Math.cos(a) >= 0 ? 1 : -1;
      this.state = 'walk';
      this.hopPhase += dt * 12;
    } else {
      this.state = this.happyTimer > 0 ? 'happy' : 'idle';
    }

    // A content pet sniffs out the occasional Pebble
    let reward = 0;
    this._pebbleTimer -= dt;
    if (this._pebbleTimer <= 0) {
      this._pebbleTimer = 35 + Math.random() * 40;
      if (this.happiness > 55 && this.hunger > 25) {
        reward = 1 + Math.floor(Math.random() * 2);
        this.happyTimer = 1.2;
      }
    }
    return reward;
  }

  /** Wild (untamed) pets loiter near their spawn point instead of following. */
  _updateWander(dt, world) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderState = this.wanderState === 'walk' ? 'idle' : 'walk';
      if (this.wanderState === 'walk') {
        this.wanderTimer = 1 + Math.random() * 1.5;
        const a = Math.random() * Math.PI * 2;
        this.vx = Math.cos(a) * 30;
        this.vy = Math.sin(a) * 30;
      } else {
        this.wanderTimer = 1.5 + Math.random() * 2;
      }
    }

    if (this.wanderState === 'walk') {
      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;
      if (Math.hypot(nx - this.homeX, ny - this.homeY) < 70) {
        const resolved = world.checkCollisions(nx, ny, 8);
        this.x = resolved.x; this.y = resolved.y;
        this.facing = this.vx >= 0 ? 1 : -1;
        this.state = 'walk';
        this.hopPhase += dt * 10;
      } else {
        this.wanderTimer = 0; // hit the wander leash — turn and pick a new direction
      }
    } else {
      this.state = 'idle';
    }
  }

  /**
   * Offer a backpack item to a wild pet. Returns whether it was accepted
   * and whether that was the final feeding needed to tame it.
   * @returns {{accepted: boolean, tamedNow?: boolean, progress?: number, needed?: number}}
   */
  feedTame(item) {
    const req = TAME_REQUIREMENTS[this.kind];
    if (!req || !req.matchesItem(item)) return { accepted: false };
    this.tameProgress++;
    this.happyTimer = 1.2;
    if (this.tameProgress >= req.amount) {
      this.tamed = true;
      this.hunger = 80;
      this.happiness = 90;
      return { accepted: true, tamedNow: true };
    }
    return { accepted: true, tamedNow: false, progress: this.tameProgress, needed: req.amount };
  }

  /** Feed a food/drink item: refill hunger, small happiness bump. */
  feed() {
    this.hunger = Math.min(100, this.hunger + 45);
    this.happiness = Math.min(100, this.happiness + 12);
    this.happyTimer = 1.4;
  }

  /** Play with the pet: happiness boost, tiny hunger cost. */
  play() {
    this.happiness = Math.min(100, this.happiness + 22);
    this.hunger = Math.max(0, this.hunger - 4);
    this.happyTimer = 1.6;
  }

  draw(ctx, underwater = false) {
    const k = PET_KINDS[this.kind];
    const sleeping = this.state === 'sleep';
    const walking = this.state === 'walk' || this.state === 'unleashed';
    const happy = this.state === 'happy' || this.happyTimer > 0;
    // Bouncy hop while walking; excited little bounce when happy; a gentle
    // slow breathing rise/fall while sleeping in the pet bed
    const hop = sleeping ? Math.sin(this.animTime * 1.4) * 1.2
      : walking ? Math.abs(Math.sin(this.hopPhase)) * -4
      : (happy ? Math.abs(Math.sin(this.animTime * 10)) * -3 : 0);

    // Ground shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(this.x, this.y + hop);
    ctx.scale(this.facing, 1);

    const tailWag = Math.sin(this.animTime * (happy ? 18 : 6)) * (happy ? 0.9 : 0.4);

    // Tail
    ctx.strokeStyle = k.body;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.save();
    ctx.translate(-11, -8);
    ctx.rotate(-0.6 + tailWag);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (this.kind === 'kitten') ctx.quadraticCurveTo(-8, -6, -6, -16);
    else ctx.quadraticCurveTo(-8, -2, -12, -8);
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.fillStyle = k.body;
    ctx.beginPath();
    ctx.ellipse(-2, -8, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly patch
    ctx.fillStyle = k.belly;
    ctx.beginPath();
    ctx.ellipse(0, -4, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (little shuffle while walking)
    const legSwing = walking ? Math.sin(this.hopPhase) * 3 : 0;
    ctx.fillStyle = k.body;
    ctx.fillRect(-8, -2, 4, 7 + legSwing);
    ctx.fillRect(4, -2, 4, 7 - legSwing);

    // Head
    ctx.fillStyle = k.body;
    ctx.beginPath();
    ctx.arc(10, -14, 9, 0, Math.PI * 2);
    ctx.fill();

    // Ears — floppy for the puppy, pointy for the kitten
    ctx.fillStyle = k.ear;
    if (this.kind === 'kitten') {
      ctx.beginPath();
      ctx.moveTo(4, -20); ctx.lineTo(7, -28); ctx.lineTo(11, -21); ctx.closePath();
      ctx.moveTo(13, -21); ctx.lineTo(17, -28); ctx.lineTo(19, -20); ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(4, -16, 4, 7, 0.4, 0, Math.PI * 2);
      ctx.ellipse(17, -15, 3.5, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snout / muzzle
    ctx.fillStyle = k.belly;
    ctx.beginPath();
    ctx.ellipse(15, -12, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — closed sleepy lids while sleeping, open dots otherwise
    if (sleeping) {
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(7, -15); ctx.lineTo(11, -15);
      ctx.moveTo(13, -15); ctx.lineTo(17, -15);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(9, -15, 1.6, 0, Math.PI * 2);
      ctx.arc(15, -15, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nose
    ctx.fillStyle = this.kind === 'kitten' ? '#f472b6' : '#4b2e1a';
    ctx.beginPath();
    ctx.arc(17, -12, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Excited hearts when happy
    if (happy) {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.9)';
      const hy = -30 - (this.animTime * 20 % 10);
      ctx.font = '10px sans-serif';
      ctx.fillText('♥', 12, hy);
    }

    ctx.restore();

    // Mini Air Helmet — same glass-bubble-and-gold-collar look as the
    // player's Water Helmet, scaled down to fit a pet's head, whenever
    // they're actually underwater (submerged, or napping in the flooded
    // home cabin while the player carries the real one).
    if (underwater) {
      const headY = this.y + hop - 14;
      ctx.save();
      // Translate to the body center then mirror via scale (matching the
      // body's own transform above) so the highlight glint and collar gap
      // — not just the bubble's center point — flip sides when the pet
      // turns around, instead of staying glued to one side.
      ctx.translate(this.x, headY);
      ctx.scale(this.facing, 1);
      ctx.translate(10, 0);
      const grad = ctx.createRadialGradient(-1, -1, 1, 0, 0, 13);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
      grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.65)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 12, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 13, Math.PI * 0.75, Math.PI * 1.25);
      ctx.stroke();
      ctx.restore();
    }

    // Sleeping: a drifting little Zzz above the pet bed
    if (sleeping) {
      const zy = -30 - ((this.animTime * 10) % 16);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Zzz', this.x + 10, this.y + zy);
      ctx.textAlign = 'left';
    }

    // Unleashed: a little "grr!" bark bubble while charging a guard
    if (this.state === 'unleashed') {
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f97316';
      ctx.fillText('💢', this.x, this.y - 34 + Math.sin(this.animTime * 14) * 2);
      ctx.textAlign = 'left';
    }

    // Wild pets show what they want to eat, hovering above their head
    if (!this.tamed) {
      const bob = Math.sin(this.animTime * 2) * 2;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.kind === 'kitten' ? '🐟' : '🍖', this.x, this.y - 32 + bob);
      ctx.textAlign = 'left';
    }

    // Hungry tamed companions get a thought-bubble reminder — no need to
    // open the pet menu just to notice they need feeding.
    if (this.tamed && this.hunger < 50 && !sleeping && this.state !== 'unleashed') {
      const bob = Math.sin(this.animTime * 2.4) * 2;
      // Pulsing hunger indicator: bigger and more visible as hunger gets worse
      const intensity = Math.max(0.6, 1 - this.hunger / 50);
      const size = 18 + intensity * 6;
      ctx.font = `bold ${Math.round(size)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(244, 114, 182, ${0.7 + intensity * 0.3})`;
      ctx.fillText('🍖', this.x, this.y - 32 + bob);
      ctx.textAlign = 'left';
    }
  }

  serialize() {
    return {
      kind: this.kind, name: this.name,
      hunger: this.hunger, happiness: this.happiness,
      atHome: this.atHome,
      lastPlayRewardDay: this.lastPlayRewardDay,
      pebbleTimer: this._pebbleTimer,
    };
  }

  static fromData(data, x, y) {
    if (!data || !data.kind) return null;
    const p = new Pet(data.kind, data.name, x, y, true);
    if (typeof data.hunger === 'number') p.hunger = data.hunger;
    if (typeof data.happiness === 'number') p.happiness = data.happiness;
    p.atHome = !!data.atHome;
    p.lastPlayRewardDay = data.lastPlayRewardDay || 0;
    if (typeof data.pebbleTimer === 'number') p._pebbleTimer = data.pebbleTimer;
    return p;
  }
}
