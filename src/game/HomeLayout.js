export const DECOR_CATALOG = [
  { id: 'plant', name: 'Potted plant', piece: 'plant_tall', cost: 20, wet: true },
  { id: 'lamp', name: 'Floor lamp', piece: 'floor_lamp', cost: 30 },
  { id: 'rug', name: 'Green rug', piece: 'rug_green', cost: 35, rug: true },
  { id: 'chair', name: 'Orange armchair', piece: 'armchair_orange', cost: 45 },
  { id: 'shelf', name: 'Low shelf', piece: 'low_shelf', cost: 50 },
  { id: 'sofa', name: 'Sofa', piece: 'sofa3', cost: 70 },
];
export const snap = n => Math.round(n / 32) * 32;
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Shortest accessible route for a small home companion, avoiding furniture. */
export function homeRoute(world, start, target) {
  const cell = 16, cols = Math.floor(world.width / cell), rows = Math.floor(world.height / cell), radius = 10;
  const open = (c,r) => {
    const x=c*cell+8,y=r*cell+8;
    return c>=1 && c<cols-1 && r>=6 && r<rows-1 && !world.colliders.some(b=>b.type!=='bush' && x>b.x-radius && x<b.x+b.w+radius && y>b.y-radius && y<b.y+b.h+radius);
  };
  let origin, distance = Infinity;
  for(let r=6;r<rows-1;r++)for(let c=1;c<cols-1;c++)if(open(c,r)) {
    const d=Math.hypot(c*cell+8-start.x,r*cell+8-start.y);if(d<distance){distance=d;origin=[c,r];}
  }
  if(!origin)return [];
  const queue=[origin], previous=new Map([[origin.join(','),null]]);let closest=origin, closestDistance=Infinity;
  for(let i=0;i<queue.length;i++){
    const [c,r]=queue[i], d=Math.hypot(c*cell+8-target.x,r*cell+8-target.y);
    if(d<closestDistance){closestDistance=d;closest=[c,r];}
    for(const [nc,nr] of [[c+1,r],[c-1,r],[c,r+1],[c,r-1]]) {
      const key=nc+','+nr;if(open(nc,nr)&&!previous.has(key)){previous.set(key,[c,r]);queue.push([nc,nr]);}
    }
  }
  const path=[];
  for(let point=closest;point;point=previous.get(point.join(',')))path.push({x:point[0]*cell+8,y:point[1]*cell+8});
  return path.reverse();
}
export function footprint(item, position = item) {
  if (item.rug || item.solid === false) return null;
  const w = item.w || 32, h = item.h || 24;
  return { x: position.x + (item.colliderOffsetX ?? -w / 2), y: position.y + (item.colliderOffsetY ?? -h), w, h };
}
export function applyLayout(data, layout = {}, owned = [], definitions = {}) {
  if (!data.isHomeCabin) return data;
  for (const d of [...data.decorations, ...data.rugs]) {
    if (!d.homeId || !(d.homeId in layout)) continue;
    const p = layout[d.homeId];
    if (p) { d.x = p.x; d.y = p.y; } else d.stored = true;
  }
  data.decorations = data.decorations.filter(d => !d.stored);
  data.rugs = data.rugs.filter(d => !d.stored);
  for (const id of owned) {
    const def = DECOR_CATALOG.find(d => d.id === id), p = layout['decor-' + id];
    if (!def || !p || (!def.wet && data.isFlooded)) continue;
    (def.rug ? data.rugs : data.decorations).push({ type: 'furniture', piece: def.piece, homeId: 'decor-' + id, x: p.x, y: p.y });
  }
  return data;
}

/** Radius-aware flood fill ensures the doorway still reaches essential interaction spots. */
export function validatePlacement(room, items, layout, selected, candidate) {
  const item = items.find(i => i.id === selected);
  if (!item) return 'Choose a furnishing first.';
  if (!candidate) return '';
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return 'Choose a spot inside the room.';
  if (room.flooded && !item.wet) return 'This furnishing needs a dry cabin. Buy the pump first.';
  const visualW = item.drawW || item.w || 32, visualH = item.drawH || item.h || 32;
  const bottom = candidate.y + (item.drawOffsetY || 0), candidateBox = footprint(item,candidate);
  if (candidate.x - visualW / 2 < 16 || candidate.x + visualW / 2 > room.width - 16 || bottom - visualH < 8 || bottom > room.height - 24 || (candidateBox && candidateBox.y < 76)) return 'Keep the whole furnishing inside the room.';
  const proposed = { ...layout, [selected]: candidate };
  const solids = items.flatMap(i => { const p = i.id in proposed ? proposed[i.id] : i; const box = p && footprint(i, p); return box ? [{ ...box, id: i.id }] : []; });
  const box = footprint(item, candidate);
  if (box && [...room.fixed, room.door].some(b => overlaps(box, b))) return 'Keep the doorway and fixed furnishings clear.';
  if (box && solids.some(b => b.id !== selected && overlaps(box, b))) return 'That spot overlaps another furnishing.';
  const blockers = [...room.fixed, ...solids];
  const cell = 16, radius = 16, cols = Math.floor(room.width / cell), rows = Math.floor(room.height / cell);
  const blocked = (c, r) => {
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    return x < radius || x > room.width - radius || y < 76 + radius || y > room.height - radius || blockers.some(b => x > b.x - radius && x < b.x + b.w + radius && y > b.y - radius && y < b.y + b.h + radius);
  };
  const queue = [[Math.floor(room.width / 2 / cell), rows - 3]], seen = new Set();
  for (let index = 0; index < queue.length; index++) {
    const [c, r] = queue[index], key = c + ',' + r;
    if (c < 0 || r < 0 || c >= cols || r >= rows || seen.has(key) || blocked(c, r)) continue;
    seen.add(key); queue.push([c + 1,r],[c - 1,r],[c,r + 1],[c,r - 1]);
  }
  if (room.essentials.some(p => ![...seen].some(key => { const [c,r] = key.split(',').map(Number); return Math.hypot(c * cell + 8 - p.x, r * cell + 8 - p.y) < (p.reach || 60); }))) return 'Leave a walking path to the bed, storage, wardrobe and workbench.';
  if (room.player && ![...seen].some(key => { const [c,r] = key.split(',').map(Number); return Math.hypot(c * cell + 8 - room.player.x, r * cell + 8 - room.player.y) < 28; })) return 'Leave room for Axel where you are standing.';
  return '';
}
