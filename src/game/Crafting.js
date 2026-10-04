/**
 * Crafting data: material definitions and the Sewer Rat's recipe book.
 * Materials stack in the player's pouch (separate from loot slots);
 * recipes are crafted only at the rat ("Rat-crafting").
 */

export const MATERIALS = {
  driftwood: { name: 'Driftwood', emoji: '🪵' },
  string:    { name: 'String', emoji: '🧵' },
  bottlecap: { name: 'Bottle Cap', emoji: '🔩' },
  shell:     { name: 'Shell', emoji: '🐚' },
  wax:       { name: 'Candle Wax', emoji: '🕯️' },
  scrap:     { name: 'Shiny Scrap', emoji: '📎' },
  feather:   { name: 'Feather', emoji: '🪶' },
};

export const RECIPES = [
  {
    id: 'decoy', name: 'Decoy Duck', emoji: '🦆',
    mats: { driftwood: 2, wax: 1 },
    desc: 'Place it anywhere — nearby guards can\'t resist investigating it.'
  },
  {
    id: 'bushkit', name: 'Bush Kit', emoji: '🌳',
    mats: { feather: 1, string: 2 },
    desc: 'A wearable bush. Hide on the spot, anywhere, one use.'
  },
  {
    id: 'squirt', name: 'Squirt Canteen', emoji: '💧',
    mats: { bottlecap: 1, shell: 1 },
    desc: 'One full hydration refill, whenever you need it.'
  },
  {
    id: 'leash', name: 'Critter Leash', emoji: '🪢',
    mats: { string: 3, feather: 1 },
    desc: 'Tether a nearby chicken or cow — it\'ll follow you around the resort.'
  },
  {
    id: 'stunner', name: 'Knockout Cudgel', emoji: '🏏',
    mats: { bottlecap: 2, scrap: 1 },
    desc: 'Sneak up close and clock a guard with it, knocking them out for a few seconds. Reusable — never breaks.'
  },
];

export const TOOLS = {
  decoy:    { name: 'Decoy Duck', emoji: '🦆', use: 'Place' },
  lockpick: { name: 'Lockpick', emoji: '🗝️', use: null }, // passive; bought at the Shop, not crafted
  bushkit:  { name: 'Bush Kit', emoji: '🌳', use: 'Hide' },
  squirt:   { name: 'Squirt Canteen', emoji: '💧', use: 'Drink' },
  leash:    { name: 'Critter Leash', emoji: '🪢', use: 'Leash' },
  stunner:  { name: 'Knockout Cudgel', emoji: '🏏', use: 'Knock Out' },
};

/** Can the player afford a recipe? */
export function canCraft(recipe, materials) {
  return Object.entries(recipe.mats).every(([id, n]) => (materials[id] || 0) >= n);
}
