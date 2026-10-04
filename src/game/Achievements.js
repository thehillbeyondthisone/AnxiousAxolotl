/**
 * Achievements — a declarative, data-only registry so new milestones can be
 * added with a single entry (no wiring). Every entry is a pure condition
 * over two inputs the Game already maintains:
 *
 *   stats  - lifetime counters (Game.stats, persisted) plus a couple of
 *            derived fields folded in at check time (pebblesLifetime,
 *            foodSoldLifetime — see Game._unlockCheck)
 *   player - the live Player instance, for flag-based unlocks (hasHelmet,
 *            hasRod, backpackCapacity, ...) that don't need their own counter
 *
 * Game.updateHUD() calls AchievementTracker.checkAll() every frame; it's a
 * handful of cheap comparisons, so new achievements never need a dedicated
 * call site — just add a row below.
 */

export const ACHIEVEMENTS = [
  { id: 'first_cast', name: "Gone Fishin'", desc: 'Catch your first fish.', icon: '🎣',
    condition: (s) => s.fishCaught >= 1 },
  { id: 'angler', name: 'Angler', desc: 'Catch 10 fish.', icon: '🐟',
    condition: (s) => s.fishCaught >= 10 },
  { id: 'master_angler', name: 'Master Angler', desc: 'Catch 25 fish.', icon: '🎏',
    condition: (s) => s.fishCaught >= 25 },
  { id: 'first_meal', name: 'Campfire Cook', desc: 'Cook your first dish.', icon: '🍳',
    condition: (s) => s.dishesCooked >= 1 },
  { id: 'iron_chef', name: 'Iron Chef', desc: 'Cook 5 perfect dishes.', icon: '✨',
    condition: (s) => s.perfectDishes >= 5 },
  { id: 'locksmith', name: 'Locksmith', desc: 'Successfully pick a lock.', icon: '🗝️',
    condition: (s) => s.locksOpened >= 1 },
  { id: 'butter_fingers', name: 'Butter Fingers', desc: 'Snap 3 lockpicks in a moment of panic.', icon: '💥',
    hidden: true, condition: (s) => s.locksBroken >= 3 },
  { id: 'fish_monger', name: 'Fish Monger', desc: 'Sell 20 fish to the Fish Market.', icon: '🏪',
    condition: (s) => s.marketFishSold >= 20 },
  { id: 'quest_runner', name: 'Errand Runner', desc: "Complete 5 of the rat's quests.", icon: '📜',
    condition: (s) => s.questsCompleted >= 5 },
  { id: 'well_equipped', name: 'Well Equipped', desc: 'Own the rod, booties, canteen, and a bigger backpack.', icon: '🎒',
    condition: (_s, p) => p.hasRod && p.hasBooties && p.hasCanteen && p.backpackCapacity > 3 },
  { id: 'dry_land', name: 'Dry Land Forever', desc: 'Buy the Water Helmet.', icon: '🪖',
    condition: (_s, p) => p.hasHelmet },
  { id: 'survivor', name: 'Seasoned Sneaker', desc: 'Reach Day 5 in a single run.', icon: '🌅',
    condition: (s) => s.maxDayReached >= 5 },
  { id: 'rich_axolotl', name: 'Shiny Hoarder', desc: 'Earn 500 lifetime Pebbles.', icon: '💰',
    condition: (s) => s.pebblesLifetime >= 500 },
  { id: 'leviathan', name: 'The Deep One', desc: 'Land the Ancient Leviathan.', icon: '🐡',
    hidden: true, condition: (s) => (s.leviathanCaught || 0) >= 1 },
];

export class AchievementTracker {
  /** @param {string[]} unlockedIds - previously unlocked ids, from the save profile */
  constructor(unlockedIds = []) {
    this.unlocked = new Set(unlockedIds);
  }

  /**
   * Evaluate every not-yet-unlocked achievement against current state.
   * @returns {object[]} newly unlocked achievement defs (empty if none)
   */
  checkAll(stats, player) {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id)) continue;
      if (a.condition(stats, player)) {
        this.unlocked.add(a.id);
        newly.push(a);
      }
    }
    return newly;
  }

  isUnlocked(id) { return this.unlocked.has(id); }

  /** { unlocked, total } for a progress readout in the panel header. */
  get progress() { return { unlocked: this.unlocked.size, total: ACHIEVEMENTS.length }; }

  /** Plain array of unlocked ids, for saveProfile(). */
  serialize() { return Array.from(this.unlocked); }
}
