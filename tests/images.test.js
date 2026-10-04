import test from 'node:test';
import assert from 'node:assert/strict';
let requests = [], fail = false, decodes = 0;
globalThis.Image = class {
  set src(value) { requests.push(value); queueMicrotask(() => fail ? this.onerror?.() : this.onload?.()); }
  async decode() { decodes++; }
};
const {loadImage,preloadGroup} = await import('../src/game/ImageRegistry.js');
test('registry defers disc images, deduplicates URLs and waits for decode', async () => {
  const one = loadImage('cards.png',{group:'solitaire'});
  assert.equal(loadImage('cards.png',{group:'solitaire'}),one);
  assert.deepEqual(requests,[]);
  const progress=[]; await preloadGroup('solitaire',(n,total)=>progress.push([n,total]));
  assert.deepEqual(requests,['cards.png']); assert.equal(decodes,1); assert.deepEqual(progress,[[0,1],[1,1]]);
});
test('a failed image group can be retried without losing its registered image', async () => {
  fail=true; const image=loadImage('retry.png',{group:'retry'});
  await assert.rejects(preloadGroup('retry'),/could not load/);
  fail=false; await preloadGroup('retry'); assert.equal(loadImage('retry.png',{group:'retry'}),image);
  assert.deepEqual(requests.filter(url=>url==='retry.png'),['retry.png','retry.png']);
});
