/**
 * Underwater dive zone — a small standalone "world" swapped in while the
 * player is diving, the same way Interior.js builds a room for buildings.
 * Phase 1 MVP: procedural coral/seaweed/rock decor plus a single sunken
 * shipwreck silhouette (a teaser for a future full pirate-ship dive site).
 * Loot/tiles are deliberately plain for now — richer loot tables and a
 * real underwater tileset come in a later phase.
 */

const TILE_LAKE = 0;

export function buildUnderwaterZone() {
  const ts = 64;
  const cols = 16, rows = 12;
  const W = cols * ts, H = rows * ts;
  const map = new Array(cols * rows).fill(TILE_LAKE);

  const colliders = [
    { type: 'wall', x: 0, y: 0, w: W, h: 14 },
    { type: 'wall', x: 0, y: H - 14, w: W, h: 14 },
    { type: 'wall', x: 0, y: 0, w: 14, h: H },
    { type: 'wall', x: W - 14, y: 0, w: 14, h: H },
  ];

  const decorations = [];

  // Coral clusters — scattered patches of 3-5 blobs each
  const nClusters = 9;
  for (let i = 0; i < nClusters; i++) {
    const cx = 100 + Math.random() * (W - 200);
    const cy = 100 + Math.random() * (H - 200);
    decorations.push({ type: 'coral', x: cx, y: cy, hue: Math.floor(Math.random() * 60) + 300, seed: Math.random() * 1000 });
  }

  // Seaweed patches
  const nWeed = 14;
  for (let i = 0; i < nWeed; i++) {
    decorations.push({
      type: 'seaweed',
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      strands: 2 + Math.floor(Math.random() * 3),
      seed: Math.random() * 1000,
    });
  }

  // Rocks
  const nRocks = 7;
  for (let i = 0; i < nRocks; i++) {
    decorations.push({ type: 'rock', x: 80 + Math.random() * (W - 160), y: 80 + Math.random() * (H - 160) });
  }

  // A single sunken shipwreck, roughly centered
  decorations.push({ type: 'shipwreck', x: W / 2 + (Math.random() - 0.5) * 100, y: H / 2 + (Math.random() - 0.5) * 60 });

  // Two loot containers on the sea floor (same loot table as surface for now)
  const containers = [
    { x: W * 0.3, y: H * 0.65, w: 44, h: 36, type: 'cooler', looted: false },
    { x: W * 0.7, y: H * 0.4, w: 44, h: 36, type: 'cooler', looted: false },
  ];

  return {
    tileSize: ts, cols, rows, map,
    colliders, containers, decorations,
    items: [],
    rugs: [], camper: null, staffPatrols: [],
    isInterior: true,
    isFlooded: false,
    isHomeCabin: false,
    isUnderwaterZone: true,
    petBedSpot: null,
    rat: { x: -9999, y: -9999, radius: 1 },
    zones: [],
    transitionPoints: [],
    seed: Math.floor(Math.random() * 1e9),
    areaType: 'underwater',
    areaName: 'The Deep',
  };
}
