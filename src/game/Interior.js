/**
 * Interior generator - builds small single-room worlds for enterable
 * buildings. Returns genData compatible with the World constructor; the door
 * gap in the south wall holds a '__exit' transition.
 */

const TILE_FLOOR = 8;
const TILE_LAKE = 0;

function shopKindFromName(name = '') {
  return name.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'shop';
}

function buildTownShopInterior(box) {
  const ts = 64;
  const kind = box.shopKind || shopKindFromName(box.shopName);
  const wide = kind === 'fish_market' || kind === 'souvenir_shop';
  const cols = wide ? 13 : 12;
  const rows = 8;
  const W = cols * ts;
  const H = rows * ts;
  const map = new Array(cols * rows).fill(TILE_FLOOR);
  const doorW = 96;
  const leftInset = 96;
  const rightInset = W - 96;
  const topDisplayY = 140;
  const midDisplayY = H * 0.56;
  const rugY = H * 0.73;

  const colliders = [
    { type: 'wall', x: 0, y: 0, w: W, h: 76 },
    { type: 'wall', x: 0, y: 76, w: 14, h: H - 76 },
    { type: 'wall', x: W - 14, y: 76, w: 14, h: H - 76 },
    { type: 'wall', x: 0, y: H - 20, w: W / 2 - doorW / 2, h: 20 },
    { type: 'wall', x: W / 2 + doorW / 2, y: H - 20, w: W / 2 - doorW / 2, h: 20 },
    { type: 'counter', x: 78, y: 184, w: W - 156, h: 38, shopKind: kind },
  ];

  const containers = [];
  const decorations = [];
  const rugs = [];
  const F = (piece, x, y) => decorations.push({ type: 'furniture', piece, x, y });
  const WA = (piece, fx) => decorations.push({ type: 'furniture', piece, x: W * fx, y: 40 });
  const display = (displayKind, x, y, w = 72, h = 54) => decorations.push({
    type: 'shopDisplay', kind: displayKind, x, y, w, h
  });

  decorations.push({
    type: 'register',
    x: W * 0.50,
    y: 174,
    shopName: box.shopName || 'Shop',
    shopKind: kind,
  });

  if (kind === 'fish_market') {
    F('fridge', leftInset, topDisplayY);
    F('stocked_shelf', rightInset, topDisplayY + 4);
    WA('art_fish', 0.28);
    WA('art_sky', 0.70);
    display('fish', W * 0.24, midDisplayY, 92, 52);
    display('fish', W * 0.50, midDisplayY, 92, 52);
    display('fish', W * 0.76, midDisplayY, 92, 52);
    rugs.push({ piece: 'rug_green', x: W / 2, y: rugY });
    for (let i = 0; i < 3; i++) {
      containers.push({
        x: W * (0.22 + i * 0.25) - 22,
        y: H * 0.58 - 26,
        w: 44,
        h: 34,
        type: 'cooler',
        looted: false,
        lootKind: 'food',
        rich: true,
      });
    }
  } else if (kind === 'surf_shop') {
    WA('art_sky', 0.28);
    WA('art_land', 0.70);
    display('surf', W * 0.22, midDisplayY, 70, 92);
    display('surf', W * 0.42, midDisplayY, 70, 92);
    F('low_shelf', W * 0.68, H * 0.48);
    F('stand_mirror', W - 96, H * 0.54);
    rugs.push({ piece: 'rug_green', x: W * 0.46, y: rugY });
  } else if (kind === 'ice_cream') {
    F('fridge', leftInset, topDisplayY + 2);
    F('dish_cake', W * 0.30, 168);
    display('icecream', W * 0.30, midDisplayY, 92, 54);
    display('icecream', W * 0.58, midDisplayY, 92, 54);
    F('round_table', W * 0.26, H * 0.76);
    F('round_table', W * 0.68, H * 0.76);
    F('armchair_orange', W * 0.39, H * 0.78);
    F('armchair', W * 0.81, H * 0.78);
    rugs.push({ piece: 'rug_red', x: W * 0.48, y: rugY });
  } else if (kind === 'souvenir_shop') {
    F('stocked_shelf', leftInset, topDisplayY + 4);
    F('pantry_shelf', rightInset, topDisplayY + 4);
    WA('art_land', 0.22);
    WA('art_fish', 0.50);
    WA('art_sky', 0.78);
    display('souvenir', W * 0.24, midDisplayY, 88, 60);
    display('souvenir', W * 0.50, midDisplayY, 88, 60);
    display('souvenir', W * 0.76, midDisplayY, 88, 60);
    rugs.push({ piece: 'rug_red', x: W / 2, y: rugY });
  } else if (kind === 'juice_bar') {
    F('fridge', leftInset, topDisplayY);
    F('stove', 152, topDisplayY);
    F('plant_tall', W - 70, H * 0.58);
    F('dish_salad', W * 0.42, 166);
    display('juice', W * 0.34, midDisplayY, 86, 54);
    display('juice', W * 0.58, midDisplayY, 86, 54);
    F('dining_table', W * 0.52, H * 0.76);
    F('armchair', W * 0.68, H * 0.78);
    rugs.push({ piece: 'rug_green', x: W * 0.50, y: rugY });
  } else {
    F('stocked_shelf', leftInset, topDisplayY + 4);
    F('pantry_shelf', rightInset, topDisplayY + 4);
    WA('art_fish', 0.26);
    WA('art_land', 0.68);
    display('tackle', W * 0.28, midDisplayY, 84, 62);
    display('tackle', W * 0.58, midDisplayY, 84, 62);
    F('low_shelf', W * 0.76, H * 0.76);
    rugs.push({ piece: 'rug_green', x: W * 0.46, y: rugY });
  }

  if (box.hasComputer) {
    decorations.push({
      type: 'computer',
      x: W - 124,
      y: H - 94,
      hostName: box.shopName || 'this shop',
    });
    F('floor_lamp', W - 58, H - 62);
  }

  return {
    tileSize: ts,
    cols,
    rows,
    map,
    colliders,
    containers,
    decorations,
    items: [],
    rugs,
    camper: null,
    staffPatrols: [{
      role: 'staff',
      points: [{ x: 90, y: 155 }, { x: W - 90, y: 155 }]
    }],
    isInterior: true,
    isTownShop: true,
    shopKind: kind,
    hasComputer: !!box.hasComputer,
    roomStyle: 'cool',
    petBedSpot: null,
    rat: { x: -9999, y: -9999, radius: 1 },
    zones: [],
    transitionPoints: [
      { x: W / 2 - doorW / 2, y: H - 18, w: doorW, h: 18, targetArea: '__exit', label: 'Exit' }
    ],
    seed: Math.floor(Math.random() * 1e9),
    areaType: 'interior',
    areaName: box.shopName || 'Town Shop',
  };
}

/**
 * @param {object} box - the building collider from the outside world
 * @returns {object} World genData
 */
export function buildInterior(box, options = {}) {
  if (box.type === 'shop' && box.interiorKind === 'town_shop') {
    return buildTownShopInterior(box);
  }

  const ts = 64;
  const isHome = box.type === 'homecabin';
  const isCafe = box.type === 'cafe';
  const homeUpgrades = options.homeUpgrades || {};
  const isHomePumped = isHome && !!homeUpgrades.hasHomePump;

  let cols, rows;
  if (isHome) { cols = 10; rows = 7; }
  else if (isCafe) { cols = 11 + Math.floor(Math.random() * 2); rows = 8 + Math.floor(Math.random() * 2); }
  else { cols = 7 + Math.floor(Math.random() * 3); rows = 6 + Math.floor(Math.random() * 2); }

  const W = cols * ts;
  const H = rows * ts;
  const sx = cols / 12;
  const sy = rows / 9;
  const map = new Array(cols * rows).fill(isHome && !isHomePumped ? TILE_LAKE : TILE_FLOOR);

  const doorW = 96;
  const colliders = [
    { type: 'wall', x: 0, y: 0, w: W, h: 76 },
    { type: 'wall', x: 0, y: 76, w: 14, h: H - 76 },
    { type: 'wall', x: W - 14, y: 76, w: 14, h: H - 76 },
    { type: 'wall', x: 0, y: H - 20, w: W / 2 - doorW / 2, h: 20 },
    { type: 'wall', x: W / 2 + doorW / 2, y: H - 20, w: W / 2 - doorW / 2, h: 20 },
  ];

  const containers = [];
  const decorations = [];
  const rugs = [];
  let camper = null;
  let staffPatrols = [];
  let petBedSpot = null;

  const roomStyle = isCafe ? 'cool' : 'warm';
  const doorMinX = W / 2 - doorW / 2 - 30;
  const doorMaxX = W / 2 + doorW / 2 + 30;
  const F = (piece, x, y) => decorations.push({ type: 'furniture', piece, x, y });
  const WA = (piece, fx) => decorations.push({ type: 'furniture', piece, x: W * fx, y: 40 });
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffled = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const topY = 122;
  const midY = Math.round(H * 0.5);
  const botY = H - 52;

  if (isHome) {
    // Home cabin: starts sunken, then becomes a dry progression room once
    // the baby turtle crew installs the pump.
    const leftX = 74;
    const rightX = W - 74;
    const shelfY = 126;
    const livingY = Math.round(H * 0.50);
    const utilityY = H - 56;

    colliders.push({ type: 'bed', x: 60, y: 88, w: 56, h: 112, homeBed: true });
    F('chest_drawers', 42, shelfY);

    containers.push({ x: W * 0.50 - 22, y: 104, w: 44, h: 36, type: 'homechest', looted: false });
    decorations.push({ type: 'wardrobe', x: W * 0.64, y: shelfY });
    F('big_bookshelf', rightX, shelfY);

    F('round_table', W * 0.26, livingY + 18);
    F('armchair', W * 0.62, livingY + 20);
    F('armchair_orange', rightX - 8, livingY + 18);
    decorations.push({ type: 'smallplant', x: 34, y: livingY + 10 });

    F('fridge', leftX, utilityY);
    F('stove', leftX + 56, utilityY);
    decorations.push({ type: 'workbench', x: rightX - 26, y: utilityY });

    petBedSpot = { x: W * 0.37, y: utilityY };
    decorations.push({ type: 'petbed', x: petBedSpot.x, y: petBedSpot.y });
    decorations.push({ type: 'dogbone', x: petBedSpot.x + 24, y: petBedSpot.y + 2 });

    if (isHomePumped) {
      rugs.push({ piece: 'rug_green', x: W * 0.50, y: livingY + 28 });
      decorations.push({ type: 'homepump', x: leftX + 118, y: utilityY + 3 });
    }
    if (homeUpgrades.hasCatTree) {
      decorations.push({ type: 'cattree', x: W * 0.80, y: H * 0.59 });
    }
    if (homeUpgrades.hasTurtleCove) {
      decorations.push({ type: 'turtlecove', x: W * 0.49, y: H * 0.76 });
    }
    if (homeUpgrades.hasShellShelf) {
      decorations.push({ type: 'shellhelpers', x: W * 0.74, y: utilityY - 2 });
    }
    if (homeUpgrades.hasSunPatch) {
      decorations.push({ type: 'sunpatch', x: W * 0.78, y: H * 0.38 });
    }

  } else if (isCafe) {
    colliders.push({ type: 'counter', x: ts * 2 * sx, y: ts * 3.5 * sy, w: ts * 8 * sx, h: 40 });
    for (let i = 0; i < 3; i++) {
      containers.push({
        x: ts * (3 + i * 3) * sx,
        y: ts * 3.5 * sy + 22,
        w: 40,
        h: 34,
        type: 'cooler',
        looted: false,
        lootKind: 'food',
        rich: true
      });
    }
    staffPatrols = [{
      role: 'staff',
      points: [{ x: ts * 2.5 * sx, y: ts * 2.5 * sy }, { x: ts * 9.5 * sx, y: ts * 2.5 * sy }]
    }];

    F('stocked_shelf', W * 0.14, topY);
    F('pantry_shelf', W * 0.87, topY);
    F('fridge', W * 0.40, topY);
    F('stove', W * 0.52, topY);
    WA('art_land', 0.26);
    WA('art_sky', 0.68);
    rugs.push({ piece: 'rug_green', x: W / 2, y: H * 0.74 });
    F('dining_table', W * 0.24, H * 0.72);
    F('armchair', W * 0.24, H * 0.72 + 26);
    F('dining_table', W * 0.50, botY - 6);
    F('armchair', W * 0.63, botY - 2);
    F('dining_table', W * 0.78, H * 0.72);
    F('armchair', W * 0.78, H * 0.72 + 26);
    F('plant_tall', 40, H * 0.7);
    F('plant_tall', W - 40, H * 0.7);
    decorations.push({ type: 'potted', x: ts * 1 * sx, y: botY, v: 0 });
    decorations.push({ type: 'potted', x: W - ts * 1 * sx, y: botY, v: 1 });
  } else {
    const bedX = 62;
    const bedY = 92;
    const bed = { x: bedX, y: bedY, w: 60, h: 90 };
    colliders.push({ type: 'bed', ...bed });
    camper = { x: bedX + 30, y: bedY + 45, bed, wake: 0, awake: false };

    const nChests = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < nChests; i++) {
      containers.push({
        x: ts * (5 + i * 2.4) * sx,
        y: ts * 1.4 * sy,
        w: 44,
        h: 36,
        type: 'cooler',
        looted: false,
        rich: true,
        locked: Math.random() < 0.4
      });
    }

    const slots = [
      { x: W * 0.14, y: midY - 6 },
      { x: W - W * 0.14, y: midY - 6 },
      { x: W * 0.12, y: botY },
      { x: W * 0.30, y: botY },
      { x: W * 0.70, y: botY },
      { x: W - 44, y: botY },
      { x: W * 0.44, y: midY + 10 },
    ];
    const pool = shuffled([
      'sofa3', 'armchair', 'big_bookshelf', 'bookshelf2', 'tv_stand', 'fridge',
      'stove', 'plant_tall', 'round_table', 'chest_drawers', 'grandfather_clock',
      'floor_lamp', 'stand_mirror', 'low_shelf', 'sofa_side',
    ]);
    const nPieces = 5 + Math.floor(Math.random() * 3);
    shuffled(slots).slice(0, nPieces).forEach((slot, i) => {
      if (slot.x > doorMinX && slot.x < doorMaxX && slot.y > midY) return;
      F(pool[i % pool.length], slot.x, slot.y);
    });
    if (Math.random() < 0.7) {
      if (Math.random() < 0.5) rugs.push({ piece: pick(['rug_red', 'rug_green']), x: W / 2, y: midY + 8 });
      else rugs.push({ x: W / 2, y: midY + 8, v: Math.floor(Math.random() * 3) });
    }
    F('plant_tall', W - 38, topY);
    if (Math.random() < 0.6) WA(pick(['art_fish', 'art_land', 'art_sky']), 0.3 + Math.random() * 0.4);
    decorations.push({ type: 'potted', x: W - ts * 1.2 * sx, y: ts * 2 * sy, v: Math.floor(Math.random() * 2) });
  }

  return {
    tileSize: ts,
    cols,
    rows,
    map,
    colliders,
    containers,
    decorations,
    items: [],
    rugs,
    camper,
    staffPatrols,
    isInterior: true,
    isFlooded: isHome && !isHomePumped,
    isHomeCabin: isHome,
    roomStyle,
    petBedSpot,
    rat: { x: -9999, y: -9999, radius: 1 },
    zones: [],
    transitionPoints: [
      { x: W / 2 - doorW / 2, y: H - 18, w: doorW, h: 18, targetArea: '__exit', label: 'Exit' }
    ],
    seed: Math.floor(Math.random() * 1e9),
    areaType: 'interior',
    areaName: isHome ? 'Your Cabin' : (isCafe ? 'Resort Cafe' : 'Cozy Cabin'),
  };
}
