/**
 * Preloads sprite sheets sourced from the Sprout Lands asset pack
 * (by Cup Nooble, non-commercial license, credit required — see
 * src/assets/read_me.txt) and exposes the crop rects for the pieces
 * we actually use.
 */
import objectsUrl from '../assets/Objects/Basic_Grass_Biom_things.png';
import houseUrl from '../assets/Early Access/Village pack/houses/small house/small_House_with_door_grass.png';
import brickHouseUrl from '../assets/Early Access/Village pack/houses/Grey brick house/grey_brick_houses_with_doors_grass.png';
import chestUrl from '../assets/Early Access/Plant update 2/Furniture/Oak_Chest.png';
import fenceUrl from '../assets/Tilesets/Fences.png';
import charUrl from '../assets/Characters/Basic Charakter Spritesheet.png';
import chickenUrl from '../assets/Characters/Free Chicken Sprites.png';
import cowUrl from '../assets/Characters/Free Cow Sprites.png';
import furnitureUrl from '../assets/Objects/Basic_Furniture.png';
import grassUrl from '../assets/Tilesets/Grass.png';
import waterUrl from '../assets/Tilesets/Water.png';
import dirtUrl from '../assets/Tilesets/Tilled_Dirt.png';
import interiorUrl from '../assets/Tilesets/tileset_16x16_interior.png';
import recycleUrl from '../assets/Objects/recycle_items.png';
import buildingRoofUrl from '../assets/Tilesets/Wooden_House_Roof_Tilset.png';
import buildingWallsUrl from '../assets/Tilesets/Wooden_House_Walls_Tilset.png';
import buildingDoorsUrl from '../assets/Tilesets/Doors.png';

// --- Sprout Lands Premium pack + "more interiors" pack additions ---
import chickenBlueUrl from '../assets/Characters/chicken_blue.png';
import chickenBrownUrl from '../assets/Characters/chicken_brown.png';
import chickenGreenUrl from '../assets/Characters/chicken_green.png';
import chickenRedUrl from '../assets/Characters/chicken_red.png';
import chickenBabyDefaultUrl from '../assets/Characters/chicken_baby_default.png';
import chickenBabyBlueUrl from '../assets/Characters/chicken_baby_blue.png';
import chickenBabyBrownUrl from '../assets/Characters/chicken_baby_brown.png';
import chickenBabyGreenUrl from '../assets/Characters/chicken_baby_green.png';
import chickenBabyRedUrl from '../assets/Characters/chicken_baby_red.png';
import cowBrownUrl from '../assets/Characters/cow_brown.png';
import cowGreenUrl from '../assets/Characters/cow_green.png';
import cowLightUrl from '../assets/Characters/cow_light.png';
import cowPinkUrl from '../assets/Characters/cow_pink.png';
import cowPurpleUrl from '../assets/Characters/cow_purple.png';
import cowBabyBrownUrl from '../assets/Characters/cow_baby_brown.png';
import cowBabyGreenUrl from '../assets/Characters/cow_baby_green.png';
import cowBabyLightUrl from '../assets/Characters/cow_baby_light.png';
import cowBabyPinkUrl from '../assets/Characters/cow_baby_pink.png';
import cowBabyPurpleUrl from '../assets/Characters/cow_baby_purple.png';
import fantasyPigUrl from '../assets/Cute_Fantasy_Free/Animals/Pig/Pig.png';
import fantasySheepUrl from '../assets/Cute_Fantasy_Free/Animals/Sheep/Sheep.png';

import treeAppleUrl from '../assets/Objects/tree_apple.png';
import treeOrangeUrl from '../assets/Objects/tree_orange.png';
import treePeachUrl from '../assets/Objects/tree_peach.png';
import treePearUrl from '../assets/Objects/tree_pear.png';
import darkerGrassUrl from '../assets/Tilesets/darker_grass_tiles.png';

import waterWellUrl from '../assets/Objects/water_well.png';
import workStationUrl from '../assets/Objects/work_station.png';
import signsUrl from '../assets/Objects/signs.png';
import piknikBasketUrl from '../assets/Objects/piknik_basket.png';
import piknikBlanketUrl from '../assets/Objects/piknik_blanket.png';
import boatsUrl from '../assets/Objects/boats.png';
import chickenHousesUrl from '../assets/Tilesets/chicken_houses.png';
import waterTrayUrl from '../assets/Tilesets/water_tray.png';
import mailboxUrl from '../assets/Tilesets/mailbox.png';
import farmingPlantsUrl from '../assets/Early Access/Plant update 2/Farming Plants v2.png';
import farmingPlantsWateredUrl from '../assets/Early Access/Plant update 2/Farming Plants v2 watered.png';
import farmingItemsUrl from '../assets/Early Access/Plant update 2/Farming Plants items v2.png';
import emojiSheetUrl from '../assets/emojis-free/Emoji_Spritesheet_Free.png';
import allIconsUrl from '../assets/Sprite sheets/Icons/All Icons.png';

import floorsWallsUrl from '../assets/Interiors/floors_and_walls.png';
import furnitureWarmUrl from '../assets/Interiors/furniture_state1.png';
import furnitureCoolUrl from '../assets/Interiors/furniture_state2.png';
import smallItemsUrl from '../assets/Interiors/small_items.png';
import modernInteriorsUrl from '../assets/Interiors/modern_interiors.png';
import catTowerUrl from '../assets/pet-assets/CAT_TOWER.png';
import dogHouseUrl from '../assets/pet-assets/DOG_HOUSE.png';
import petPropsUrl from '../assets/pet-assets/PET_PROPS.png';
import premiumFloraUrl from '../assets/PremiumPack/Plant/Trees_stumps_bushes_v2.png';
import premiumWoodMushroomsUrl from '../assets/PremiumPack/Plant/wood_n_shroms.png';
import premiumHutsUrl from '../assets/PremiumPack/Village/small_hut/small_huts_with_doors_grass.png';
import premiumFishUrl from '../assets/PremiumPack/Ocean/Fish_Sprites.png';
import premiumFrogUrl from '../assets/PremiumPack/Frog/frog_spritesheet.png';
import premiumBigFishUrl from '../assets/PremiumPack/Ocean/big_fish_2_swimming_in_cirkels.png';
import premiumFishingSplashUrl from '../assets/PremiumPack/Ocean/fishing_water_splash_frames_and_rod.png';

import { loadImage as registeredImage } from './ImageRegistry.js';
const loadImage = src => registeredImage(src, { group: 'core' });

export const Sprites = {
  objects: loadImage(objectsUrl),
  house: loadImage(houseUrl),
  brickHouse: loadImage(brickHouseUrl),
  chest: loadImage(chestUrl),
  fence: loadImage(fenceUrl),
  character: loadImage(charUrl),
  chicken: loadImage(chickenUrl),
  cow: loadImage(cowUrl),
  furniture: loadImage(furnitureUrl),
  grass: loadImage(grassUrl),
  water: loadImage(waterUrl),
  dirt: loadImage(dirtUrl),
  interior: loadImage(interiorUrl),
  recycle: loadImage(recycleUrl),
  buildingRoof: loadImage(buildingRoofUrl),
  buildingWalls: loadImage(buildingWallsUrl),
  buildingDoors: loadImage(buildingDoorsUrl),

  // Premium chicken/cow color variants + baby versions
  chickenBlue: loadImage(chickenBlueUrl),
  chickenBrown: loadImage(chickenBrownUrl),
  chickenGreen: loadImage(chickenGreenUrl),
  chickenRed: loadImage(chickenRedUrl),
  chickenBabyDefault: loadImage(chickenBabyDefaultUrl),
  chickenBabyBlue: loadImage(chickenBabyBlueUrl),
  chickenBabyBrown: loadImage(chickenBabyBrownUrl),
  chickenBabyGreen: loadImage(chickenBabyGreenUrl),
  chickenBabyRed: loadImage(chickenBabyRedUrl),
  cowBrown: loadImage(cowBrownUrl),
  cowGreen: loadImage(cowGreenUrl),
  cowLight: loadImage(cowLightUrl),
  cowPink: loadImage(cowPinkUrl),
  cowPurple: loadImage(cowPurpleUrl),
  cowBabyBrown: loadImage(cowBabyBrownUrl),
  cowBabyGreen: loadImage(cowBabyGreenUrl),
  cowBabyLight: loadImage(cowBabyLightUrl),
  cowBabyPink: loadImage(cowBabyPinkUrl),
  cowBabyPurple: loadImage(cowBabyPurpleUrl),
  fantasyPig: loadImage(fantasyPigUrl),
  fantasySheep: loadImage(fantasySheepUrl),

  // Fruit trees (cosmetic tree variety) + alternate terrain
  treeApple: loadImage(treeAppleUrl),
  treeOrange: loadImage(treeOrangeUrl),
  treePeach: loadImage(treePeachUrl),
  treePear: loadImage(treePearUrl),
  darkerGrass: loadImage(darkerGrassUrl),

  // New world decor
  waterWell: loadImage(waterWellUrl),
  workStation: loadImage(workStationUrl),
  signs: loadImage(signsUrl),
  piknikBasket: loadImage(piknikBasketUrl),
  piknikBlanket: loadImage(piknikBlanketUrl),
  boats: loadImage(boatsUrl),
  chickenHouses: loadImage(chickenHousesUrl),
  waterTray: loadImage(waterTrayUrl),
  mailbox: loadImage(mailboxUrl),
  farmingPlants: loadImage(farmingPlantsUrl),
  farmingPlantsWatered: loadImage(farmingPlantsWateredUrl),
  farmingItems: loadImage(farmingItemsUrl),
  emojiIcons: loadImage(emojiSheetUrl),
  allIcons: loadImage(allIconsUrl),

  // Interior overhaul ("more interiors" pack)
  floorsWalls: loadImage(floorsWallsUrl),
  furnitureWarm: loadImage(furnitureWarmUrl),
  furnitureCool: loadImage(furnitureCoolUrl),
  smallItems: loadImage(smallItemsUrl),
  modernInteriors: loadImage(modernInteriorsUrl),
  catTower: loadImage(catTowerUrl),
  dogHouse: loadImage(dogHouseUrl),
  petProps: loadImage(petPropsUrl),
  premiumFlora: loadImage(premiumFloraUrl),
  premiumWoodMushrooms: loadImage(premiumWoodMushroomsUrl),
  premiumHuts: loadImage(premiumHutsUrl),
  premiumFish: loadImage(premiumFishUrl),
  premiumFrog: loadImage(premiumFrogUrl),
  premiumBigFish: loadImage(premiumBigFishUrl),
  premiumFishingSplash: loadImage(premiumFishingSplashUrl),
};

/**
 * Furniture catalog for the "lived-in" interior decorating pass.
 *
 * Each entry is one placeable piece with a source crop and an in-world draw
 * width (height derived from the crop's aspect ratio). Pieces are drawn
 * bottom-anchored at their placement point so they depth-sort by their floor
 * contact, matching the player and other entities.
 *
 * `src`:
 *   'basic'   → Sprout Lands Basic_Furniture.png, used anywhere consistency
 *               with the rest of the game matters more than furniture variety.
 *   'topdown' → the "more interiors" sheet, kept only for pieces Sprout Lands
 *               does not provide yet.
 *   'modern'  → the LimeZu Modern Interiors sheet, used sparingly for the
 *               lived-in extras TopDownHouse lacks (stocked shelves, tabletop
 *               dishes, floor cushions, framed wall art).
 * `wall: true` marks a wall-mounted piece (hung flush on the north wall,
 *   top-anchored, sorted behind the player).
 */
export const FURNITURE = {
  // --- Verified TopDownHouse furniture crops ---
  round_table:      { src: 'topdown', sx: 176, sy: 0,   sw: 32, sh: 32, drawW: 48 },
  dining_table:     { src: 'topdown', sx: 0,   sy: 32,  sw: 48, sh: 32, drawW: 90 },
  low_shelf:        { src: 'topdown', sx: 48,  sy: 32,  sw: 32, sh: 32, drawW: 56 },
  big_bookshelf:    { src: 'topdown', sx: 32,  sy: 64,  sw: 48, sh: 48, drawW: 84 },
  bookshelf2:       { src: 'topdown', sx: 96,  sy: 64,  sw: 48, sh: 48, drawW: 70 },
  chest_drawers:    { src: 'topdown', sx: 0,   sy: 112, sw: 32, sh: 48, drawW: 56 },
  grandfather_clock:{ src: 'topdown', sx: 64,  sy: 112, sw: 32, sh: 48, drawW: 40 },
  floor_lamp:       { src: 'topdown', sx: 48,  sy: 112, sw: 16, sh: 48, drawW: 28 },
  stand_mirror:     { src: 'topdown', sx: 112, sy: 112, sw: 32, sh: 48, drawW: 34 },
  armchair_orange:  { src: 'topdown', sx: 176, sy: 112, sw: 32, sh: 48, drawW: 56 },
  plant_tall:       { src: 'topdown', sx: 0,   sy: 160, sw: 16, sh: 32, drawW: 44 },
  sofa3:            { src: 'topdown', sx: 16,  sy: 160, sw: 64, sh: 32, drawW: 100 },
  armchair:         { src: 'topdown', sx: 144, sy: 160, sw: 32, sh: 32, drawW: 64 },
  sofa_side:        { src: 'topdown', sx: 0,   sy: 192, sw: 32, sh: 64, drawW: 52 },
  fridge:           { src: 'topdown', sx: 32,  sy: 192, sw: 32, sh: 64, drawW: 46 },
  stove:            { src: 'topdown', sx: 64,  sy: 192, sw: 32, sh: 64, drawW: 52 },
  table_lamp:       { src: 'topdown', sx: 0,   sy: 256, sw: 16, sh: 32, drawW: 34 },
  bathtub:          { src: 'topdown', sx: 80,  sy: 256, sw: 48, sh: 32, drawW: 72 },
  toilet:           { src: 'topdown', sx: 128, sy: 256, sw: 32, sh: 32, drawW: 40 },
  tv_stand:         { src: 'topdown', sx: 176, sy: 256, sw: 32, sh: 32, drawW: 48 },
  pantry_shelf:     { src: 'modern',  sx: 80,  sy: 224, sw: 32, sh: 64, drawW: 62 },
  stocked_shelf:    { src: 'modern',  sx: 192, sy: 1096,sw: 32, sh: 80, drawW: 62 },
  cushion:          { src: 'modern',  sx: 228, sy: 1176,sw: 22, sh: 22, drawW: 30 },
  dish_cake:        { src: 'modern',  sx: 176, sy: 187, sw: 16, sh: 18, drawW: 20 },
  dish_sushi:       { src: 'modern',  sx: 176, sy: 208, sw: 16, sh: 15, drawW: 20 },
  dish_salad:       { src: 'modern',  sx: 200, sy: 208, sw: 16, sh: 16, drawW: 20 },
  art_fish:         { src: 'modern',  sx: 2,   sy: 320, sw: 28, sh: 26, drawW: 40, wall: true },
  art_land:         { src: 'modern',  sx: 2,   sy: 352, sw: 28, sh: 26, drawW: 40, wall: true },
  art_sky:          { src: 'modern',  sx: 2,   sy: 384, sw: 28, sh: 28, drawW: 40, wall: true },
};

/** Catalog rugs (Modern Interiors), drawn into the interior floor cache. */
export const RUG_PIECES = {
  rug_red:   { src: 'modern', sx: 104, sy: 244, sw: 80, sh: 40, drawW: 108 },
  rug_green: { src: 'modern', sx: 160, sy: 288, sw: 80, sh: 40, drawW: 108 },
};

export const CAT_TOWER_SPRITE = { sx: 0, sy: 0, sw: 64, sh: 64 };
export const DOG_HOUSE_SPRITE = { sx: 0, sy: 0, sw: 64, sh: 64 };
export const PET_PROPS_SPRITE = { sx: 0, sy: 0, sw: 192, sh: 64 };

/** Chicken color variants, keyed by the `color` field Critter.js assigns at spawn. */
export const CHICKEN_SHEETS = {
  default: Sprites.chicken,
  blue: Sprites.chickenBlue,
  brown: Sprites.chickenBrown,
  green: Sprites.chickenGreen,
  red: Sprites.chickenRed,
};
export const CHICKEN_BABY_SHEETS = {
  default: Sprites.chickenBabyDefault,
  blue: Sprites.chickenBabyBlue,
  brown: Sprites.chickenBabyBrown,
  green: Sprites.chickenBabyGreen,
  red: Sprites.chickenBabyRed,
};
export const COW_SHEETS = {
  default: Sprites.cow,
  brown: Sprites.cowBrown,
  green: Sprites.cowGreen,
  light: Sprites.cowLight,
  pink: Sprites.cowPink,
  purple: Sprites.cowPurple,
};
export const COW_BABY_SHEETS = {
  brown: Sprites.cowBabyBrown,
  green: Sprites.cowBabyGreen,
  light: Sprites.cowBabyLight,
  pink: Sprites.cowBabyPink,
  purple: Sprites.cowBabyPurple,
};
export const CRITTER_SHEETS = {
  pig: Sprites.fantasyPig,
  sheep: Sprites.fantasySheep,
};
export const CHICKEN_COLORS = Object.keys(CHICKEN_SHEETS);
export const COW_COLORS = Object.keys(COW_SHEETS);

/** Fruit tree sheets, picked randomly per tree collider for cosmetic variety. */
export const FRUIT_TREE_SHEETS = [Sprites.treeApple, Sprites.treeOrange, Sprites.treePeach, Sprites.treePear];
// Same crop across all 4 fruit sheets (identical grid layout): a fully
// bloomed/fruiting tree frame, picked to avoid stray falling-petal frames.
export const FRUIT_TREE_SPRITE = { sx: 0, sy: 96, sw: 48, sh: 48 };

/**
 * Tinted copies of the character sheet, one per guard role, built lazily
 * once the base sheet has decoded. A translucent color overlay is
 * composited 'source-atop' so the pixel-art shading survives the recolor.
 */
const tintCache = {};
const ROLE_TINTS = {
  lifeguard: 'rgba(239, 68, 68, 0.45)',
  security: 'rgba(30, 58, 138, 0.55)',
  staff: 'rgba(21, 128, 61, 0.4)',
  // 'camper' has no tint — untinted base sheet
};

export function getCharacterSheet(role) {
  if (tintCache[role]) return tintCache[role];
  const base = Sprites.character;
  if (!spriteReady(base)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(base, 0, 0);
  if (ROLE_TINTS[role]) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = ROLE_TINTS[role];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  tintCache[role] = canvas;
  return canvas;
}

// Character sheet layout: 4x4 grid of 48x48 cells.
// Rows: 0=down, 1=up, 2=left, 3=right. Cols 0-1 idle, 2-3 walk.
export const CHAR_CELL = 48;

/** Verify an image is actually decoded and ready to draw. */
export function spriteReady(img) {
  return img.complete && img.naturalWidth > 0;
}

// Tree sprite crop within Sprites.objects — verified clean single-tree bounding box.
export const TREE_SPRITE = { sx: 16, sy: 0, sw: 32, sh: 32 };

// Bush: canopy-only crop of the same tree art (no trunk), within Sprites.objects.
export const BUSH_SPRITE = { sx: 16, sy: 0, sw: 32, sh: 24 };

// Buildings: pre-composed 64x64 house tiles within Sprites.house (3x3 color-variant grid).
export const CABIN_SPRITE = { sx: 0, sy: 0, sw: 64, sh: 64 };
export const CAFE_SPRITE = { sx: 64, sy: 0, sw: 64, sh: 64 };
export const HUT_SPRITES = [
  { sx: 0, sy: 0, sw: 64, sh: 64 },
  { sx: 64, sy: 0, sw: 64, sh: 64 },
  { sx: 128, sy: 0, sw: 64, sh: 64 },
  { sx: 0, sy: 64, sw: 64, sh: 64 },
  { sx: 64, sy: 64, sw: 64, sh: 64 },
  { sx: 128, sy: 64, sw: 64, sh: 64 },
  { sx: 0, sy: 128, sw: 64, sh: 64 },
  { sx: 64, sy: 128, sw: 64, sh: 64 },
  { sx: 128, sy: 128, sw: 64, sh: 64 },
];
// Grey brick building within Sprites.brickHouse (288x80 sheet, 3 variants).
export const SHOP_SPRITE = { sx: 0, sy: 0, sw: 96, sh: 80 };

// Loot containers within Sprites.chest (160x64 sheet, 5x2 grid of 32x32 poses).
export const CONTAINER_CLOSED_SPRITE = { sx: 0, sy: 0, sw: 32, sh: 32 };
export const CONTAINER_OPEN_SPRITE = { sx: 64, sy: 0, sw: 32, sh: 32 };

// Fence rail segment within Sprites.fence (64x64 sheet, 16px grid).
// The top row is mostly post/cap pieces; this middle-row crop includes the
// connecting rails so repeated beach fences do not render as lonely stakes.
export const FENCE_SPRITE = { sx: 16, sy: 16, sw: 16, sh: 16 };

// Terrain tiles (16px grid). Grass.png is a rounded autotile blob — the
// solid all-grass fill tile sits one tile in from the corner.
export const GRASS_TILE = { sx: 16, sy: 16, sw: 16, sh: 16 };
// Tilled_Dirt.png same blob layout — used as the sandy/dirt path fill.
export const DIRT_TILE = { sx: 16, sy: 16, sw: 16, sh: 16 };
// Water.png: 4 animation frames of 16x16, left to right.
export const WATER_FRAMES = [0, 16, 32, 48].map(sx => ({ sx, sy: 0, sw: 16, sh: 16 }));

// Interior floorboard fill tile within Sprites.interior (256x256, 16px grid,
// 16 cols) — the plain wood floor tile the source map used as its base fill
// under furniture, picked by frequency analysis of the bundled sample map.
export const FLOOR_TILE = { sx: 176, sy: 112, sw: 16, sh: 16 };

// More props within Sprites.objects (Basic Grass Biom things, 16px grid)
export const LOG_BENCH_SPRITE = { sx: 32, sy: 64, sw: 48, sh: 16 };  // mossy fallen log
export const ROCK_SPRITE = { sx: 128, sy: 16, sw: 16, sh: 16 };
export const LILY_SPRITES = [
  { sx: 112, sy: 64, sw: 16, sh: 16 },
  { sx: 128, sy: 64, sw: 16, sh: 16 },
];
export const MUSHROOM_SPRITES = [
  { sx: 80, sy: 0, sw: 16, sh: 16 },   // pink cluster
  { sx: 128, sy: 0, sw: 16, sh: 16 },  // purple pair
];
export const SUNFLOWER_SPRITE = { sx: 128, sy: 32, sw: 16, sh: 32 };
export const PREMIUM_TREE_SPRITES = [
  { sx: 64, sy: 0, sw: 32, sh: 48 },
  { sx: 96, sy: 0, sw: 32, sh: 48 },
  { sx: 128, sy: 0, sw: 32, sh: 48 },
  { sx: 160, sy: 0, sw: 32, sh: 48 },
];
export const PREMIUM_BUSH_SPRITES = [
  { sx: 96, sy: 48, sw: 32, sh: 32 },
  { sx: 128, sy: 48, sw: 32, sh: 32 },
  { sx: 160, sy: 48, sw: 32, sh: 32 },
];
export const PREMIUM_GROUND_SPRITES = [
  { sheet: 'flora', sx: 0, sy: 64, sw: 16, sh: 16, drawW: 24 },
  { sheet: 'flora', sx: 16, sy: 64, sw: 16, sh: 16, drawW: 24 },
  { sheet: 'flora', sx: 32, sy: 64, sw: 16, sh: 16, drawW: 24 },
  { sheet: 'wood', sx: 0, sy: 0, sw: 16, sh: 16, drawW: 26 },
  { sheet: 'wood', sx: 16, sy: 0, sw: 16, sh: 16, drawW: 26 },
  { sheet: 'wood', sx: 64, sy: 64, sw: 16, sh: 16, drawW: 24 },
];
export const FROG_IDLE = [{ sx: 0, sy: 0 }, { sx: 32, sy: 0 }];
export const FROG_JUMP = [{ sx: 64, sy: 32 }, { sx: 96, sy: 32 }, { sx: 128, sy: 32 }, { sx: 160, sy: 32 }];
export const FISH_ICON_SPRITES = [
  { sx: 0, sy: 0, sw: 16, sh: 16 },
  { sx: 16, sy: 0, sw: 16, sh: 16 },
  { sx: 32, sy: 0, sw: 16, sh: 16 },
  { sx: 48, sy: 0, sw: 16, sh: 16 },
  { sx: 64, sy: 0, sw: 16, sh: 16 },
  { sx: 80, sy: 0, sw: 16, sh: 16 },
  { sx: 96, sy: 0, sw: 16, sh: 16 },
  { sx: 112, sy: 0, sw: 16, sh: 16 },
];
export const BIG_FISH_SWIM_FRAMES = Array.from({ length: 15 }, (_, i) => ({ sx: i * 16, sy: 0, sw: 16, sh: 16 }));
export const FISHING_SPLASH_FRAMES = [
  { sx: 0, sy: 176, sw: 16, sh: 16 },
  { sx: 16, sy: 176, sw: 16, sh: 16 },
  { sx: 32, sy: 176, sw: 16, sh: 16 },
  { sx: 48, sy: 176, sw: 16, sh: 16 },
  { sx: 64, sy: 176, sw: 16, sh: 16 },
];

// Potted plants within Sprites.furniture (café/shop frontage decor)
export const POTTED_PLANTS = [
  { sx: 48, sy: 0, sw: 16, sh: 32 },
  { sx: 80, sy: 0, sw: 16, sh: 32 },
];

// Interior furnishings within Sprites.furniture
export const BED_SPRITE = { sx: 0, sy: 56, sw: 16, sh: 24 };
export const RUG_SPRITES = [
  { sx: 48, sy: 80, sw: 32, sh: 16 },   // green
  { sx: 80, sy: 80, sw: 32, sh: 16 },   // pink
  { sx: 112, sy: 80, sw: 32, sh: 16 },  // blue
];

// Recycle_items.png: a 515x64 strip of 8 trash/recyclable icons (bottles,
// cans, wrappers) at ~64px each — used for ground-litter pickups.
export const RECYCLE_SPRITES = Array.from({ length: 8 }, (_, i) => ({ sx: i * 64, sy: 0, sw: 64, sh: 64 }));

// Chicken: 16x16 cells — row 0 idle (2 frames), row 1 walk (4 frames)
export const CHICKEN_IDLE = [{ sx: 0, sy: 0 }, { sx: 16, sy: 0 }];
export const CHICKEN_WALK = [{ sx: 0, sy: 16 }, { sx: 16, sy: 16 }, { sx: 32, sy: 16 }, { sx: 48, sy: 16 }];
// Cow: 32x32 cells — row 0 walk (3 frames), row 1 graze (2 frames)
export const COW_WALK = [{ sx: 0, sy: 0 }, { sx: 32, sy: 0 }, { sx: 64, sy: 0 }];
export const COW_GRAZE = [{ sx: 0, sy: 32 }, { sx: 32, sy: 32 }];
export const FANTASY_CRITTER_IDLE = [{ sx: 0, sy: 0 }, { sx: 32, sy: 0 }];
export const FANTASY_CRITTER_WALK = [{ sx: 0, sy: 32 }, { sx: 32, sy: 32 }];
// The premium color-variant chicken/cow sheets keep the same top-rows layout
// as the base sheets (just append more animation rows below), so
// CHICKEN_IDLE/WALK and COW_WALK/GRAZE apply unchanged to every color.

// --- Interior overhaul: floors_and_walls.png (288x144, 4 color blocks) ---
// Cabin uses the warm orange block; café uses the tan wood-plank block.
export const CABIN_FLOOR_TILE = { sx: 102, sy: 32, sw: 16, sh: 16 };
export const CABIN_WALL_TILE = { sx: 102, sy: 110, sw: 16, sh: 16 };
export const CAFE_FLOOR_TILE = { sx: 172, sy: 32, sw: 16, sh: 16 };
export const CAFE_WALL_TILE = { sx: 250, sy: 110, sw: 16, sh: 16 };

// furniture_state1.png (warm palette, home cabin only)
export const HOME_BED_SPRITE = { sx: 0, sy: 64, sw: 32, sh: 48 };
export const WARDROBE_SPRITE = { sx: 45, sy: 2, sw: 20, sh: 32 };
export const PETBED_SPRITE = { sx: 99, sy: 238, sw: 27, sh: 18 };
// furniture_state2.png (cool palette, cafe only)
export const COUNTER_SPRITE = { sx: 100, sy: 195, sw: 100, sh: 40 };
// work_station.png is a single 32x32 icon — reskins the procedural workbench.
export const WORKSTATION_SPRITE = { sx: 0, sy: 0, sw: 32, sh: 32 };

// small_items.png (128x128, 16px grid) — a few clutter pieces for room dressing
export const CLOCK_SPRITE = { sx: 80, sy: 16, sw: 16, sh: 16 };
export const DOGBONE_SPRITE = { sx: 0, sy: 32, sw: 16, sh: 16 };
export const SMALL_PLANT_SPRITE = { sx: 96, sy: 16, sw: 16, sh: 16 };

// --- New world decor (premium pack) ---
export const SIGN_SPRITE = { sx: 0, sy: 0, sw: 16, sh: 16 };
// boats.png is a 3x3 sheet of 48x32 cells. Use the plain side-view boat from
// the second row; the top row includes extra rope/oar pixels that looked broken
// when cropped as a 48x40 region.
export const BOAT_SPRITE = { sx: 0, sy: 32, sw: 48, sh: 32 };
export const COOP_SPRITE = { sx: 0, sy: 0, sw: 64, sh: 128 };
export const WATER_TRAY_SPRITE = { sx: 0, sy: 0, sw: 32, sh: 16 };
export const MAILBOX_SPRITE = { sx: 4, sy: 18, sw: 14, sh: 22 };
/**
 * Home-farm crop catalog. Each entry picks a different row out of the
 * shared "Farming Plants v2" sheet (rows are a 32px-pitch grid, 16x16
 * sprite per cell) so the three crops are visually distinct at a glance.
 */
export const CROP_TYPES = {
  sproutroot: {
    id: 'sproutroot', name: 'Sproutroot', emoji: '🥕', value: 18, seedYield: 2,
    stages: [
      { sx: 0, sy: 0, sw: 16, sh: 16 },
      { sx: 32, sy: 0, sw: 16, sh: 16 },
      { sx: 64, sy: 0, sw: 16, sh: 16 },
      { sx: 96, sy: 0, sw: 16, sh: 16 },
    ],
  },
  berryvine: {
    id: 'berryvine', name: 'Berryvine', emoji: '🍓', value: 12, seedYield: 3,
    stages: [
      { sx: 0, sy: 192, sw: 16, sh: 16 },
      { sx: 32, sy: 192, sw: 16, sh: 16 },
      { sx: 64, sy: 192, sw: 16, sh: 16 },
      { sx: 96, sy: 192, sw: 16, sh: 16 },
    ],
  },
  goldwheat: {
    id: 'goldwheat', name: 'Goldwheat', emoji: '🌾', value: 30, seedYield: 1,
    stages: [
      { sx: 0, sy: 384, sw: 16, sh: 16 },
      { sx: 32, sy: 384, sw: 16, sh: 16 },
      { sx: 64, sy: 384, sw: 16, sh: 16 },
      { sx: 96, sy: 384, sw: 16, sh: 16 },
    ],
  },
};
export const CROP_ORDER = ['sproutroot', 'berryvine', 'goldwheat'];

/** Seed-pouch icon card, top-left of "Farming Plants items v2.png" (16px grid). */
export const SEED_ICON_SPRITE = { sx: 0, sy: 0, sw: 16, sh: 16 };

/**
 * HUD chrome icons cropped from the bundled "Emoji_Spritesheet_Free" pack
 * (32px grid) — used to replace Unicode emoji in the stat chips and hotbar.
 * Coordinates verified by rendering labeled grid crops during authoring.
 */
export const HUD_ICON_SPRITES = {
  coin:        { sx: 32,  sy: 256, sw: 32, sh: 32 },  // pebbles currency
  wateringCan: { sx: 64,  sy: 512, sw: 32, sh: 32 },  // hydration / water action
  sun:         { sx: 0,   sy: 576, sw: 32, sh: 32 },  // clock: daytime
  sunrise:     { sx: 96,  sy: 576, sw: 32, sh: 32 },  // clock: dawn/dusk
  moon:        { sx: 128, sy: 576, sw: 32, sh: 32 },  // clock: night
};

/** Top-bar action button icons, cropped from "All Icons.png" (16px grid, white variant row). */
export const NAV_ICON_SPRITES = {
  cart:   { sx: 32, sy: 16, sw: 16, sh: 16 },  // Shop
  trophy: { sx: 64, sy: 16, sw: 16, sh: 16 },  // Achievements (button + toast)
  gear:   { sx: 48, sy: 0,  sw: 16, sh: 16 },  // Dev menu
};

/** Same top-bar icon set, cropped from "small_items.png" (16px grid). */
export const NAV_ITEM_SPRITES = {
  hanger:   { sx: 96, sy: 16, sw: 16, sh: 16 },  // Wardrobe
  dogBone:  { sx: 0,  sy: 32, sw: 16, sh: 16 },  // Pet
  openBook: { sx: 0,  sy: 48, sw: 16, sh: 16 },  // Quest chip
};
// water_well.png and piknik_basket.png/piknik_blanket.png are single-icon
// files — no crop rect needed, draw the whole naturalWidth/naturalHeight.
