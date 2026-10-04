import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressionTracker } from '../src/game/Progression.js';
test('actions count ahead of the displayed goal and reward only once after reload', () => {
  let p = new ProgressionTracker();
  assert.deepEqual(p.record('fish'), []);
  assert.equal(p.record('talk')[0].reward, 10);
  assert.equal(p.record('sell',3)[0].reward, 25);
  p = new ProgressionTracker(p.serialize());
  assert.deepEqual(p.record('rod').map(m => m.id), ['rod','fish']);
  assert.deepEqual(p.record('fish'), []);
  assert.equal(p.current().id, 'home');
});
test('legacy ownership and statistics are acknowledged without retroactive payouts', () => {
  const p = new ProgressionTracker();
  p.reconcile({ hasRod: true, scoreFoodSold: 8, stats: { fishCaught: 2 }, hasHomePump: true });
  assert.equal(p.current().id, 'harvest');
  assert.equal(p.claimed.has('pump'),true);
  assert.deepEqual(p.record('home'), []);
  assert.deepEqual(p.record('harvest').map(m => m.id), ['harvest']);
});
