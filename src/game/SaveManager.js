export const SAVE_VERSION = 1;
import { MILESTONES } from './Progression.js';
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v, min = 0, max = 1e9) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = v => typeof v === 'string' && v.length <= 160 && !/[<>]/.test(v);
const fail = key => { throw new Error('Invalid save field: ' + key); };
function validateJSON(value, depth = 0) {
  if (depth > 40) fail('nested data');
  if (typeof value === 'number' && !Number.isFinite(value)) fail('number');
  if (typeof value === 'string' && (value.length > 10000 || /[<>]/.test(value))) fail('text');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__','constructor','prototype'].includes(key)) fail(key);
    validateJSON(child,depth+1);
  }
}

/** Validate the whole snapshot before any live setter runs. */
export function validateProfile(data) {
  if (!plain(data) || !Object.keys(data).length) fail('profile');
  validateJSON(data);
  for (const [key, value] of Object.entries(data)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) fail(key);
    if (key.startsWith('has') && typeof value !== 'boolean') fail(key);
    if (['guidanceHidden','minimapHidden','minimapDefaultHidden'].includes(key) && typeof value !== 'boolean') fail(key);
    if (key === 'selectedCropType' && !['sproutroot','berryvine','goldwheat'].includes(value)) fail(key);
    if (['skinId','_lastQuestId'].includes(key) && value !== null && !text(value)) fail(key);
    if (['pebbles','bottleCaps','baitCharges','scorePebbles','scoreFoodSold','farmSeedCount','helperServicedDay'].includes(key) && !number(value)) fail(key);
    if (['baitCharges','scoreFoodSold','farmSeedCount','helperServicedDay'].includes(key) && !Number.isInteger(value)) fail(key);
    if (key === 'backpackCapacity' && !number(value, 1, 1000)) fail(key);
    if (key === 'dayCount' && (!number(value, 1) || !Number.isInteger(value))) fail(key);
    if (key === 'timeOfDay' && (!number(value, 0, 1) || value === 1)) fail(key);
    if (['volMaster','volMusic','volSfx'].includes(key) && !number(value, 0, 1)) fail(key);
    if (key === 'joystickScale' && !number(value, 0.1, 5)) fail(key);
    if (['items','ownedDiscs','pets','ownedFurniture'].includes(key) && (!Array.isArray(value) || value.length > 1000)) fail(key);
    if (key === 'cabinStorage' && (!plain(value) || !Array.isArray(value.items) || value.items.length > 1000)) fail(key);
    if (['items','cabinStorage'].includes(key)) for (const item of key === 'items' ? value : value.items) {
      if (!plain(item) || !text(item.name) || !text(item.type) || (item.qty !== undefined && (!number(item.qty, 1) || !Number.isInteger(item.qty))) || (item.value !== undefined && !number(item.value))) fail(key);
    }
    if (['materials','tools','stats'].includes(key)) {
      if (!plain(value) || Object.values(value).some(v => !number(v) && !(key === 'tools' && typeof v === 'boolean'))) fail(key);
    }
    if (key === 'pets') for (const pet of value) {
      if (!plain(pet) || !['puppy','kitten'].includes(pet.kind) || !text(pet.name) || !number(pet.hunger, 0, 100) || !number(pet.happiness, 0, 100) || (pet.atHome !== undefined && typeof pet.atHome !== 'boolean') || (pet.pebbleTimer !== undefined && !number(pet.pebbleTimer,0,120)) || (pet.lastPlayRewardDay !== undefined && (!number(pet.lastPlayRewardDay) || !Number.isInteger(pet.lastPlayRewardDay)))) fail(key);
    }
    if (key === 'homeFarmState' && value !== null) {
      if (!Array.isArray(value) || value.length > 100) fail(key);
      for (const p of value) if (!plain(p) || !/^home-[0-3]-[0-3]$/.test(p.id) || !number(p.stage, 0, 3) || !Number.isInteger(p.stage) || (p.watered !== undefined && typeof p.watered !== 'boolean') || (p.crop !== null && !['sproutroot','berryvine','goldwheat'].includes(p.crop))) fail(key);
      if (new Set(value.map(p=>p.id)).size !== value.length) fail(key);
    }
    if (key === 'quest' && value !== null && (!plain(value) || !text(value.id) || !text(value.text) || !text(value.type) || !number(value.n, 1, 100) || !number(value.progress, 0, value.n) || !number(value.reward, 0, 1000))) fail(key);
    if (['progression','furnitureLayout','discProgress'].includes(key) && !plain(value)) fail(key);
    if (['ownedDiscs','ownedFurniture','achievements'].includes(key) && (!Array.isArray(value) || value.some(v => !text(v)))) fail(key);
    if (key === 'furnitureLayout') for (const [id,v] of Object.entries(value)) if (!/^(starter-\d+|starter-rug-\d+|decor-(plant|lamp|rug|chair|shelf|sofa)|home-(cattree|turtlecove|shellhelpers|sunpatch))$/.test(id) || (v !== null && (!plain(v) || !number(v.x, 0, 640) || !number(v.y, 0, 448) || v.x % 32 || v.y % 32))) fail(key);
    if (key === 'progression' && (!plain(value.counts) || !Array.isArray(value.claimed) || Object.values(value.counts).some(v => !number(v)) || value.claimed.some(v => !text(v)))) fail(key);
    if (key === 'progression' && value.claimed.some(id=>{ const m=MILESTONES.find(m=>m.id===id); return !m || (value.counts[m.event] || 0)<m.n; })) fail(key);
    if (key === 'discProgress') for (const progress of Object.values(value)) {
      if (!plain(progress)) fail(key);
      for (const [field,v] of Object.entries(progress)) if ((['best','bestMoves'].includes(field) && !number(v)) || (field==='completed' && typeof v!=='boolean')) fail(key);
    }
  }
  return JSON.parse(JSON.stringify(data));
}

export function parseSave(raw) {
  if (typeof raw !== 'string' || raw.length > 2e6) fail('file');
  const parsed = JSON.parse(raw);
  if (plain(parsed) && parsed.schemaVersion !== undefined) {
    if (parsed.schemaVersion > SAVE_VERSION) { const e = new Error('This save needs a newer game. Automatic saving is disabled.'); e.future = true; throw e; }
    if (parsed.schemaVersion !== SAVE_VERSION || typeof parsed.savedAt !== 'string') fail('version');
    return { data: validateProfile(parsed.data), legacy: false };
  }
  return { data: validateProfile(parsed), legacy: true };
}

export class SaveManager {
  constructor(storageKey, { storage, onStatus = () => {} } = {}) {
    this.storageKey = storageKey; this.storage = storage; this.onStatus = onStatus;
    this.fields = []; this.extra = {}; this.blocked = false; this.status = 'ready';
  }
  store() { return this.storage || globalThis.localStorage; }
  report(status, message = '') { this.status = status; this.onStatus(status, message); return { status, message }; }
  register(key, get, set) { this.fields.push({ key, get, set }); }
  snapshot() { return validateProfile({ ...this.extra, ...Object.fromEntries(this.fields.map(f => [f.key, f.get()])) }); }
  encode(data) { return JSON.stringify({ schemaVersion: SAVE_VERSION, savedAt: new Date().toISOString(), data: validateProfile(data) }); }
  apply(data) { this.extra = data; for (const f of this.fields) if (data[f.key] !== undefined) f.set(data[f.key]); }
  write(data, preservePrimary = true) {
    const storage = this.store(), raw = this.encode(data), previous = storage.getItem(this.storageKey);
    if (preservePrimary && previous) {
      let valid = false;
      try { parseSave(previous); valid = true; } catch (e) { if (e.future) throw e; }
      if (valid) storage.setItem(this.storageKey + '.backup', previous);
    }
    storage.setItem(this.storageKey, raw);
    if (storage.getItem(this.storageKey) !== raw) throw new Error('Save verification failed');
    return this.report('saved');
  }
  save() {
    if (this.replacing) return this.report('replacing');
    if (this.blocked) return this.report('blocked', 'Automatic saving is disabled. Export this session or import a compatible backup.');
    try { return this.write(this.snapshot()); }
    catch (e) { if (e.future) this.blocked = true; return this.report('error', 'Progress isn’t saving. ' + e.message); }
  }
  load() {
    try {
      const storage = this.store(), raw = storage.getItem(this.storageKey);
      if (!raw) return this.report('new');
      let parsed;
      try { parsed = parseSave(raw); }
      catch (e) {
        if (e.future) { this.blocked = true; return this.report('blocked', e.message); }
        const backup = storage.getItem(this.storageKey + '.backup');
        if (!backup) { this.blocked = true; return this.report('blocked', 'Save could not be read. Import a backup or reset progress.'); }
        parsed = parseSave(backup); this.apply(parsed.data); this.write(parsed.data, false);
        return { ...this.report('recovered', 'Recovered your last valid backup.'), legacy: parsed.legacy };
      }
      if (parsed.legacy) storage.setItem(this.storageKey + '.legacy', raw);
      this.apply(parsed.data);
      if (parsed.legacy) this.write(parsed.data);
      return { ...this.report(parsed.legacy ? 'migrated' : 'loaded'), legacy: parsed.legacy };
    } catch (e) { this.blocked = true; return this.report('error', 'Progress isn’t saving. ' + e.message); }
  }
  export() { return this.encode(this.snapshot()); }
  inspectImport(raw) { return parseSave(raw).data; }
  import(raw) {
    const data = this.inspectImport(raw), storage = this.store();
    const previous = storage.getItem(this.storageKey);
    if (previous) storage.setItem(this.storageKey + '.import-backup', previous);
    // Explicit replacement is allowed after inspection, including recovery from corrupt data.
    this.write(data, !this.blocked); this.blocked = false; this.replacing = true;
    return data;
  }
  reset() {
    for (const suffix of ['', '.backup', '.legacy']) this.store().removeItem(this.storageKey + suffix);
    this.blocked = false;
    this.replacing = true;
  }
}
