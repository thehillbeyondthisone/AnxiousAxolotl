import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/game/Input.js';

class Element extends EventTarget {
  constructor() {
    super(); this.style = {}; this.captured = new Set(); this.disabled = false; this.width = 112;
    this.classes = new Set();
    this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c) };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.width }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); emit(this, 'lostpointercapture', { pointerId: id }); }
  matches() { return false; }
}
function emit(target, name, props = {}) {
  const e = new Event(name, { cancelable: true });
  Object.assign(e, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 56, clientY: 56, ...props });
  target.dispatchEvent(e);
}
function fixture() {
  globalThis.window = new EventTarget();
  const els = Object.fromEntries(['joystick-zone', 'joystick-base', 'joystick-handle', 'btn-action'].map(id => [id, new Element()]));
  globalThis.document = Object.assign(new EventTarget(), {
    getElementById: id => els[id], documentElement: { style: { setProperty() {} } }
  });
  const gates = { move: true, act: true };
  const input = new Input({ canMove: () => gates.move, canAct: () => gates.act });
  return { input, gates, zone: els['joystick-zone'], button: els['btn-action'], base: els['joystick-base'] };
}

test('a resting thumb stays still; full tilt and diagonal speed are bounded', () => {
  const { input, zone } = fixture();
  emit(zone, 'pointerdown', { clientX: 59 });
  assert.deepEqual(input.getMovementVector(), { x: 0, y: 0 });
  emit(zone, 'pointermove', { clientX: 200, clientY: 200 });
  assert.ok(Math.abs(Math.hypot(input.dx, input.dy) - 1) < 1e-9);
  emit(zone, 'pointerup');
  assert.deepEqual(input.getMovementVector(), { x: 0, y: 0 });
});
test('releasing the action finger preserves the moving finger', () => {
  const { input, zone, button } = fixture();
  let actions = 0; input.onAction(() => actions++);
  emit(zone, 'pointerdown', { clientX: 95 });
  emit(button, 'pointerdown', { pointerId: 2 });
  emit(button, 'pointerup', { pointerId: 2 });
  emit(window, 'pointerup', { pointerId: 2 });
  assert.equal(actions, 1); assert.equal(input.dx, 1); assert.equal(input.movePointer, 1);
});
test('a second touch cannot steal movement or end the first touch', () => {
  const { input, zone } = fixture();
  emit(zone, 'pointerdown', { clientX: 95 });
  emit(zone, 'pointerdown', { pointerId: 3, clientX: 5 });
  emit(zone, 'pointermove', { pointerId: 3, clientX: 5 });
  emit(zone, 'pointerup', { pointerId: 3 });
  assert.equal(input.dx, 1); assert.equal(input.movePointer, 1);
});
test('releasing movement does not release a held Reel button', () => {
  const { input, zone, button } = fixture();
  emit(button, 'pointerdown', { pointerId: 2 });
  emit(zone, 'pointerdown', { clientX: 95 });
  emit(zone, 'pointerup');
  assert.equal(input.actionHeld, true);
  emit(button, 'pointerup', { pointerId: 2 });
  assert.equal(input.actionHeld, false);
});
test('cancel and lost capture stop movement and held actions', () => {
  for (const name of ['pointercancel', 'lostpointercapture']) {
    const { input, zone, button } = fixture();
    emit(zone, 'pointerdown', { clientX: 95 }); emit(button, 'pointerdown', { pointerId: 2 });
    emit(zone, name); emit(button, name, { pointerId: 2 });
    assert.equal(input.dx, 0); assert.equal(input.actionHeld, false);
  }
});
test('blur, resizing, and backgrounding clear all held input', () => {
  for (const [target, name] of [['window', 'blur'], ['window', 'resize'], ['document', 'visibilitychange']]) {
    const { input, zone, button } = fixture();
    emit(zone, 'pointerdown', { clientX: 95 }); emit(button, 'pointerdown', { pointerId: 2 });
    input.keys.w = true;
    emit(globalThis[target], name);
    assert.deepEqual(input.getMovementVector(), { x: 0, y: 0 }); assert.equal(input.actionHeld, false);
    assert.equal(zone.hasPointerCapture(1), false); assert.equal(button.hasPointerCapture(2), false);
  }
});
test('paused controls reject new movement and actions', () => {
  const { input, gates, zone, button } = fixture();
  gates.move = gates.act = false;
  let actions = 0; input.onAction(() => actions++);
  emit(zone, 'pointerdown', { clientX: 95 }); emit(button, 'pointerdown', { pointerId: 2 });
  assert.deepEqual(input.getMovementVector(), { x: 0, y: 0 }); assert.equal(actions, 0);
});
test('button taps fire once, while keyboard and assistive activation still work', () => {
  const { input, button } = fixture();
  let actions = 0; input.onAction(() => actions++);
  emit(button, 'pointerdown'); emit(button, 'pointerup'); emit(button, 'click', { detail: 1 });
  assert.equal(actions, 1);
  emit(button, 'click', { detail: 0 }); assert.equal(actions, 2);
  emit(window, 'keydown', { key: 'e', repeat: false });
  emit(window, 'keydown', { key: 'e', repeat: true }); assert.equal(actions, 3);
});
test('changing stick size clears the drag and uses the actual new size', () => {
  const { input, zone, base } = fixture();
  emit(zone, 'pointerdown', { clientX: 95 });
  input.setJoystickScale(1.5); assert.equal(input.dx, 0);
  base.width = 168;
  emit(zone, 'pointerdown', { clientX: 142, clientY: 84 }); assert.equal(input.dx, 1);
  input.setJoystickScale(100); assert.equal(input.joystickScale, 1.5);
});
test('keyboard diagonals have the same speed as straight movement', () => {
  const { input } = fixture();
  emit(window, 'keydown', { key: 'w' }); emit(window, 'keydown', { key: 'd' });
  const v = input.getMovementVector(); assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
});
