/** One pointer owns movement; another can hold or tap the action button. */
export class Input {
  constructor({ canMove = () => true, canAct = () => true } = {}) {
    this.canMove = canMove;
    this.canAct = canAct;
    this.dx = this.dy = 0;
    this.isActive = false;
    this.keys = {};
    this.actionPressed = false;
    this.actionHeld = false;
    this.actionCallback = null;
    this.joystickScale = 1;
    this.movePointer = this.actionPointer = null;
    this.initKeyboard();
    this.initTouchJoystick();
    this.initActionButtons();
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('resize', () => this.reset());
    document.addEventListener('visibilitychange', () => this.reset());
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target?.matches?.('input, select, textarea, [contenteditable="true"]')) return;
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key) && this.canMove()) e.preventDefault();
      this.keys[key] = true;
      if ((key === ' ' || key === 'e') && this.canAct()) {
        e.preventDefault();
        this.actionPressed = true;
        if (!e.repeat) this.actionCallback?.();
      }
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
      if (key === ' ' || key === 'e') this.actionPressed = false;
    });
  }

  initTouchJoystick() {
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    this.handle = document.getElementById('joystick-handle');
    this.zone = zone;
    if (!zone || !base || !this.handle) return;
    const move = (e) => {
      if (e.pointerId !== this.movePointer || !this.canMove()) return;
      const rect = base.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(x, y);
      const radius = rect.width * 0.34;
      // A resting thumb does not drift; small movements stay gentle.
      const deadZone = radius * 0.16;
      const strength = Math.min(1, Math.max(0, (distance - deadZone) / (radius - deadZone)));
      this.dx = distance ? x / distance * strength : 0;
      this.dy = distance ? y / distance * strength : 0;
      this.isActive = strength > 0;
      const slide = Math.min(distance, radius);
      this.handle.style.transform = `translate(${distance ? x / distance * slide : 0}px, ${distance ? y / distance * slide : 0}px)`;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (this.movePointer !== null || !this.canMove() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      this.movePointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      zone.classList.add('steering');
      move(e);
    });
    zone.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId === this.movePointer) this.resetMovement(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  initActionButtons() {
    const button = document.getElementById('btn-action');
    this.actionButton = button;
    if (!button) return;
    button.addEventListener('pointerdown', (e) => {
      if (this.actionPointer !== null || !this.canAct() || button.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      this.actionPointer = e.pointerId;
      button.setPointerCapture(e.pointerId);
      this.actionHeld = this.actionPressed = true;
      button.classList.add('pressed');
      this.actionCallback?.();
    });
    const end = (e) => {
      if (e.pointerId !== this.actionPointer) return;
      this.actionPointer = null;
      this.actionHeld = this.actionPressed = false;
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    // Native keyboard / assistive activation has no pointerdown.
    button.addEventListener('click', (e) => {
      if (e.detail === 0 && this.canAct() && !button.disabled) this.actionCallback?.();
    });
  }

  resetMovement() {
    const pointer = this.movePointer;
    this.movePointer = null;
    this.dx = this.dy = 0;
    this.isActive = false;
    if (this.handle) this.handle.style.transform = 'translate(0px, 0px)';
    this.zone?.classList.remove('steering');
    if (pointer !== null && this.zone?.hasPointerCapture(pointer)) this.zone.releasePointerCapture(pointer);
  }

  reset() {
    this.resetMovement();
    this.keys = {};
    const pointer = this.actionPointer;
    this.actionPointer = null;
    this.actionHeld = this.actionPressed = false;
    this.actionButton?.classList.remove('pressed');
    if (pointer !== null && this.actionButton?.hasPointerCapture(pointer)) this.actionButton.releasePointerCapture(pointer);
  }

  onAction(callback) { this.actionCallback = callback; }

  setJoystickScale(scale) {
    this.joystickScale = Math.max(0.7, Math.min(1.5, Number(scale) || 1));
    this.resetMovement();
    document.documentElement.style.setProperty('--joystick-scale', this.joystickScale);
  }

  getMovementVector() {
    if (!this.canMove()) return { x: 0, y: 0 };
    const x = Number(!!(this.keys.d || this.keys.arrowright)) - Number(!!(this.keys.a || this.keys.arrowleft));
    const y = Number(!!(this.keys.s || this.keys.arrowdown)) - Number(!!(this.keys.w || this.keys.arrowup));
    const length = Math.hypot(x, y);
    if (length) return { x: x / length, y: y / length };
    return { x: this.dx, y: this.dy };
  }
}
