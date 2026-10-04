/**
 * SaveManager — a field-registry around localStorage so persisted state
 * doesn't require touching two hand-written functions (save + load) every
 * time a new field is added. Each call site owns its own read/write
 * (including any side effects, like flipping a DOM class or reconstructing
 * a class instance), so the registry itself stays completely generic.
 *
 * Usage:
 *   const save = new SaveManager('resortRogueProfile');
 *   save.register('hasHelmet',
 *     () => player.hasHelmet,
 *     (v) => { player.hasHelmet = !!v; if (v) indicator.classList.remove('hidden'); });
 *   save.load();   // call once at startup, after the fields it touches exist
 *   save.save();   // call whenever state should be persisted
 */
export class SaveManager {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.fields = []; // { key, get(), set(value) }
  }

  /**
   * @param {string} key - property name in the saved JSON blob
   * @param {() => any} getFn - reads the current value from live state
   * @param {(value: any) => void} setFn - applies a loaded value to live state
   */
  register(key, getFn, setFn) {
    this.fields.push({ key, get: getFn, set: setFn });
  }

  save() {
    try {
      const data = {};
      for (const f of this.fields) data[f.key] = f.get();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) { /* storage unavailable (private mode) — play session-only */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const f of this.fields) {
        if (data[f.key] !== undefined) f.set(data[f.key]);
      }
    } catch (e) { /* corrupt/unavailable profile — start fresh */ }
  }

  reset() {
    try { localStorage.removeItem(this.storageKey); } catch (e) { /* ignore */ }
  }
}
