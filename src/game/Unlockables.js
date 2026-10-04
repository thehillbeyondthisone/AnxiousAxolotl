/**
 * Unlockables — cosmetic skins for Axel, granted automatically when their
 * linked achievement unlocks. There's no separate "owned" state to persist:
 * ownership is derived live from AchievementTracker.isUnlocked(unlockedBy),
 * so this registry stays pure data (like Achievements.js) — add a skin by
 * adding a row, no wiring required. Only the currently-equipped skin id is
 * persisted (Player.skinId, via SaveManager).
 */

export const SKINS = [
  { id: 'default', name: 'Classic Pink', hue: 335, unlockedBy: null },
  { id: 'ocean_blue', name: 'Ocean Blue', hue: 200, unlockedBy: 'first_cast' },
  { id: 'sunset_orange', name: 'Sunset Orange', hue: 24, unlockedBy: 'angler' },
  { id: 'ember_red', name: 'Ember Red', hue: 355, unlockedBy: 'iron_chef' },
  { id: 'golden_glow', name: 'Golden Glow', hue: 45, unlockedBy: 'dry_land' },
  { id: 'moonlit_purple', name: 'Moonlit Purple', hue: 265, unlockedBy: 'survivor' },
  { id: 'abyssal_teal', name: 'Abyssal Teal', hue: 170, unlockedBy: 'leviathan' },
];

/** Is this skin available to equip right now? */
export function isSkinUnlocked(skin, achievements) {
  return skin.unlockedBy === null || achievements.isUnlocked(skin.unlockedBy);
}

/** Look up a skin by id, falling back to the default (e.g. if a save
 * references a skin that no longer exists, or whose unlock got reset). */
export function findSkin(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}
