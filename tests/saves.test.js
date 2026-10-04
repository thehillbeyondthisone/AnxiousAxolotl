import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager, parseSave } from '../src/game/SaveManager.js';
class Storage {
  constructor() { this.data = new Map(); this.fail = false; }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k,v) { if (this.fail) throw new Error('Quota exceeded'); this.data.set(k,v); }
  removeItem(k) { this.data.delete(k); }
}
const profile = () => ({ pebbles: 90, backpackCapacity: 6, items: [{ name: 'Hot Dog',type: 'food',value: 10,qty: 3 }], materials: { wood: 4 }, tools: { lockpick: 2 }, dayCount: 7, timeOfDay: 0.4, quest: { id:'sell3',type:'sell',text:'Sell 3 snacks',n:3,reward:30,progress:2 } });
test('flat profiles migrate without losing unknown fields and retain the original', () => {
  const storage = new Storage(), legacy = JSON.stringify({ pebbles: 65, hasRod: true, futureCosmetic: 'blue' });
  storage.setItem('save',legacy); const s = new SaveManager('save',{storage}); let money;
  s.register('pebbles',() => money,v => { money = v; });
  assert.equal(s.load().status,'migrated'); assert.equal(money,65);
  assert.equal(storage.getItem('save.legacy'),legacy);
  assert.equal(parseSave(storage.getItem('save')).data.futureCosmetic,'blue');
});
test('possessions, day and a partial quest round trip together', () => {
  const storage = new Storage(), s = new SaveManager('save',{storage});
  const data = profile(); for (const key of Object.keys(data)) s.register(key,() => data[key], v => { data[key] = v; });
  assert.equal(s.save().status,'saved'); const saved = parseSave(storage.getItem('save')).data;
  assert.deepEqual(saved,profile());
});
test('corrupt primary recovers a valid backup and invalid imports never replace it', () => {
  const storage = new Storage(), s = new SaveManager('save',{storage});
  s.extra = profile(); s.save(); s.extra.pebbles = 100; s.save();
  storage.setItem('save','{broken'); assert.equal(s.load().status,'recovered'); assert.equal(s.extra.pebbles,90);
  const before = storage.getItem('save');
  assert.throws(() => s.import(JSON.stringify({ ...profile(),items: [{ name:'x',type:'food',qty:-1 }] })));
  assert.equal(storage.getItem('save'),before);
});
test('future versions and storage failures preserve the primary', () => {
  const storage = new Storage(), raw = JSON.stringify({ schemaVersion: 99, savedAt: 'later', data: profile() });
  storage.setItem('save',raw); const s = new SaveManager('save',{storage});
  assert.equal(s.load().status,'blocked'); s.extra = profile(); s.save(); assert.equal(storage.getItem('save'),raw);
  storage.removeItem('save'); const other = new SaveManager('save',{storage}); other.extra = profile(); other.save();
  const previous = storage.getItem('save'); storage.fail = true;
  assert.equal(other.save().status,'error'); assert.equal(storage.getItem('save'),previous);
});
test('import makes an undo backup and rejects malformed pet and farm state before applying', () => {
  const storage = new Storage(), s = new SaveManager('save',{storage}); s.extra = profile(); s.save();
  const previous = storage.getItem('save'); s.import(JSON.stringify({ ...profile(),pebbles:123 }));
  assert.equal(storage.getItem('save.import-backup'),previous);
  assert.throws(() => s.inspectImport(JSON.stringify({ ...profile(), pets:[null] })));
  assert.throws(() => s.inspectImport(JSON.stringify({ ...profile(), homeFarmState:[{id:'home-0-0',stage:9,crop:'sproutroot'}] })));
  assert.throws(() => s.inspectImport(JSON.stringify({ ...profile(), selectedCropType:'missing' })));
  assert.throws(() => s.inspectImport(JSON.stringify({ ...profile(), items:[{name:'Berry',type:'food',emoji:'<img src=x>'}] })));
  assert.throws(() => s.inspectImport(JSON.stringify({ ...profile(), progression:{counts:{},claimed:['talk']} })));
  assert.throws(() => s.inspectImport(JSON.stringify({ ...profile(), furnitureLayout:{'decor-plant':{x:123,y:256}} })));
  s.save(); // A pagehide autosave from the old live session must not undo the import.
  assert.equal(parseSave(storage.getItem('save')).data.pebbles,123);
  s.reset(); s.save(); assert.equal(storage.getItem('save'),null);
});
